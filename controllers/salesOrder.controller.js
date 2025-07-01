const SalesOrder = require("../models/SalesOrder.model");
const Customer = require("../models/Customer.model");

// Create a new sales order
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

    // Create new sales order
    const newSalesOrder = new SalesOrder({
      DocEntry: nextDocEntry,
      DocNum: nextDocNum,
      DocType: "dDocument_Items",
      DocDate: DocDate || new Date(),
      DocDueDate: DocDueDate || validUntilDate || new Date(),
      CardCode,
      CardName,
      Comments,
      DocumentLines: DocumentLines.map((line, index) => ({
        ...line,
        LineNum: index,
        DocEntry: nextDocEntry,
      })),
      DocTotal: DocTotal || 0,
      DocumentStatus: "Open",
      salesAgent: salesAgent || req.user?.id,
      CreationDate: new Date(),
      UpdateDate: new Date(),
      UserSign: req.user?.id || 1,
      PriceList: 2, // Default to Prix Livraison
      LocalStatus: "Created",
      SyncedWithSAP: false,
    });

    const savedOrder = await newSalesOrder.save();

    // Populate salesAgent field before sending response
    const populatedOrder = await SalesOrder.findById(savedOrder._id)
      .populate("salesAgent", "firstName lastName email")
      .lean();

    res.status(201).json({
      success: true,
      message: "Sales order created successfully",
      data: populatedOrder,
    });
  } catch (error) {
    console.error("Error creating sales order:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
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
const duplicateSalesOrder = async (req, res) => {
  try {
    const { docEntry } = req.params;

    const originalOrder = await SalesOrder.findOne({
      DocEntry: parseInt(docEntry),
    });

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

    // Create duplicate order
    const duplicateOrder = new SalesOrder({
      ...originalOrder.toObject(),
      _id: undefined,
      DocEntry: nextDocEntry,
      DocNum: nextDocNum,
      CreationDate: new Date(),
      UpdateDate: new Date(),
      DocumentStatus: "Open",
      DocumentLines: originalOrder.DocumentLines.map((line, index) => ({
        ...line,
        LineNum: index,
        DocEntry: nextDocEntry,
      })),
    });

    const savedOrder = await duplicateOrder.save();

    const populatedOrder = await SalesOrder.findById(savedOrder._id)
      .populate("salesAgent", "firstName lastName email")
      .lean();

    res.status(201).json({
      success: true,
      message: "Sales order duplicated successfully",
      data: populatedOrder,
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
};
