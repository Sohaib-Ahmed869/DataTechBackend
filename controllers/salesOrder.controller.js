const SalesOrder = require("../models/SalesOrder.model");
const Customer = require("../models/Customer.model");
const {
  formatOrderForSAP,
  createSalesOrderInSAP,
  checkBusinessPartnerExists,
  testSAPConnection: testSAPConnectionUtil,
} = require("../utils/sapB1Integration");
async function pushOrderToSAPInternal(order) {
  try {
    console.log("🚀 Starting SAP integration for order:", order.DocEntry);

    // Check exchange rates setup
    try {
      await checkAndSetupExchangeRates();
    } catch (rateError) {
      console.warn("⚠️ Exchange rate check warning:", rateError.message);
    }

    // Check if business partner exists
    try {
      const businessPartnerExists = await checkBusinessPartnerExists(
        order.CardCode
      );
      if (!businessPartnerExists) {
        const errorMsg = `Business partner ${order.CardCode} does not exist in SAP B1`;
        order.SyncErrors = errorMsg;
        order.LastSyncAttempt = new Date();
        order.LocalStatus = "SyncFailed";
        order.SAPSyncDisabled = true;
        await order.save();
        return {
          success: false,
          error: errorMsg,
          code: "BP_NOT_FOUND",
        };
      }
    } catch (bpError) {
      console.warn(`Could not verify business partner: ${bpError.message}`);
    }

    // Format and push to SAP
    const sapOrder = await formatOrderForSAP(order);
    const sapResponse = await createSalesOrderInSAP(sapOrder);

    // Update local order if successful
    if (sapResponse && (sapResponse.DocEntry || sapResponse.simulated)) {
      order.SAPDocEntry = sapResponse.DocEntry;
      order.DocumentStatus = "Open";
      order.UpdateDate = new Date();
      order.SyncedWithSAP = true;
      order.LocalStatus = "Synced";
      order.SyncErrors = undefined;
      order.SAPSyncDisabled = false;
      await order.save();

      console.log(
        "✅ Order successfully synced with SAP:",
        sapResponse.DocEntry || "simulated"
      );
      return {
        success: true,
        SAPDocEntry: sapResponse.DocEntry,
        sapData: sapResponse,
      };
    } else {
      throw new Error("Invalid response from SAP B1");
    }
  } catch (error) {
    console.error("❌ Error pushing order to SAP:", error.message);

    // Categorize error types
    let errorCode = "GENERAL_ERROR";
    if (
      error.message.includes("Business partner") &&
      error.message.includes("does not exist")
    ) {
      errorCode = "BP_NOT_FOUND";
    } else if (error.message.includes("exchange rate")) {
      errorCode = "EXCHANGE_RATE_ERROR";
    } else if (error.message.includes("currency")) {
      errorCode = "CURRENCY_ERROR";
    } else if (error.message.includes("connection")) {
      errorCode = "CONNECTION_ERROR";
    }

    // Update local order
    order.SyncErrors = error.message;
    order.LastSyncAttempt = new Date();
    order.LocalStatus = "SyncFailed";

    if (["BP_NOT_FOUND", "INVALID_BP_CODE"].includes(errorCode)) {
      order.SAPSyncDisabled = true;
    }

    await order.save();

    return {
      success: false,
      error: error.message || "Unknown error",
      code: errorCode,
    };
  }
}

// Enhanced create sales order function
const createSalesOrder = async (req, res) => {
  try {
    const {
      CardCode,
      CardName,
      DocDate,
      DocDueDate,
      Comments,
      DocumentLines,
      DocTotal,
      salesAgent,
      PaymentTerms,
      validUntilDate,
      PriceList,
    } = req.body;

    // Validate required fields
    if (
      !CardCode ||
      !CardName ||
      !DocumentLines ||
      DocumentLines.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "CardCode, CardName, and DocumentLines are required",
      });
    }

    // Get the next DocEntry and DocNum
    const lastOrder = await SalesOrder.findOne().sort({ DocEntry: -1 });
    const nextDocEntry = lastOrder ? lastOrder.DocEntry + 1 : 1;
    const nextDocNum = lastOrder ? lastOrder.DocNum + 1 : 1000;

    // Process document lines
    const processedDocumentLines = DocumentLines.map((line, index) => ({
      ...line,
      LineNum: index,
      DocEntry: nextDocEntry,
      LineTotal: (line.Quantity || 0) * (line.Price || line.UnitPrice || 0),
      Price: line.Price || line.UnitPrice || 0,
      UnitPrice: line.UnitPrice || line.Price || 0,
    }));

    // Create new sales order with AED currency and price list 1
    const newSalesOrder = new SalesOrder({
      DocEntry: nextDocEntry,
      DocNum: nextDocNum,
      DocType: "dDocument_Items",
      DocDate: DocDate || new Date(),
      DocDueDate: DocDueDate || validUntilDate || new Date(),
      CardCode,
      CardName,
      Comments,
      DocumentLines: processedDocumentLines,
      DocTotal: DocTotal || 0,
      DocCurrency: "AED", // Keep AED
      PriceList: 1, // CRITICAL FIX: Use price list 1 which has AED currency
      DocumentStatus: "Open",
      salesAgent: salesAgent || req.user?.id,
      CreationDate: new Date(),
      UpdateDate: new Date(),
      UserSign: req.user?.id || 1,
      LocalStatus: "Created",
      SyncedWithSAP: false,
      SAPDocEntry: null,
      SyncErrors: null,
      LastSyncAttempt: null,
      SAPSyncDisabled: false,
    });

    // Calculate totals if not provided
    if (!newSalesOrder.DocTotal) {
      let total = 0;
      for (const line of newSalesOrder.DocumentLines) {
        const lineTotal = (line.Quantity || 0) * (line.Price || 0);
        line.LineTotal = lineTotal;
        total += lineTotal;
      }
      newSalesOrder.DocTotal = total;
    }

    console.log("📝 Creating new sales order:", {
      DocEntry: newSalesOrder.DocEntry,
      CardCode: newSalesOrder.CardCode,
      CardName: newSalesOrder.CardName,
      DocTotal: newSalesOrder.DocTotal,
      DocCurrency: newSalesOrder.DocCurrency,
      PriceList: newSalesOrder.PriceList, // Should now show 1
      DocumentLines: newSalesOrder.DocumentLines.length,
    });

    // Save to local database first
    const savedOrder = await newSalesOrder.save();

    // Populate salesAgent field
    const populatedOrder = await SalesOrder.findById(savedOrder._id)
      .populate("salesAgent", "firstName lastName email")
      .lean();

    // Push to SAP
    console.log("🔄 Automatically pushing new order to SAP...");
    const sapResult = await pushOrderToSAPInternal(savedOrder);

    // Return response based on SAP sync result
    if (sapResult.success) {
      res.status(201).json({
        success: true,
        message: "✅ Sales order created successfully and synced with SAP",
        data: {
          ...populatedOrder,
          SAPDocEntry: sapResult.SAPDocEntry,
          SyncedWithSAP: true,
          LocalStatus: "Synced",
        },
        sapSync: {
          success: true,
          SAPDocEntry: sapResult.SAPDocEntry,
        },
      });
    } else {
      // Customize message based on error code
      let sapErrorMessage = "Failed to sync with SAP";
      switch (sapResult.code) {
        case "BP_NOT_FOUND":
        case "INVALID_BP_CODE":
          sapErrorMessage = `Business partner ${CardCode} does not exist in SAP B1`;
          break;
        case "EXCHANGE_RATE_ERROR":
          sapErrorMessage =
            "Exchange rate issue in SAP B1 - please check currency configuration";
          break;
        case "CURRENCY_ERROR":
          sapErrorMessage = "Currency configuration issue in SAP B1";
          break;
        case "CONNECTION_ERROR":
          sapErrorMessage =
            "Could not connect to SAP B1 - please check connection";
          break;
      }

      res.status(201).json({
        success: true,
        message:
          "⚠️ Sales order created successfully in local database but failed to sync with SAP",
        data: {
          ...populatedOrder,
          SyncedWithSAP: false,
          LocalStatus: "SyncFailed",
          SyncErrors: sapResult.error,
        },
        sapSync: {
          success: false,
          error: sapResult.error,
          message: sapErrorMessage,
          code: sapResult.code,
        },
      });
    }
  } catch (error) {
    console.error("❌ Error creating sales order:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Test SAP connection endpoint
const testSAPConnection = async (req, res) => {
  try {
    console.log("🧪 Testing SAP connection...");
    const result = await testSAPConnectionUtil();

    if (result.success) {
      res.status(200).json({
        success: true,
        message: "✅ SAP B1 connection successful",
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "❌ SAP B1 connection failed",
        error: result.error,
        details: result.details,
      });
    }
  } catch (error) {
    console.error("❌ Error testing SAP connection:", error);
    res.status(500).json({
      success: false,
      message: "Error testing SAP connection",
      error: error.message,
    });
  }
};

// Manual push order to SAP (for retry)
const pushOrderToSAP = async (req, res) => {
  try {
    const { docEntry } = req.params;
    const order = await SalesOrder.findOne({
      DocEntry: Number.parseInt(docEntry),
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order with DocEntry ${docEntry} not found`,
      });
    }

    // Check if already synced
    if (order.SyncedWithSAP && order.SAPDocEntry) {
      return res.status(400).json({
        success: false,
        message: `Order already synced with SAP B1 (SAP DocEntry: ${order.SAPDocEntry})`,
        SAPDocEntry: order.SAPDocEntry,
      });
    }

    // Check if sync was disabled
    if (order.SAPSyncDisabled && req.query.force !== "true") {
      return res.status(400).json({
        success: false,
        message: `Cannot sync order: ${order.SyncErrors}. Add ?force=true to override.`,
        error: order.SyncErrors,
      });
    }

    // Clear disabled flag if force sync
    if (req.query.force === "true") {
      order.SAPSyncDisabled = false;
      await order.save();
    }

    console.log("🔄 Manual SAP push requested for order:", order.DocEntry);
    const sapResult = await pushOrderToSAPInternal(order);

    if (sapResult.success) {
      return res.status(200).json({
        success: true,
        message: "✅ Order successfully pushed to SAP B1",
        SAPDocEntry: sapResult.SAPDocEntry,
        localDocEntry: order.DocEntry,
        sapData: sapResult.sapData,
      });
    } else {
      let errorMessage = "Error pushing order to SAP B1";
      switch (sapResult.code) {
        case "BP_NOT_FOUND":
        case "INVALID_BP_CODE":
          errorMessage = `Business partner ${order.CardCode} does not exist in SAP B1`;
          break;
        case "EXCHANGE_RATE_ERROR":
          errorMessage =
            "Exchange rate issue in SAP B1 - please check currency configuration";
          break;
        case "CURRENCY_ERROR":
          errorMessage = "Currency configuration issue in SAP B1";
          break;
        case "CONNECTION_ERROR":
          errorMessage =
            "Could not connect to SAP B1 - please check connection";
          break;
      }

      return res.status(400).json({
        success: false,
        message: errorMessage,
        error: sapResult.error,
        code: sapResult.code,
      });
    }
  } catch (error) {
    console.error("❌ Error in manual SAP push:", error);
    res.status(500).json({
      success: false,
      message: "Error pushing order to SAP B1",
      error: error.message || "Unknown error",
    });
  }
};
// Keep all your existing functions unchanged...
const getAllSalesOrdersWithSAPStatus = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      salesAgent,
      status,
      fromDate,
      toDate,
      sortBy = "DocDate",
      sortOrder = "desc",
      sapSyncStatus,
    } = req.query;

    const filter = {};

    if (salesAgent && salesAgent !== "all") {
      filter.salesAgent = salesAgent;
    }

    if (status && status !== "all") {
      filter.DocumentStatus = status;
    }

    if (sapSyncStatus && sapSyncStatus !== "all") {
      if (sapSyncStatus === "synced") {
        filter.SyncedWithSAP = true;
      } else if (sapSyncStatus === "failed") {
        filter.LocalStatus = "SyncFailed";
      } else if (sapSyncStatus === "pending") {
        filter.SyncedWithSAP = false;
        filter.SAPSyncDisabled = { $ne: true };
      } else if (sapSyncStatus === "disabled") {
        filter.SAPSyncDisabled = true;
      }
    }

    if (fromDate && toDate) {
      filter.DocDate = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      };
    }

    if (search) {
      filter.$or = [
        { CardName: { $regex: search, $options: "i" } },
        { CardCode: { $regex: search, $options: "i" } },
        { DocNum: Number.parseInt(search) || 0 },
        { Comments: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Number.parseInt(page);
    const limitNum = Number.parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "desc" ? -1 : 1;

    const salesOrders = await SalesOrder.find(filter)
      .populate("salesAgent", "firstName lastName email")
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalOrders = await SalesOrder.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limitNum);

    const sapSyncSummary = await SalesOrder.aggregate([
      { $match: {} },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          syncedOrders: {
            $sum: { $cond: [{ $eq: ["$SyncedWithSAP", true] }, 1, 0] },
          },
          failedOrders: {
            $sum: { $cond: [{ $eq: ["$LocalStatus", "SyncFailed"] }, 1, 0] },
          },
          disabledOrders: {
            $sum: { $cond: [{ $eq: ["$SAPSyncDisabled", true] }, 1, 0] },
          },
        },
      },
    ]);

    const syncStats = sapSyncSummary[0] || {
      totalOrders: 0,
      syncedOrders: 0,
      failedOrders: 0,
      disabledOrders: 0,
    };

    res.status(200).json({
      success: true,
      data: {
        salesOrders,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalOrders,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum,
        },
        sapSyncSummary: {
          ...syncStats,
          pendingOrders:
            syncStats.totalOrders -
            syncStats.syncedOrders -
            syncStats.failedOrders -
            syncStats.disabledOrders,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching sales orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales orders",
      error: error.message,
    });
  }
};

// Get sales orders by customer
const getSalesOrdersByCustomer = async (req, res) => {
  try {
    const { cardCode } = req.params;
    const {
      status = "all",
      fromDate,
      toDate,
      sortBy = "DocDate",
      sortOrder = "desc",
    } = req.query;

    // Build filter
    const filter = { CardCode: cardCode };

    // Status filter
    if (status !== "all") {
      if (status === "open") {
        filter.DocumentStatus = "Open";
      } else if (status === "closed") {
        filter.DocumentStatus = "Closed";
      } else if (status === "cancelled") {
        filter.DocumentStatus = "Cancelled";
      }
    }

    // Date range filter
    if (fromDate && toDate) {
      filter.DocDate = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      };
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "desc" ? -1 : 1;

    const salesOrders = await SalesOrder.find(filter)
      .populate("salesAgent", "firstName lastName email")
      .sort(sortConfig)
      .lean();

    res.status(200).json({
      success: true,
      data: salesOrders,
    });
  } catch (error) {
    console.error("Error fetching sales orders by customer:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales orders",
      error: error.message,
    });
  }
};

// Get all sales orders with pagination and filtering
const getAllSalesOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      salesAgent,
      status,
      fromDate,
      toDate,
      sortBy = "DocDate",
      sortOrder = "desc",
    } = req.query;

    // Build filter object
    const filter = {};

    // Sales agent filter
    if (salesAgent && salesAgent !== "all") {
      filter.salesAgent = salesAgent;
    }

    // Status filter
    if (status && status !== "all") {
      filter.DocumentStatus = status;
    }

    // Date range filter
    if (fromDate && toDate) {
      filter.DocDate = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      };
    }

    // Search functionality
    if (search) {
      filter.$or = [
        { CardName: { $regex: search, $options: "i" } },
        { CardCode: { $regex: search, $options: "i" } },
        { DocNum: parseInt(search) || 0 },
        { Comments: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query
    const salesOrders = await SalesOrder.find(filter)
      .populate("salesAgent", "firstName lastName email")
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count
    const totalOrders = await SalesOrder.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limitNum);

    res.status(200).json({
      success: true,
      data: {
        salesOrders,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalOrders,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching sales orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales orders",
      error: error.message,
    });
  }
};

// Get sales order by ID
const getSalesOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const salesOrder = await SalesOrder.findById(id)
      .populate("salesAgent", "firstName lastName email")
      .lean();

    if (!salesOrder) {
      return res.status(404).json({
        success: false,
        message: "Sales order not found",
      });
    }

    res.status(200).json({
      success: true,
      data: salesOrder,
    });
  } catch (error) {
    console.error("Error fetching sales order by ID:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid sales order ID format",
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales order",
      error: error.message,
    });
  }
};

// Get sales order by DocEntry
const getSalesOrderByDocEntry = async (req, res) => {
  try {
    const { docEntry } = req.params;

    const salesOrder = await SalesOrder.findOne({
      DocEntry: parseInt(docEntry),
    })
      .populate("salesAgent", "firstName lastName email")
      .lean();

    if (!salesOrder) {
      return res.status(404).json({
        success: false,
        message: "Sales order not found",
      });
    }

    res.status(200).json({
      success: true,
      data: salesOrder,
    });
  } catch (error) {
    console.error("Error fetching sales order by DocEntry:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales order",
      error: error.message,
    });
  }
};

// Update sales order
const updateSalesOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Add update timestamp
    updateData.UpdateDate = new Date();

    const updatedOrder = await SalesOrder.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("salesAgent", "firstName lastName email");

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Sales order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Sales order updated successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating sales order:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid sales order ID format",
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to update sales order",
      error: error.message,
    });
  }
};

// Cancel sales order
const cancelSalesOrder = async (req, res) => {
  try {
    const { docEntry } = req.params;
    const { reason = "Cancelled by user" } = req.body;

    const salesOrder = await SalesOrder.findOneAndUpdate(
      { DocEntry: parseInt(docEntry) },
      {
        DocumentStatus: "Cancelled",
        CancelReason: reason,
        CancelDate: new Date(),
        UpdateDate: new Date(),
      },
      { new: true }
    ).populate("salesAgent", "firstName lastName email");

    if (!salesOrder) {
      return res.status(404).json({
        success: false,
        message: "Sales order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Sales order cancelled successfully",
      data: salesOrder,
    });
  } catch (error) {
    console.error("Error cancelling sales order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel sales order",
      error: error.message,
    });
  }
};

// Duplicate sales order
// Duplicate sales order function
const duplicateSalesOrder = async (req, res) => {
  try {
    const { docEntry } = req.params;
    const userId = req.user?._id;
    const userName = `${req.user?.firstName} ${req.user?.lastName}`;

    console.log(`Duplicating sales order ${docEntry} by user ${userName}`);

    // Find the original order
    const originalOrder = await SalesOrder.findOne({
      DocEntry: Number.parseInt(docEntry),
    }).populate("salesAgent", "firstName lastName email");

    if (!originalOrder) {
      return res.status(404).json({
        success: false,
        message: "Sales order not found",
      });
    }

    // Get the next DocEntry and DocNum
    const lastOrder = await SalesOrder.findOne().sort({ DocEntry: -1 });
    const nextDocEntry = lastOrder ? lastOrder.DocEntry + 1 : 1;
    const nextDocNum = lastOrder ? lastOrder.DocNum + 1 : 1000;

    console.log(`Generated new duplicate order DocEntry: ${nextDocEntry}`);

    // Create notes for the duplicated order
    const duplicateNotes = `This order was duplicated from order #${originalOrder.DocEntry} by ${userName}. Original order amount: AED ${originalOrder.DocTotal}.`;

    // Process document lines for the duplicate
    const processedDocumentLines = originalOrder.DocumentLines.map(
      (line, index) => ({
        ...(line.toObject ? line.toObject() : line),
        LineNum: index,
        DocEntry: nextDocEntry,
        // Remove MongoDB-specific fields
        _id: undefined,
        // Ensure proper pricing and currency
        Currency: originalOrder.DocCurrency || "AED",
        PriceList: originalOrder.PriceList || 1, // Use price list 1 for AED
      })
    );

    // Create the duplicate order data (but don't save to DB yet)
    const duplicateOrderData = {
      ...originalOrder.toObject(),
      // Remove MongoDB-specific fields
      _id: undefined,
      // New document identifiers
      DocEntry: nextDocEntry,
      DocNum: nextDocNum,
      // Update timestamps
      CreationDate: new Date(),
      UpdateDate: new Date(),
      // Reset document status
      DocumentStatus: "Open",
      // Enhanced document lines
      DocumentLines: processedDocumentLines,
      // Add duplication notes
      Comments: originalOrder.Comments
        ? `${originalOrder.Comments}\n\n${duplicateNotes}`
        : duplicateNotes,
      U_Notes: duplicateNotes,
      // Reset SAP integration fields
      SyncedWithSAP: false,
      LocalStatus: "Created",
      SyncErrors: null,
      LastSyncAttempt: null,
      SAPSyncDisabled: false,
      SAPDocEntry: null,
      // Reset payment status if applicable
      payment_status: "pending",
      Payment_id: "",
      // Clear any conversion references
      OriginatingQuotation: originalOrder.OriginatingQuotation || null,
      BaseType: originalOrder.BaseType || null,
      BaseEntry: originalOrder.BaseEntry || null,
      // Ensure proper currency and pricing
      DocCurrency: originalOrder.DocCurrency || "AED",
      PriceList: originalOrder.PriceList || 1, // Use price list 1 for AED
    };

    console.log("Preparing duplicate order data for SAP push:", {
      DocEntry: duplicateOrderData.DocEntry,
      DocNum: duplicateOrderData.DocNum,
      CardName: duplicateOrderData.CardName,
      DocTotal: duplicateOrderData.DocTotal,
      DocumentLinesCount: duplicateOrderData.DocumentLines.length,
      PriceList: duplicateOrderData.PriceList,
      OriginalDocEntry: originalOrder.DocEntry,
    });

    // Create temporary order object for SAP push (without saving to DB)
    const tempOrder = new SalesOrder(duplicateOrderData);

    // CRITICAL: Push to SAP FIRST before saving to MongoDB
    console.log("🔄 Pushing duplicate order to SAP before MongoDB save...");
    const sapResult = await pushOrderToSAPInternal(tempOrder);

    // Only proceed with MongoDB save if SAP push succeeds
    if (!sapResult.success) {
      console.error("❌ SAP push failed, aborting order duplication");

      // Customize error message based on error code
      let sapErrorMessage = "Failed to sync duplicate order with SAP";
      switch (sapResult.code) {
        case "BP_NOT_FOUND":
        case "INVALID_BP_CODE":
          sapErrorMessage = `Business partner ${duplicateOrderData.CardCode} does not exist in SAP B1`;
          break;
        case "EXCHANGE_RATE_ERROR":
          sapErrorMessage =
            "Exchange rate issue in SAP B1 - please check currency configuration";
          break;
        case "CURRENCY_ERROR":
          sapErrorMessage = "Currency configuration issue in SAP B1";
          break;
        case "CONNECTION_ERROR":
          sapErrorMessage =
            "Could not connect to SAP B1 - please check connection";
          break;
      }

      return res.status(400).json({
        success: false,
        message: "❌ Cannot duplicate sales order: SAP synchronization failed",
        error: sapErrorMessage,
        details: sapResult.error,
        code: sapResult.code,
        originalOrder: {
          DocEntry: originalOrder.DocEntry,
          DocNum: originalOrder.DocNum,
        },
      });
    }

    // SAP push succeeded, now save to MongoDB
    console.log("✅ SAP push successful, proceeding with MongoDB save");

    // Update the order with SAP sync success data
    tempOrder.SyncedWithSAP = true;
    tempOrder.LocalStatus = "Synced";
    tempOrder.SAPDocEntry = sapResult.SAPDocEntry;

    // Save the duplicate order to MongoDB
    const savedOrder = await tempOrder.save();
    console.log(
      `Duplicate sales order created successfully with DocEntry: ${savedOrder.DocEntry}`
    );

    // Populate the order for response
    const populatedOrder = await SalesOrder.findById(savedOrder._id)
      .populate("salesAgent", "firstName lastName email")
      .lean();

    // Return success response
    res.status(201).json({
      success: true,
      message: "✅ Sales order duplicated successfully and synced with SAP",
      data: {
        ...populatedOrder,
        SAPDocEntry: sapResult.SAPDocEntry,
        SyncedWithSAP: true,
        LocalStatus: "Synced",
      },
      originalOrder: {
        DocEntry: originalOrder.DocEntry,
        DocNum: originalOrder.DocNum,
      },
      sapSync: {
        success: true,
        SAPDocEntry: sapResult.SAPDocEntry,
      },
    });
  } catch (error) {
    console.error("Error duplicating sales order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to duplicate sales order",
      error: error.message,
    });
  }
};

// Get sales order statistics
const getSalesOrderStats = async (req, res) => {
  try {
    const { salesAgent, fromDate, toDate } = req.query;

    // Build filter
    const filter = {};
    if (salesAgent) {
      filter.salesAgent = salesAgent;
    }
    if (fromDate && toDate) {
      filter.DocDate = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      };
    }

    const stats = await SalesOrder.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalValue: { $sum: "$DocTotal" },
          openOrders: {
            $sum: { $cond: [{ $eq: ["$DocumentStatus", "Open"] }, 1, 0] },
          },
          closedOrders: {
            $sum: { $cond: [{ $eq: ["$DocumentStatus", "Closed"] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$DocumentStatus", "Cancelled"] }, 1, 0] },
          },
          averageOrderValue: { $avg: "$DocTotal" },
        },
      },
    ]);

    const orderStats =
      stats.length > 0
        ? stats[0]
        : {
            totalOrders: 0,
            totalValue: 0,
            openOrders: 0,
            closedOrders: 0,
            cancelledOrders: 0,
            averageOrderValue: 0,
          };

    res.status(200).json({
      success: true,
      data: {
        totalOrders: orderStats.totalOrders,
        totalValue: parseFloat((orderStats.totalValue || 0).toFixed(2)),
        openOrders: orderStats.openOrders,
        closedOrders: orderStats.closedOrders,
        cancelledOrders: orderStats.cancelledOrders,
        averageOrderValue: parseFloat(
          (orderStats.averageOrderValue || 0).toFixed(2)
        ),
      },
    });
  } catch (error) {
    console.error("Error fetching sales order statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales order statistics",
      error: error.message,
    });
  }
};

module.exports = {
  createSalesOrder,
  getSalesOrdersByCustomer,
  getAllSalesOrders,
  getSalesOrderById,
  getSalesOrderByDocEntry,
  updateSalesOrder,
  cancelSalesOrder,
  duplicateSalesOrder,
  getSalesOrderStats,
  getAllSalesOrdersWithSAPStatus,
  pushOrderToSAP,
};
