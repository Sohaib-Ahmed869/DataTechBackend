const Quotation = require("../models/Quotation.model");
const Customer = require("../models/Customer.model");
const Task = require("../models/Task.model");
const Item = require("../models/items.model");
const quotationService = require("../utils/quotationService");
const emailService = require("../utils/emailService");
const pdfGenerator = require("../utils/pdfGenerator");
const SalesOrder = require("../models/SalesOrder.model");
const {
  formatOrderForSAP,
  createSalesOrderInSAP,
  checkBusinessPartnerExists,
  testSAPConnection: testSAPConnectionUtil,
} = require("../utils/sapB1Integration");

// Get quotations for a specific customer
const getCustomerQuotations = async (req, res) => {
  try {
    const { cardCode } = req.params;
    const quotations = await Quotation.find({ CardCode: cardCode })
      .populate("salesAgent", "firstName lastName email")
      .sort({ DocDate: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: quotations,
    });
  } catch (error) {
    console.error("Error fetching customer quotations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer quotations",
      error: error.message,
    });
  }
};

// Get single quotation by DocEntry
const getQuotationByDocEntry = async (req, res) => {
  try {
    const { docEntry } = req.params;
    const quotation = await Quotation.findOne({ DocEntry: docEntry })
      .populate("salesAgent", "firstName lastName email")
      .lean();

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    res.status(200).json({
      success: true,
      data: quotation,
    });
  } catch (error) {
    console.error("Error fetching quotation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch quotation",
      error: error.message,
    });
  }
};

// Enhanced Convert quotation to order with complete item data
const convertToOrder = async (req, res) => {
  try {
    const { docEntry } = req.params;
    const userId = req.user?._id;
    const userRole = req.user?.role;
    const userName = `${req.user?.firstName} ${req.user?.lastName}`;

    console.log(
      `Converting quotation ${docEntry} to order by user ${userName}`
    );

    // Find the quotation
    const quotation = await Quotation.findOne({
      DocEntry: docEntry,
      IsActive: true,
    }).populate("salesAgent", "firstName lastName email");

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: `Active quotation with DocEntry ${docEntry} not found`,
      });
    }

    // Check if quotation is approved
    if (quotation.approvalStatus !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Quotation must be approved before conversion to order",
      });
    }

    // Check permissions for sales agents
    if (
      userRole === "data_tech_sales_agent" &&
      quotation.salesAgent &&
      quotation.salesAgent._id.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to convert this quotation",
      });
    }

    // Check if already converted
    if (quotation.ConvertedToOrderDocEntry) {
      return res.status(400).json({
        success: false,
        message: `Quotation already converted to order #${quotation.ConvertedToOrderDocEntry}`,
      });
    }

    // Generate DocEntry for the new order
    const lastOrder = await SalesOrder.findOne().sort({ DocEntry: -1 });
    const newDocEntry = lastOrder ? lastOrder.DocEntry + 1 : 10000;
    const newDocNum = newDocEntry;

    console.log(`Generated new order DocEntry: ${newDocEntry}`);

    // Create notes for the order
    const orderNotes = `This order was created from quotation #${quotation.DocEntry} by ${userName}. Original quotation amount: AED ${quotation.DocTotal}.`;

    // Prepare quotation data
    const quotationData = quotation.toObject();

    // Enhanced document lines processing with complete item data
    const processedDocumentLines = await Promise.all(
      quotationData.DocumentLines.map(async (line, index) => {
        let completeItemData = {};

        // Check if we have stored item data in the line itself (from quotation creation)
        if (line.ItemCode) {
          try {
            // Try to find item by ItemCode in the database
            const itemFromDB = await Item.findOne({
              ItemCode: line.ItemCode,
            }).lean();

            if (itemFromDB) {
              completeItemData = {
                // SAP B1 required fields
                ItemCode: itemFromDB.ItemCode,
                ItemName: itemFromDB.ItemName,
                ItemDescription: itemFromDB.ForeignName || itemFromDB.ItemName,
                // SAP item classification
                ItemType: itemFromDB.ItemType || "itItems",
                ItemsGroupCode: itemFromDB.ItmsGrpCod,
                ItemsGroupName: itemFromDB.ItmsGrpNam,
                // Inventory data
                OnHand: itemFromDB.OnHand || 0,
                IsCommited: itemFromDB.IsCommited || 0,
                OnOrder: itemFromDB.OnOrder || 0,
                // Pricing and costing
                AvgPrice: itemFromDB.AvgPrice,
                LastPurchasePrice: itemFromDB.LastPurchasePrice,
                // VAT and tax information
                VatGourpSa: itemFromDB.VatGourpSa || "A1",
                // UoM information
                SalUnitMsr: itemFromDB.SalUnitMsr || "EA",
                PurUnitMsr: itemFromDB.PurUnitMsr || "EA",
                // Additional SAP fields
                ManBtchNum: itemFromDB.ManBtchNum || "tNO",
                ManSerNum: itemFromDB.ManSerNum || "tNO",
                // Custom fields
                U_ItemCategory: itemFromDB.U_ItemCategory,
                U_ItemSubCategory: itemFromDB.U_ItemSubCategory,
                // Warehouse information
                DfltWH: itemFromDB.DfltWH || "01",
              };
            }
          } catch (itemError) {
            console.warn(
              `Could not fetch item data for ItemCode ${line.ItemCode}:`,
              itemError.message
            );
          }
        }

        // Merge quotation line data with complete item data
        return {
          LineNum: index,
          // Core line data from quotation
          ItemCode: line.ItemCode,
          ItemName: line.ItemName || completeItemData.ItemName,
          ItemDescription:
            line.ItemDescription || completeItemData.ItemDescription,
          Quantity: line.Quantity || 1,
          Price: line.Price || 0,
          LineTotal: (line.Quantity || 1) * (line.Price || 0),
          // Enhanced data from database item
          ...completeItemData,
          // Quotation-specific overrides (these take precedence)
          Price: line.Price || completeItemData.AvgPrice || 0,
          Currency: quotationData.DocCurrency || "AED",
          // SAP B1 specific fields
          VatGroup: completeItemData.VatGourpSa || "A1",
          UoMCode: completeItemData.SalUnitMsr || "EA",
          UoMEntry: 1,
          // Warehouse and inventory
          WarehouseCode: completeItemData.DfltWH || "01",
          // Pricing list
          PriceList: quotationData.PriceList || 1, // Use price list 1 for AED
          // Line type
          LineType: "Item",
          // Reference to original quotation line
          BaseType: 23,
          BaseEntry: quotation.DocEntry,
          BaseLine: index,
          // Remove MongoDB-specific fields
          _id: undefined,
        };
      })
    );

    // Create the sales order data (but don't save to DB yet)
    const orderData = {
      // Basic document info
      DocEntry: newDocEntry,
      DocNum: newDocNum,
      DocType: "dDocument_Items",
      DocDate: req.body.DocDate || new Date(),
      DocDueDate: req.body.DocDueDate || quotation.DocDueDate || new Date(),
      CreationDate: new Date(),
      UpdateDate: new Date(),
      // Customer info
      CardCode: quotation.CardCode,
      CardName: quotation.CardName,
      Address: quotation.Address || "",
      // Financial info
      DocTotal: quotation.DocTotal,
      DocCurrency: quotation.DocCurrency || "AED",
      PriceList: 1, // Use price list 1 for AED currency
      // Enhanced document lines with complete item data
      DocumentLines: processedDocumentLines,
      // Comments and notes
      Comments: quotation.Comments || "",
      U_Notes: orderNotes,
      // Sales agent
      salesAgent: quotation.salesAgent._id,
      // Reference to original quotation
      OriginatingQuotation: quotation.DocEntry,
      BaseType: 23,
      BaseEntry: quotation.DocEntry,
      // SAP Integration fields
      SyncedWithSAP: false,
      LocalStatus: "Created",
      SyncErrors: null,
      LastSyncAttempt: null,
      SAPSyncDisabled: false,
      // Payment fields (if applicable)
      payment_status: quotation.payment_status || "pending",
      Payment_id: quotation.Payment_id || "",
      // Override with any additional data from request body
      ...req.body,
      // Ensure critical fields are not overridden
      DocEntry: newDocEntry,
      DocNum: newDocNum,
      OriginatingQuotation: quotation.DocEntry,
    };

    console.log("Preparing order data for SAP push:", {
      DocEntry: orderData.DocEntry,
      DocNum: orderData.DocNum,
      CardName: orderData.CardName,
      DocTotal: orderData.DocTotal,
      DocumentLinesCount: orderData.DocumentLines.length,
      PriceList: orderData.PriceList,
    });

    // Create temporary order object for SAP push (without saving to DB)
    const tempOrder = new SalesOrder(orderData);

    // CRITICAL: Push to SAP FIRST before saving to MongoDB
    console.log("🔄 Pushing order to SAP before MongoDB conversion...");
    const sapResult = await pushOrderToSAPInternal(tempOrder);

    // Only proceed with MongoDB conversion if SAP push succeeds
    if (!sapResult.success) {
      console.error("❌ SAP push failed, aborting quotation conversion");

      // Customize error message based on error code
      let sapErrorMessage = "Failed to sync with SAP";
      switch (sapResult.code) {
        case "BP_NOT_FOUND":
        case "INVALID_BP_CODE":
          sapErrorMessage = `Business partner ${quotation.CardCode} does not exist in SAP B1`;
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
        message:
          "❌ Cannot convert quotation to order: SAP synchronization failed",
        error: sapErrorMessage,
        details: sapResult.error,
        code: sapResult.code,
        quotation: {
          DocEntry: quotation.DocEntry,
          status: "Active", // Quotation remains active
        },
      });
    }

    // SAP push succeeded, now save to MongoDB
    console.log("✅ SAP push successful, proceeding with MongoDB conversion");

    // Update the order with SAP sync success data
    tempOrder.SyncedWithSAP = true;
    tempOrder.LocalStatus = "Synced";
    tempOrder.SAPDocEntry = sapResult.SAPDocEntry;

    // Save the order to MongoDB
    await tempOrder.save();
    console.log(
      `Sales order created successfully with DocEntry: ${tempOrder.DocEntry}`
    );

    // Update the quotation to mark it as converted (only after successful SAP push)
    quotation.IsActive = false;
    quotation.ConvertedToOrderDocEntry = tempOrder.DocEntry;
    quotation.ConvertedDate = new Date();
    quotation.UpdateDate = new Date();
    await quotation.save();
    console.log(`Quotation ${docEntry} marked as converted`);

    // Update the associated task if it exists
    if (quotation.approvalTask) {
      await Task.findByIdAndUpdate(quotation.approvalTask, {
        status: "completed",
        completedDate: new Date(),
        metadata: {
          convertedToOrder: tempOrder.DocEntry,
          convertedBy: userId,
          convertedDate: new Date().toISOString(),
        },
      });
      console.log(`Updated associated task: ${quotation.approvalTask}`);
    }

    // Populate the order for response
    const populatedOrder = await SalesOrder.findById(tempOrder._id)
      .populate("salesAgent", "firstName lastName email")
      .lean();

    // Return success response
    res.status(201).json({
      success: true,
      message:
        "✅ Quotation successfully converted to order and synced with SAP",
      data: {
        order: {
          ...populatedOrder,
          SAPDocEntry: sapResult.SAPDocEntry,
          SyncedWithSAP: true,
          LocalStatus: "Synced",
        },
        originalQuotation: {
          DocEntry: quotation.DocEntry,
          status: "Converted",
          convertedDate: quotation.ConvertedDate,
        },
      },
      sapSync: {
        success: true,
        SAPDocEntry: sapResult.SAPDocEntry,
      },
    });
  } catch (error) {
    console.error("Error converting quotation to order:", error);
    res.status(500).json({
      success: false,
      message: "Error converting quotation to order",
      error: error.message,
    });
  }
};

// Internal function to push order to SAP (reused from sales order controller)
async function pushOrderToSAPInternal(order) {
  try {
    console.log("🚀 Starting SAP integration for order:", order.DocEntry);

    // Skip connection test for now - go directly to business partner check
    console.log(
      "⏭️ Skipping connection test, proceeding with business partner check..."
    );

    // Check if business partner exists in SAP
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
      console.warn(
        `Could not verify business partner in SAP: ${bpError.message}`
      );
      // Continue anyway - let the order creation attempt reveal the issue
    }

    // Format the order for SAP B1
    const sapOrder = await formatOrderForSAP(order);

    // Push to SAP B1
    const sapResponse = await createSalesOrderInSAP(sapOrder);

    // Update local order with SAP DocEntry if successful
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
    } else if (error.message.includes("Invalid BP code")) {
      errorCode = "INVALID_BP_CODE";
    } else if (error.message.includes("exchange rate")) {
      errorCode = "EXCHANGE_RATE_ERROR";
    } else if (error.message.includes("currency")) {
      errorCode = "CURRENCY_ERROR";
    } else if (error.message.includes("connection")) {
      errorCode = "CONNECTION_ERROR";
    }

    // Update local order to mark sync failure
    order.SyncErrors = error.message;
    order.LastSyncAttempt = new Date();
    order.LocalStatus = "SyncFailed";

    // Disable automatic sync for certain error types
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

// Enhanced Create new quotation - stores item data in quotation lines without changing model
const createQuotation = async (req, res) => {
  const userId = req.user?._id;
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

    // Enhanced document lines processing to include complete item data
    const enhancedDocumentLines = await Promise.all(
      DocumentLines.map(async (line, index) => {
        let enhancedLine = {
          LineNum: index,
          // Core quotation line data
          ItemCode: line.ItemCode,
          ItemName: line.ItemName,
          ItemDescription: line.ItemDescription,
          Quantity: line.Quantity || 1,
          Price: line.Price || 0,
          LineTotal: (line.Quantity || 1) * (line.Price || 0),
          LineType: line.LineType || "Item",
          // Copy any existing line data
          ...line,
        };

        // If ItemCode is provided, fetch complete item data from database and store it in the line
        if (line.ItemCode) {
          try {
            const itemFromDB = await Item.findOne({
              ItemCode: line.ItemCode,
            }).lean();
            if (itemFromDB) {
              // Store complete item data directly in the document line for future use
              enhancedLine = {
                ...enhancedLine,
                // Store database item reference (not changing model, just storing data)
                ItemName: itemFromDB.ItemName,
                ItemDescription: itemFromDB.ForeignName || itemFromDB.ItemName,
                // Store SAP-specific fields that will be needed during conversion
                ItemType: itemFromDB.ItemType,
                ItmsGrpCod: itemFromDB.ItmsGrpCod,
                ItmsGrpNam: itemFromDB.ItmsGrpNam,
                VatGourpSa: itemFromDB.VatGourpSa,
                SalUnitMsr: itemFromDB.SalUnitMsr,
                PurUnitMsr: itemFromDB.PurUnitMsr,
                DfltWH: itemFromDB.DfltWH,
                ManBtchNum: itemFromDB.ManBtchNum,
                ManSerNum: itemFromDB.ManSerNum,
                // Inventory information
                OnHand: itemFromDB.OnHand,
                IsCommited: itemFromDB.IsCommited,
                OnOrder: itemFromDB.OnOrder,
                // Pricing information
                AvgPrice: itemFromDB.AvgPrice,
                LastPurchasePrice: itemFromDB.LastPurchasePrice,
                // Custom fields
                U_ItemCategory: itemFromDB.U_ItemCategory,
                U_ItemSubCategory: itemFromDB.U_ItemSubCategory,
                // Store item database ID as a string for reference
                itemDbId: itemFromDB._id.toString(),
              };
            }
          } catch (itemError) {
            console.warn(
              `Could not fetch item data for ItemCode ${line.ItemCode}:`,
              itemError.message
            );
          }
        }

        return enhancedLine;
      })
    );

    // Prepare enhanced quotation data
    const quotationData = {
      CardCode,
      CardName,
      DocDate,
      DocDueDate,
      Comments,
      DocumentLines: enhancedDocumentLines, // Use enhanced document lines
      DocTotal: DocTotal || 0,
      DocCurrency: "AED", // Set default currency to AED
      salesAgent: salesAgent || userId,
      assignedTo: userId,
    };

    console.log("Creating quotation with enhanced item data:", {
      CardCode,
      CardName,
      DocumentLinesCount: enhancedDocumentLines.length,
      SampleLineData: enhancedDocumentLines[0],
    });

    // Create quotation with task using our unified service
    const result = await quotationService.createQuotationWithTask(
      quotationData,
      userId
    );

    res.status(201).json({
      success: true,
      message:
        "Quotation and approval task created successfully with enhanced item data",
      data: result.data,
      task: result.task,
    });
  } catch (error) {
    console.error("Error creating quotation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create quotation",
      error: error.message,
    });
  }
};

// Cancel quotation
const cancelQuotation = async (req, res) => {
  try {
    const { docEntry } = req.params;
    const { reason } = req.body;

    const quotation = await Quotation.findOneAndUpdate(
      { DocEntry: docEntry },
      {
        IsActive: false,
        CancelReason: reason || "Cancelled by user",
        CancelDate: new Date(),
        UpdateDate: new Date(),
      },
      { new: true }
    )
      .populate("salesAgent", "firstName lastName email")
      .lean();

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Quotation cancelled successfully",
      data: quotation,
    });
  } catch (error) {
    console.error("Error cancelling quotation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel quotation",
      error: error.message,
    });
  }
};

// Duplicate quotation
const duplicateQuotation = async (req, res) => {
  const userId = req.user?._id;
  try {
    const { docEntry } = req.params;

    // Find the original quotation
    const originalQuotation = await Quotation.findOne({
      DocEntry: docEntry,
    }).lean();

    if (!originalQuotation) {
      return res.status(404).json({
        success: false,
        message: "Original quotation not found",
      });
    }

    // Generate new DocEntry
    const lastQuotation = await Quotation.findOne().sort({ DocEntry: -1 });
    const newDocEntry = lastQuotation ? lastQuotation.DocEntry + 1 : 1;

    // Create duplicate data - remove fields that shouldn't be duplicated
    const duplicateData = {
      ...originalQuotation,
      _id: undefined, // Remove the original ID
      DocEntry: newDocEntry,
      DocNum: newDocEntry,
      DocDate: new Date(),
      CreationDate: new Date(),
      UpdateDate: new Date(),
      DuplicatedFrom: docEntry, // Track the original quotation
      IsActive: true,
      approvalStatus: "awaiting_approval",
      approvalTask: undefined, // Remove original task reference
      ConvertedToOrderDocEntry: undefined,
      ConvertedDate: undefined,
      // Ensure the current user is assigned
      salesAgent: originalQuotation.salesAgent || userId,
      assignedTo: userId,
    };

    // Create the duplicate quotation with task using the same service
    const result = await quotationService.createQuotationWithTask(
      duplicateData,
      userId
    );

    res.status(201).json({
      success: true,
      message: "Quotation duplicated and approval task created successfully",
      data: result.data,
      task: result.task,
    });
  } catch (error) {
    console.error("Error duplicating quotation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to duplicate quotation",
      error: error.message,
    });
  }
};

// Get quotation statistics
const getQuotationStats = async (req, res) => {
  try {
    const { fromDate, toDate, salesAgent } = req.query;
    const userId = req.user?._id;
    const userRole = req.user?.role;

    // Build filter object
    const filter = { IsActive: true };

    // Role-based filtering
    if (userRole === "datatech_sales_agent") {
      filter.salesAgent = userId;
    } else if (salesAgent) {
      filter.salesAgent = salesAgent;
    }

    // Date range filter
    if (fromDate || toDate) {
      filter.DocDate = {};
      if (fromDate) filter.DocDate.$gte = new Date(fromDate);
      if (toDate) filter.DocDate.$lte = new Date(toDate);
    }

    // Get statistics
    const totalQuotations = await Quotation.countDocuments(filter);
    const totalValueResult = await Quotation.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: "$DocTotal" } } },
    ]);

    const totalValue =
      totalValueResult.length > 0 ? totalValueResult[0].total : 0;

    const awaitingApproval = await Quotation.countDocuments({
      ...filter,
      approvalStatus: "awaiting_approval",
    });

    const approved = await Quotation.countDocuments({
      ...filter,
      approvalStatus: "approved",
    });

    const rejected = await Quotation.countDocuments({
      ...filter,
      approvalStatus: "rejected",
    });

    const converted = await Quotation.countDocuments({
      ...filter,
      ConvertedToOrderDocEntry: { $exists: true },
    });

    res.status(200).json({
      success: true,
      data: {
        totalQuotations,
        totalValue,
        awaitingApproval,
        approved,
        rejected,
        converted,
      },
    });
  } catch (error) {
    console.error("Error fetching quotation stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch quotation statistics",
      error: error.message,
    });
  }
};

// Send quotation by email
const sendQuotationByEmail = async (req, res) => {
  try {
    console.log("Received request to send quotation by email", req.body);
    const { docEntry } = req.params;
    const emailData = req.body;

    if (!emailData || !emailData.to) {
      return res.status(400).json({
        success: false,
        message: "Recipient email address is required",
      });
    }

    console.log(
      `Processing quotation ${docEntry} for email to ${emailData.to}`
    );

    // Find the quotation
    const quotation = await Quotation.findOne({
      DocEntry: docEntry,
    }).populate("salesAgent", "firstName lastName email");

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: `Quotation with ID ${docEntry} not found`,
      });
    }

    // Prepare customer data
    const customerForTemplate = {
      CardName: quotation.CardName || "Valued Customer",
      street: "",
      city: "",
      zipCode: "",
      Country: "",
      Phone: "",
    };

    console.log("Prepared customer template data:", customerForTemplate);

    // Generate PDF
    console.log("Generating PDF...");
    let pdfBuffer;
    try {
      pdfBuffer = await pdfGenerator.generateQuotationPDF(
        quotation,
        customerForTemplate
      );
      console.log(`PDF generated successfully: ${pdfBuffer.length} bytes`);
    } catch (pdfError) {
      console.error("Error generating PDF:", pdfError);
      return res.status(500).json({
        success: false,
        message: `Error generating PDF: ${pdfError.message}`,
      });
    }

    // Send email with attachment
    console.log("Sending email with PDF attachment...");
    try {
      const emailText =
        emailData.message ||
        `Dear ${quotation.CardName},\n\nPlease find attached your quotation #${quotation.DocNum}.\n\nThank you for your interest in our services.\n\nBest regards,\nDataTech Solutions Team`;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">DataTech Solutions</h1>
            <p style="margin: 5px 0 0 0;">Your Technology Partner</p>
          </div>
          <div style="padding: 30px 20px;">
            <h2 style="color: #2563eb; margin-bottom: 20px;">Quotation #${
              quotation.DocNum
            }</h2>
            <p>Dear ${quotation.CardName},</p>
            <p>Please find attached your quotation for the services you requested.</p>
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <h3 style="color: #2563eb; margin-top: 0;">Quotation Details:</h3>
              <p><strong>Quotation Number:</strong> #${quotation.DocNum}</p>
              <p><strong>Date:</strong> ${new Date(
                quotation.DocDate
              ).toLocaleDateString()}</p>
              <p><strong>Valid Until:</strong> ${new Date(
                quotation.DocDueDate
              ).toLocaleDateString()}</p>
              <p><strong>Total Amount:</strong> AED ${quotation.DocTotal}</p>
            </div>
            <p>${
              emailData.message ||
              "Thank you for your interest in our services. We look forward to working with you."
            }</p>
            <p>If you have any questions, please don't hesitate to contact us.</p>
            <p>Best regards,<br>
            <strong>DataTech Solutions Team</strong></p>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              DataTech Solutions | info@datatech.ie | www.datatech.ie
            </p>
          </div>
        </div>
      `;

      const info = await emailService.sendEmail({
        to: emailData.to,
        cc: emailData.cc || "",
        subject:
          emailData.subject ||
          `Quotation #${quotation.DocNum} - DataTech Solutions`,
        text: emailText,
        html: emailHtml,
        attachments: [
          {
            filename: `DataTech_Quotation_${quotation.DocNum}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
            encoding: "binary",
          },
        ],
      });

      // Record email sent
      quotation.emailSentTo = quotation.emailSentTo || [];
      quotation.emailSentTo.push({
        email: emailData.to,
        sentBy: req.user._id,
        sentDate: new Date(),
        messageId: info.messageId,
      });
      await quotation.save();

      return res.status(200).json({
        success: true,
        message: "Email sent successfully",
        messageId: info.messageId,
        data: {
          quotationNumber: quotation.DocNum,
          customer: quotation.CardName,
          sentTo: emailData.to,
          sentDate: new Date(),
        },
      });
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      return res.status(500).json({
        success: false,
        message: `Error sending email: ${emailError.message}`,
      });
    }
  } catch (error) {
    console.error("Error in sendQuotationByEmail:", error);
    return res.status(500).json({
      success: false,
      message: `An unexpected error occurred: ${error.message}`,
    });
  }
};

// Generate payment link
const generatePaymentLink = async (req, res) => {
  try {
    const { docNum } = req.params;
    const quotation = await Quotation.findOne({ DocNum: docNum });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    if (quotation.approvalStatus !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Quotation must be approved before generating payment link",
      });
    }

    // Generate a unique payment ID
    const paymentId = `PAY_${docNum}_${Date.now()}`;

    // Here you would integrate with your payment provider
    const paymentLink = `https://your-payment-provider.com/pay/${paymentId}`;

    // Update quotation with payment info
    await Quotation.findOneAndUpdate(
      { DocNum: docNum },
      {
        Payment_id: paymentId,
        paymentLink: paymentLink,
        paymentStatus: "pending",
        paymentLinkGeneratedDate: new Date(),
        UpdateDate: new Date(),
      }
    );

    res.status(200).json({
      success: true,
      message: "Payment link generated and sent to customer successfully",
      data: {
        paymentId,
        paymentLink,
        quotationNumber: docNum,
        customer: quotation.CardName,
        amount: quotation.DocTotal,
      },
    });
  } catch (error) {
    console.error("Error generating payment link:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate payment link",
      error: error.message,
    });
  }
};

// Get payment status
const getPaymentStatus = async (req, res) => {
  try {
    const { docNum } = req.params;
    const quotation = await Quotation.findOne({ DocNum: docNum });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    if (!quotation.Payment_id) {
      return res.status(400).json({
        success: false,
        message: "No payment link generated for this quotation",
      });
    }

    const paymentStatus = quotation.paymentStatus || "pending";

    res.status(200).json({
      success: true,
      data: {
        paymentId: quotation.Payment_id,
        paymentStatus,
        paymentLink: quotation.paymentLink,
      },
    });
  } catch (error) {
    console.error("Error checking payment status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check payment status",
      error: error.message,
    });
  }
};

// Export quotations to CSV
const exportQuotations = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    const {
      search,
      status,
      cardCode,
      fromDate,
      toDate,
      salesAgent,
      showInactive,
    } = req.query;

    // Build filter object
    const filter = {};

    // Role-based filtering
    if (userRole === "datatech_sales_agent") {
      filter.salesAgent = userId;
    } else if (salesAgent) {
      filter.salesAgent = salesAgent;
    }

    // Apply other filters
    if (cardCode) filter.CardCode = { $regex: cardCode, $options: "i" };
    if (status) {
      if (status === "pending") {
        filter.approvalStatus = "pending";
      } else if (status === "approved") {
        filter.approvalStatus = "approved";
      } else if (status === "rejected") {
        filter.approvalStatus = "rejected";
      } else if (status === "active") {
        filter.IsActive = true;
      } else if (status === "converted") {
        filter.ConvertedToOrderDocEntry = { $exists: true };
      } else if (status === "cancelled") {
        filter.IsActive = false;
      }
    }

    if (!showInactive) {
      filter.IsActive = true;
    }

    if (fromDate || toDate) {
      filter.DocDate = {};
      if (fromDate) filter.DocDate.$gte = new Date(fromDate);
      if (toDate) filter.DocDate.$lte = new Date(toDate);
    }

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      const searchNumber = Number.parseInt(search) || 0;
      filter.$or = [
        { CardName: searchRegex },
        { CardCode: searchRegex },
        { Comments: searchRegex },
        ...(searchNumber > 0 ? [{ DocNum: searchNumber }] : []),
      ];
    }

    const quotations = await Quotation.find(filter)
      .populate("salesAgent", "firstName lastName email")
      .sort({ DocDate: -1 })
      .lean();

    // Convert to CSV format
    const csvHeader =
      "DocNum,CardCode,CardName,DocTotal,DocDate,ApprovalStatus,SalesAgent\n";
    const csvData = quotations
      .map(
        (q) =>
          `${q.DocNum},${q.CardCode},"${q.CardName}",${q.DocTotal},${
            q.DocDate?.toISOString().split("T")[0]
          },${q.approvalStatus},"${q.salesAgent?.firstName} ${
            q.salesAgent?.lastName
          }"`
      )
      .join("\n");

    const csv = csvHeader + csvData;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=quotations.csv");
    res.status(200).send(csv);
  } catch (error) {
    console.error("Error exporting quotations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export quotations",
      error: error.message,
    });
  }
};

// Bulk approve quotations
const bulkApproveQuotations = async (req, res) => {
  try {
    const { docEntries, comments } = req.body;

    if (!docEntries || docEntries.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No quotations selected for approval",
      });
    }

    const updateResult = await Quotation.updateMany(
      { DocEntry: { $in: docEntries } },
      {
        approvalStatus: "approved",
        approvedBy: req.user?.id,
        approvedDate: new Date(),
        approvalComments: comments,
        UpdateDate: new Date(),
      }
    );

    res.status(200).json({
      success: true,
      message: `${updateResult.modifiedCount} quotations approved successfully`,
      data: {
        approvedCount: updateResult.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Error bulk approving quotations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to bulk approve quotations",
      error: error.message,
    });
  }
};

// Bulk reject quotations
const bulkRejectQuotations = async (req, res) => {
  try {
    const { docEntries, reason } = req.body;

    if (!docEntries || docEntries.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No quotations selected for rejection",
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const updateResult = await Quotation.updateMany(
      { DocEntry: { $in: docEntries } },
      {
        approvalStatus: "rejected",
        rejectedBy: req.user?.id,
        rejectedDate: new Date(),
        rejectionReason: reason,
        UpdateDate: new Date(),
      }
    );

    res.status(200).json({
      success: true,
      message: `${updateResult.modifiedCount} quotations rejected successfully`,
      data: {
        rejectedCount: updateResult.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Error bulk rejecting quotations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to bulk reject quotations",
      error: error.message,
    });
  }
};

// Get all quotations with filtering
const getAllQuotations = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    const { status, salesAgent, page = 1, limit = 10 } = req.query;

    // Build filter
    const filter = { IsActive: true };

    // Role-based filtering
    if (userRole === "data_tech_sales_agent") {
      filter.salesAgent = userId;
    }

    // Status filtering
    if (status) {
      filter.approvalStatus = status;
    }

    // Sales agent filtering (admin only)
    if (salesAgent && userRole === "data_tech_admin") {
      filter.salesAgent = salesAgent;
    }

    const skip = (page - 1) * limit;

    const quotations = await Quotation.find(filter)
      .populate("salesAgent", "firstName lastName email")
      .populate("approvalTask")
      .populate("approvedBy", "firstName lastName email")
      .populate("rejectedBy", "firstName lastName email")
      .sort({ CreationDate: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))
      .lean();

    const total = await Quotation.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: quotations,
      pagination: {
        current: Number.parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalQuotations: total,
      },
    });
  } catch (error) {
    console.error("Error fetching quotations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch quotations",
      error: error.message,
    });
  }
};

// Get single quotation
const getQuotationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    const userRole = req.user?.role;

    const quotation = await Quotation.findById(id)
      .populate("salesAgent", "firstName lastName email")
      .populate("approvalTask")
      .populate("approvedBy", "firstName lastName email")
      .populate("rejectedBy", "firstName lastName email")
      .lean();

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    // Check permissions
    if (
      userRole === "data_tech_sales_agent" &&
      quotation.salesAgent._id.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.status(200).json({
      success: true,
      data: quotation,
    });
  } catch (error) {
    console.error("Error fetching quotation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch quotation",
      error: error.message,
    });
  }
};

const updateQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      CardCode,
      CardName,
      DocDate,
      DocDueDate,
      Comments,
      DocumentLines,
      DocTotal,
      salesAgent,
      IsActive,
      approvalStatus,
      approvalTask,
    } = req.body;

    const updatedQuotation = await Quotation.findByIdAndUpdate(
      id,
      {
        CardCode,
        CardName,
        DocDate,
        DocDueDate,
        Comments,
        DocumentLines,
        DocTotal,
        salesAgent,
        UpdateDate: new Date(),
        IsActive,
        approvalStatus,
        approvalTask,
      },
      { new: true }
    )
      .populate("salesAgent", "firstName lastName email")
      .populate("approvalTask")
      .lean();

    if (!updatedQuotation) {
      return res
        .status(404)
        .json({ success: false, message: "Quotation not found" });
    }

    res.status(200).json({
      success: true,
      message: "Quotation updated successfully",
      data: updatedQuotation,
    });
  } catch (error) {
    console.error("Error updating quotation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update quotation",
      error: error.message,
    });
  }
};

const deleteQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedQuotation = await Quotation.findByIdAndDelete(id).lean();

    if (!deletedQuotation) {
      return res
        .status(404)
        .json({ success: false, message: "Quotation not found" });
    }

    res.status(200).json({
      success: true,
      message: "Quotation deleted successfully",
      data: deletedQuotation,
    });
  } catch (error) {
    console.error("Error deleting quotation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete quotation",
      error: error.message,
    });
  }
};

// Approve quotation
const approveQuotation = async (req, res) => {
  try {
    const { docEntry } = req.params;
    const { comments } = req.body;
    const userId = req.user?._id;

    const quotation = await Quotation.findOne({ DocEntry: docEntry });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    // Update quotation
    const updatedQuotation = await Quotation.findOneAndUpdate(
      { DocEntry: docEntry },
      {
        approvalStatus: "approved",
        approvedBy: userId,
        approvedDate: new Date(),
        approvalComments: comments,
        UpdateDate: new Date(),
      },
      { new: true }
    )
      .populate("salesAgent", "firstName lastName email")
      .populate("approvedBy", "firstName lastName email")
      .lean();

    // Update associated task if exists
    if (quotation.approvalTask) {
      await Task.findByIdAndUpdate(quotation.approvalTask, {
        status: "approved",
        approvedBy: userId,
        approvedDate: new Date(),
        approvalComments: comments,
      });
    }

    res.status(200).json({
      success: true,
      message: "Quotation approved successfully",
      data: updatedQuotation,
    });
  } catch (error) {
    console.error("Error approving quotation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve quotation",
      error: error.message,
    });
  }
};

// Reject quotation
const rejectQuotation = async (req, res) => {
  try {
    const { docEntry } = req.params;
    const { reason } = req.body;
    const userId = req.user?._id;

    const quotation = await Quotation.findOne({ DocEntry: docEntry });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    // Update quotation
    const updatedQuotation = await Quotation.findOneAndUpdate(
      { DocEntry: docEntry },
      {
        approvalStatus: "rejected",
        rejectedBy: userId,
        rejectedDate: new Date(),
        rejectionReason: reason,
        UpdateDate: new Date(),
      },
      { new: true }
    )
      .populate("salesAgent", "firstName lastName email")
      .populate("rejectedBy", "firstName lastName email")
      .lean();

    // Update associated task if exists
    if (quotation.approvalTask) {
      await Task.findByIdAndUpdate(quotation.approvalTask, {
        status: "rejected",
        rejectedBy: userId,
        rejectedDate: new Date(),
        rejectionReason: reason,
        completedDate: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      message: "Quotation rejected successfully",
      data: updatedQuotation,
    });
  } catch (error) {
    console.error("Error rejecting quotation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject quotation",
      error: error.message,
    });
  }
};

module.exports = {
  getAllQuotations,
  getCustomerQuotations,
  getQuotationByDocEntry,
  createQuotation,
  updateQuotation,
  convertToOrder,
  cancelQuotation,
  duplicateQuotation,
  approveQuotation,
  getQuotationStats,
  rejectQuotation,
  sendQuotationByEmail,
  generatePaymentLink,
  getPaymentStatus,
  exportQuotations,
  bulkApproveQuotations,
  bulkRejectQuotations,
};
