const Customer = require("../models/Customer.model");
const Quotation = require("../models/Quotation.model");
const SalesOrder = require("../models/SalesOrder.model");
const {
  generateNextCardCode,
  formatCustomerForSAP,
  createCustomerInSAP,
  checkCustomerExistsInSAP,
} = require("../utils/sapB1CustomerIntegration");

// Helper function to format customer data

async function pushCustomerToSAPInternal(customer) {
  try {
    console.log("🚀 Starting SAP push for customer:", customer.CardCode);

    // Format the customer for SAP B1 using the working configuration
    const sapCustomer = await formatCustomerForSAP(customer);

    // Push to SAP B1
    const sapResponse = await createCustomerInSAP(sapCustomer);

    // Update local customer with SAP sync status if successful
    if (sapResponse && (sapResponse.CardCode || !sapResponse.simulated)) {
      customer.SyncedWithSAP = true;
      customer.LocalStatus = "Synced";
      customer.customerType = "sap";
      customer.updatedAt = new Date();

      // Clear any previous errors
      customer.SyncErrors = undefined;
      customer.SAPSyncDisabled = false;

      await customer.save();

      console.log(
        "✅ Customer successfully synced with SAP:",
        sapResponse.CardCode || customer.CardCode
      );

      return {
        success: true,
        CardCode: sapResponse.CardCode || customer.CardCode,
        sapData: sapResponse,
      };
    } else {
      throw new Error("Invalid response from SAP B1");
    }
  } catch (error) {
    console.error("❌ Error pushing customer to SAP:", error.message);

    // Update local customer to mark sync failure
    customer.SyncErrors = error.message;
    customer.LastSyncAttempt = new Date();
    customer.LocalStatus = "SyncFailed";

    await customer.save();

    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

// Helper function to sanitize assignedTo field
const sanitizeAssignedTo = (assignedTo) => {
  // If assignedTo is empty string, null, undefined, or whitespace, return null
  if (!assignedTo || assignedTo.toString().trim() === "") {
    return null;
  }
  return assignedTo;
};

// UPDATED: Create a new customer with numeric CardCode generation (0001, 0002, etc.)
const createCustomer = async (req, res) => {
  try {
    const {
      CardName,
      CardCode,
      Email,
      firstName,
      lastName,
      phoneNumber,
      additionalPhoneNumbers,
      assignedTo,
      contactOwnerName,
      notes,
      companyId,
      address,
      outstandingBalance,
    } = req.body;

    // Validate required fields
    if (!CardName) {
      return res.status(400).json({
        success: false,
        message: "CardName is required",
      });
    }

    // Check if customer with same CardCode already exists (if CardCode is provided)
    if (CardCode) {
      const existingCustomer = await Customer.findOne({ CardCode });
      if (existingCustomer) {
        return res.status(409).json({
          success: false,
          message: "Customer with this CardCode already exists",
        });
      }
    }

    // Check if customer with same Email already exists (if Email is provided)
    if (Email) {
      const existingEmail = await Customer.findOne({ Email });
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: "Customer with this email already exists",
        });
      }
    }

    // Generate numeric CardCode if not provided (0001, 0002, 0003, etc.)
    let generatedCardCode = CardCode;
    if (!generatedCardCode) {
      try {
        // Try to get next SAP CardCode in numeric format
        generatedCardCode = await generateNextCardCode();
        console.log(`✅ Generated numeric SAP CardCode: ${generatedCardCode}`);
      } catch (error) {
        console.warn(
          "⚠️  Failed to generate SAP CardCode, using fallback:",
          error.message
        );

        // Fallback to local generation - find highest numeric CardCode in local DB
        try {
          const lastLocalCustomer = await Customer.findOne({
            CardCode: { $regex: /^\d{4}$/ }, // Find 4-digit numeric CardCodes
          }).sort({ CardCode: -1 });

          if (lastLocalCustomer) {
            const lastNumber = Number.parseInt(lastLocalCustomer.CardCode, 10);
            generatedCardCode = (lastNumber + 1).toString().padStart(4, "0");
          } else {
            generatedCardCode = "0001";
          }
          console.log(`✅ Generated fallback CardCode: ${generatedCardCode}`);
        } catch (localError) {
          console.error("Failed to generate fallback CardCode:", localError);
          generatedCardCode = "0001";
        }
      }
    }

    // Sanitize assignedTo field to handle empty strings
    const sanitizedAssignedTo = sanitizeAssignedTo(assignedTo);

    console.log("📝 Creating customer with assignedTo:", {
      original: assignedTo,
      sanitized: sanitizedAssignedTo,
      type: typeof sanitizedAssignedTo,
    });

    // Create new customer
    const newCustomer = new Customer({
      CardName,
      CardCode: generatedCardCode,
      Email,
      firstName,
      lastName,
      phoneNumber,
      additionalPhoneNumbers,
      assignedTo: sanitizedAssignedTo, // Use sanitized value
      contactOwnerName,
      notes,
      companyId,
      address,
      outstandingBalance: outstandingBalance || 0,
      lastActivityDate: new Date(),
      // SAP Integration fields
      SyncedWithSAP: false,
      LocalStatus: "Created",
      customerType: "non-sap", // Will be updated to "sap" after successful sync
    });

    console.log("📝 Creating new customer:", {
      CardName: newCustomer.CardName,
      CardCode: newCustomer.CardCode,
      Email: newCustomer.Email,
      assignedTo: newCustomer.assignedTo,
    });

    // Save to local database first
    const savedCustomer = await newCustomer.save();

    // Push to SAP automatically
    console.log("🔄 Automatically pushing new customer to SAP...");
    const sapResult = await pushCustomerToSAPInternal(savedCustomer);

    // Populate assignedTo field before sending response
    const populatedCustomer = await Customer.findById(savedCustomer._id)
      .populate("assignedTo", "firstName lastName email")
      .lean();

    // Add computed fields
    const formattedCustomer = formatCustomerData(populatedCustomer);

    // Return response with both local creation and SAP push results
    if (sapResult.success) {
      res.status(201).json({
        success: true,
        message: "✅ Customer created successfully and synced with SAP",
        data: formattedCustomer,
        sapSync: {
          success: true,
          CardCode: sapResult.CardCode,
        },
      });
    } else {
      res.status(201).json({
        success: true,
        message:
          "⚠️  Customer created successfully in local database but failed to sync with SAP",
        data: formattedCustomer,
        sapSync: {
          success: false,
          error: sapResult.error,
        },
      });
    }
  } catch (error) {
    console.error("❌ Error creating customer:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
// FIXED: Manual push customer to SAP (for retry purposes)
const pushCustomerToSAP = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Check if already synced with SAP
    if (customer.SyncedWithSAP && customer.LocalStatus === "Synced") {
      return res.status(400).json({
        success: false,
        message: `Customer already synced with SAP (CardCode: ${customer.CardCode})`,
        CardCode: customer.CardCode,
      });
    }

    // Check if sync was previously disabled
    if (customer.SAPSyncDisabled) {
      // Allow force sync if specifically requested
      if (req.query.force !== "true") {
        return res.status(400).json({
          success: false,
          message: `Cannot sync customer: ${customer.SyncErrors}. Add ?force=true to override.`,
          error: customer.SyncErrors,
        });
      }
      // If force=true, continue with sync attempt and clear the flag
      customer.SAPSyncDisabled = false;
      await customer.save();
    }

    console.log(
      "🔄 Manual SAP push requested for customer:",
      customer.CardCode
    );
    const sapResult = await pushCustomerToSAPInternal(customer);

    if (sapResult.success) {
      return res.status(200).json({
        success: true,
        message: "✅ Customer successfully pushed to SAP B1",
        CardCode: sapResult.CardCode,
        localId: customer._id,
        sapData: sapResult.sapData,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "❌ Error pushing customer to SAP B1",
        error: sapResult.error,
      });
    }
  } catch (error) {
    console.error("❌ Error in manual SAP push:", error);
    res.status(500).json({
      success: false,
      message: "Error pushing customer to SAP B1",
      error: error.message || "Unknown error",
    });
  }
};

// Keep all your existing functions unchanged...
const getAllCustomersWithSAPStatus = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      assignedTo,
      sort_by = "createdAt",
      sort_order = "desc",
      country,
      hasOutstandingBalance,
      sapSyncStatus,
    } = req.query;

    const filter = {};

    if (assignedTo && assignedTo !== "all") {
      if (assignedTo === "unassigned") {
        filter.assignedTo = { $exists: false };
      } else {
        filter.assignedTo = assignedTo;
      }
    }

    if (country) {
      filter["address.country"] = { $regex: country, $options: "i" };
    }

    if (hasOutstandingBalance !== undefined) {
      if (hasOutstandingBalance === "true") {
        filter.outstandingBalance = { $gt: 0 };
      } else if (hasOutstandingBalance === "false") {
        filter.outstandingBalance = { $lte: 0 };
      }
    }

    if (sapSyncStatus) {
      switch (sapSyncStatus) {
        case "synced":
          filter.SyncedWithSAP = true;
          filter.LocalStatus = "Synced";
          break;
        case "failed":
          filter.LocalStatus = "SyncFailed";
          break;
        case "pending":
          filter.LocalStatus = "Created";
          filter.SyncedWithSAP = false;
          break;
        case "disabled":
          filter.SAPSyncDisabled = true;
          break;
      }
    }

    if (search) {
      filter.$or = [
        { CardName: { $regex: search, $options: "i" } },
        { CardCode: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { Email: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
        { contactOwnerName: { $regex: search, $options: "i" } },
        { companyId: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Number.parseInt(page);
    const limitNum = Number.parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const sortConfig = {};
    sortConfig[sort_by] = sort_order === "desc" ? -1 : 1;

    const customers = await Customer.find(filter)
      .populate("assignedTo", "firstName lastName email")
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalCustomers = await Customer.countDocuments(filter);
    const totalPages = Math.ceil(totalCustomers / limitNum);

    const formattedCustomers = customers.map(formatCustomerData);

    const sapSyncStats = await Customer.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          syncedWithSAP: {
            $sum: { $cond: [{ $eq: ["$SyncedWithSAP", true] }, 1, 0] },
          },
          syncFailed: {
            $sum: { $cond: [{ $eq: ["$LocalStatus", "SyncFailed"] }, 1, 0] },
          },
          syncPending: {
            $sum: { $cond: [{ $eq: ["$LocalStatus", "Created"] }, 1, 0] },
          },
          syncDisabled: {
            $sum: { $cond: [{ $eq: ["$SAPSyncDisabled", true] }, 1, 0] },
          },
        },
      },
    ]);

    const stats =
      sapSyncStats.length > 0
        ? sapSyncStats[0]
        : {
            totalCustomers: 0,
            syncedWithSAP: 0,
            syncFailed: 0,
            syncPending: 0,
            syncDisabled: 0,
          };

    res.status(200).json({
      success: true,
      data: {
        customers: formattedCustomers,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCustomers,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum,
        },
        sapSyncStatistics: {
          totalCustomers: stats.totalCustomers,
          syncedWithSAP: stats.syncedWithSAP,
          syncFailed: stats.syncFailed,
          syncPending: stats.syncPending,
          syncDisabled: stats.syncDisabled,
          syncSuccessRate:
            stats.totalCustomers > 0
              ? ((stats.syncedWithSAP / stats.totalCustomers) * 100).toFixed(1)
              : 0,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: error.message,
    });
  }
};
// Add this new function to get customers with sales orders and quotations metrics
const getCustomersWithMetrics = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      assignedTo,
      sort_by = "createdAt",
      sort_order = "desc",
      country,
      hasOutstandingBalance,
    } = req.query;

    // Build filter object (reuse your existing filter logic)
    const filter = {};

    if (assignedTo && assignedTo !== "all") {
      if (assignedTo === "unassigned") {
        filter.assignedTo = { $exists: false };
      } else {
        filter.assignedTo = assignedTo;
      }
    }

    if (country) {
      filter["address.country"] = { $regex: country, $options: "i" };
    }

    if (hasOutstandingBalance !== undefined) {
      if (hasOutstandingBalance === "true") {
        filter.outstandingBalance = { $gt: 0 };
      } else if (hasOutstandingBalance === "false") {
        filter.outstandingBalance = { $lte: 0 };
      }
    }

    if (search) {
      filter.$or = [
        { CardName: { $regex: search, $options: "i" } },
        { CardCode: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { Email: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const sortConfig = {};
    sortConfig[sort_by] = sort_order === "desc" ? -1 : 1;

    // Get customers with populated assignedTo
    const customers = await Customer.find(filter)
      .populate("assignedTo", "firstName lastName email")
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get metrics for each customer
    const customersWithMetrics = await Promise.all(
      customers.map(async (customer) => {
        // Get sales orders count and total
        const salesOrders = await SalesOrder.find({
          CardCode: customer.CardCode,
          DocumentStatus: { $ne: "Cancelled" },
        });

        const salesOrderCount = salesOrders.length;
        const salesOrderTotal = salesOrders.reduce(
          (sum, order) => sum + (order.DocTotal || 0),
          0
        );

        // Get active quotations count (adjust the query based on your quotation model)
        // If you have a Quotation model, use it here. Otherwise, filter sales orders by type
        const activeQuotations = await Quotation.find({
          CardCode: customer.CardCode,
          IsActive: true,
          // Add quotation-specific filters if needed
        });

        const quotationCount = activeQuotations.length;

        return {
          ...formatCustomerData(customer),
          salesOrderCount,
          salesOrderTotal,
          quotationCount,
        };
      })
    );

    const totalCustomers = await Customer.countDocuments(filter);
    const totalPages = Math.ceil(totalCustomers / limitNum);

    res.status(200).json({
      success: true,
      data: {
        customers: customersWithMetrics,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCustomers,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching customers with metrics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: error.message,
    });
  }
};
const getAgentAssignedCustomers = async (req, res) => {
  // Helper function to format customer data with computed fields
  const formatCustomerData = (customer) => {
    // Generate full name
    const fullName =
      customer.firstName && customer.lastName
        ? `${customer.firstName} ${customer.lastName}`.trim()
        : (customer.firstName || customer.CardName || "").trim();

    // Generate initials
    const initials =
      customer.firstName && customer.lastName
        ? `${customer.firstName.charAt(0)}${customer.lastName.charAt(
            0
          )}`.toUpperCase()
        : customer.firstName
        ? customer.firstName.charAt(0).toUpperCase()
        : customer.CardName
        ? customer.CardName.charAt(0).toUpperCase()
        : "";

    // Generate full address
    const address = customer.address || {};
    const fullAddress =
      [address.street, address.city, address.zipCode, address.country]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      address.country ||
      "";

    // Generate display name
    const displayName = `${fullName} (${customer.CardCode})`;

    // Check if has outstanding balance
    const hasOutstandingBalance = (customer.outstandingBalance || 0) > 0;

    return {
      _id: customer._id,
      CardName: customer.CardName,
      CardCode: customer.CardCode,
      Email: customer.Email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phoneNumber: customer.phoneNumber,
      additionalPhoneNumbers: customer.additionalPhoneNumbers || [],
      assignedTo: customer.assignedTo,
      contactOwnerName: customer.contactOwnerName,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      notes: customer.notes,
      address: customer.address || { country: "France" },
      outstandingBalance: customer.outstandingBalance || 0,
      __v: customer.__v,
      lastActivityDate: customer.lastActivityDate,
      fullName,
      hasOutstandingBalance,
      fullAddress,
      initials,
      displayName,
    };
  };

  try {
    // EXTRACT AGENT ID FROM REQUEST PARAMETERS
    const { agentId } = req.params;
    const {
      page = 1,
      limit = 10,
      search,
      sort_by = "createdAt",
      sort_order = "desc",
      country,
      hasOutstandingBalance,
    } = req.query;

    // Validate agentId exists
    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: "Agent ID is required",
      });
    }

    // FILTER CUSTOMERS BY ASSIGNED AGENT ID
    // This will only return customers where assignedTo field matches the agentId
    const filter = {
      assignedTo: agentId,
    };

    // Additional filters
    if (country) {
      filter["address.country"] = { $regex: country, $options: "i" };
    }

    if (hasOutstandingBalance !== undefined) {
      if (hasOutstandingBalance === "true") {
        filter.outstandingBalance = { $gt: 0 };
      } else if (hasOutstandingBalance === "false") {
        filter.outstandingBalance = { $lte: 0 };
      }
    }

    if (search) {
      filter.$or = [
        { CardName: { $regex: search, $options: "i" } },
        { CardCode: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { Email: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const sortConfig = {};
    sortConfig[sort_by] = sort_order === "desc" ? -1 : 1;

    // FETCH ONLY CUSTOMERS ASSIGNED TO THE SPECIFIC AGENT
    // The filter ensures we only get customers where assignedTo === agentId
    const customers = await Customer.find(filter)
      .populate("assignedTo", "firstName lastName email")
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get metrics for each customer
    const customersWithMetrics = await Promise.all(
      customers.map(async (customer) => {
        // Get sales orders count and total
        const salesOrders = await SalesOrder.find({
          CardCode: customer.CardCode,
          DocumentStatus: { $ne: "Cancelled" },
        });

        const salesOrderCount = salesOrders.length;
        const salesOrderTotal = salesOrders.reduce(
          (sum, order) => sum + (order.DocTotal || 0),
          0
        );

        // Get active quotations count
        const activeQuotations = await Quotation.find({
          CardCode: customer.CardCode,
          IsActive: true,
        });

        const quotationCount = activeQuotations.length;

        return {
          ...formatCustomerData(customer),
          salesOrderCount,
          salesOrderTotal,
          quotationCount,
        };
      })
    );

    const totalCustomers = await Customer.countDocuments(filter);
    const totalPages = Math.ceil(totalCustomers / limitNum);

    res.status(200).json({
      success: true,
      data: {
        customers: customersWithMetrics,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCustomers,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching agent assigned customers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch agent assigned customers",
      error: error.message,
    });
  }
};

// Add this function to assign sales agent to customer
const assignSalesAgent = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { salesAgentId } = req.body;

    const customer = await Customer.findByIdAndUpdate(
      customerId,
      {
        assignedTo: salesAgentId || null,
        lastActivityDate: new Date(),
      },
      { new: true }
    ).populate("assignedTo", "firstName lastName email");

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Sales agent assigned successfully",
      data: formatCustomerData(customer),
    });
  } catch (error) {
    console.error("Error assigning sales agent:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign sales agent",
      error: error.message,
    });
  }
};
// Get all customers with pagination, search, and filtering
const getAllCustomers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      assignedTo,
      sort_by = "createdAt",
      sort_order = "desc",
      country,
      hasOutstandingBalance,
    } = req.query;

    // Build filter object
    const filter = {};

    // Filter by assigned sales agent
    if (assignedTo) {
      filter.assignedTo = assignedTo;
    }

    // Filter by country
    if (country) {
      filter["address.country"] = { $regex: country, $options: "i" };
    }

    // Filter by outstanding balance
    if (hasOutstandingBalance !== undefined) {
      if (hasOutstandingBalance === "true") {
        filter.outstandingBalance = { $gt: 0 };
      } else if (hasOutstandingBalance === "false") {
        filter.outstandingBalance = { $lte: 0 };
      }
    }

    // Search functionality
    if (search) {
      filter.$or = [
        { CardName: { $regex: search, $options: "i" } },
        { CardCode: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { Email: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
        { contactOwnerName: { $regex: search, $options: "i" } },
        { companyId: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination calculations
    const pageNum = Number.parseInt(page);
    const limitNum = Number.parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort configuration
    const sortConfig = {};
    sortConfig[sort_by] = sort_order === "desc" ? -1 : 1;

    // Execute query with pagination, sorting, and population
    const customers = await Customer.find(filter)
      .populate("assignedTo", "firstName lastName email")
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination
    const totalCustomers = await Customer.countDocuments(filter);
    const totalPages = Math.ceil(totalCustomers / limitNum);

    // Format customers data with computed fields
    const formattedCustomers = customers.map(formatCustomerData);

    // Calculate statistics
    const statistics = await Customer.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          totalOutstandingBalance: { $sum: "$outstandingBalance" },
          customersWithBalance: {
            $sum: { $cond: [{ $gt: ["$outstandingBalance", 0] }, 1, 0] },
          },
          averageBalance: { $avg: "$outstandingBalance" },
        },
      },
    ]);

    const stats =
      statistics.length > 0
        ? statistics[0]
        : {
            totalCustomers: 0,
            totalOutstandingBalance: 0,
            customersWithBalance: 0,
            averageBalance: 0,
          };

    res.status(200).json({
      success: true,
      data: {
        customers: formattedCustomers,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCustomers,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum,
        },
        statistics: {
          totalCustomers: stats.totalCustomers,
          totalOutstandingBalance: Number.parseFloat(
            (stats.totalOutstandingBalance || 0).toFixed(2)
          ),
          customersWithOutstandingBalance: stats.customersWithBalance,
          averageOutstandingBalance: Number.parseFloat(
            (stats.averageBalance || 0).toFixed(2)
          ),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: error.message,
    });
  }
};

// Get single customer by ID
const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id)
      .populate("assignedTo", "firstName lastName email")
      .lean();

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Add computed fields
    const formattedCustomer = formatCustomerData(customer);

    res.status(200).json({
      success: true,
      data: formattedCustomer,
    });
  } catch (error) {
    console.error("Error fetching customer by ID:", error);

    // Handle invalid ObjectId
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to fetch customer",
      error: error.message,
    });
  }
};

// Get customer by CardCode
const getCustomerByCardCode = async (req, res) => {
  try {
    const { cardCode } = req.params;

    const customer = await Customer.findOne({ CardCode: cardCode })
      .populate("assignedTo", "firstName lastName email")
      .lean();

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Add computed fields
    const formattedCustomer = formatCustomerData(customer);

    res.status(200).json({
      success: true,
      data: formattedCustomer,
    });
  } catch (error) {
    console.error("Error fetching customer by CardCode:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer",
      error: error.message,
    });
  }
};

// Update customer
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if customer exists
    const existingCustomer = await Customer.findById(id);
    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // If CardCode is being updated, check for duplicates
    if (
      updateData.CardCode &&
      updateData.CardCode !== existingCustomer.CardCode
    ) {
      const duplicateCustomer = await Customer.findOne({
        CardCode: updateData.CardCode,
        _id: { $ne: id },
      });
      if (duplicateCustomer) {
        return res.status(409).json({
          success: false,
          message: "Customer with this CardCode already exists",
        });
      }
    }

    // If Email is being updated, check for duplicates
    if (updateData.Email && updateData.Email !== existingCustomer.Email) {
      const duplicateEmail = await Customer.findOne({
        Email: updateData.Email,
        _id: { $ne: id },
      });
      if (duplicateEmail) {
        return res.status(409).json({
          success: false,
          message: "Customer with this email already exists",
        });
      }
    }

    // Update lastActivityDate
    updateData.lastActivityDate = new Date();

    // Update customer
    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: Date.now() },
      { new: true, runValidators: true }
    )
      .populate("assignedTo", "firstName lastName email")
      .lean();

    // Add computed fields
    const formattedCustomer = formatCustomerData(updatedCustomer);

    res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: formattedCustomer,
    });
  } catch (error) {
    console.error("Error updating customer:", error);

    // Handle invalid ObjectId
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update customer",
      error: error.message,
    });
  }
};

// Delete customer (soft delete by setting a deleted flag if you want to preserve data)
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedCustomer = await Customer.findByIdAndDelete(id);

    if (!deletedCustomer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
      data: deletedCustomer,
    });
  } catch (error) {
    console.error("Error deleting customer:", error);

    // Handle invalid ObjectId
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to delete customer",
      error: error.message,
    });
  }
};

// Search customers (dedicated endpoint for quick search)
const searchCustomers = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters long",
      });
    }

    const searchRegex = new RegExp(q.trim(), "i");

    const customers = await Customer.find({
      $or: [
        { CardName: searchRegex },
        { CardCode: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
        { Email: searchRegex },
        { phoneNumber: searchRegex },
        { contactOwnerName: searchRegex },
        { companyId: searchRegex },
      ],
    })
      .populate("assignedTo", "firstName lastName email")
      .limit(Number.parseInt(limit))
      .lean();

    const formattedCustomers = customers.map(formatCustomerData);

    res.status(200).json({
      success: true,
      data: formattedCustomers,
    });
  } catch (error) {
    console.error("Error searching customers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search customers",
      error: error.message,
    });
  }
};

// Get customer statistics
const getCustomerStats = async (req, res) => {
  try {
    const stats = await Customer.aggregate([
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          totalOutstandingBalance: { $sum: "$outstandingBalance" },
          customersWithBalance: {
            $sum: { $cond: [{ $gt: ["$outstandingBalance", 0] }, 1, 0] },
          },
          averageBalance: { $avg: "$outstandingBalance" },
          recentCustomers: {
            $sum: {
              $cond: [
                {
                  $gte: [
                    "$createdAt",
                    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const customerStats =
      stats.length > 0
        ? stats[0]
        : {
            totalCustomers: 0,
            totalOutstandingBalance: 0,
            customersWithBalance: 0,
            averageBalance: 0,
            recentCustomers: 0,
          };

    res.status(200).json({
      success: true,
      data: {
        totalCustomers: customerStats.totalCustomers,
        totalOutstandingBalance: Number.parseFloat(
          (customerStats.totalOutstandingBalance || 0).toFixed(2)
        ),
        customersWithOutstandingBalance: customerStats.customersWithBalance,
        averageOutstandingBalance: Number.parseFloat(
          (customerStats.averageBalance || 0).toFixed(2)
        ),
        recentCustomers: customerStats.recentCustomers,
      },
    });
  } catch (error) {
    console.error("Error fetching customer statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer statistics",
      error: error.message,
    });
  }
};

// Helper function to format customer data with computed fields
const formatCustomerData = (customer) => {
  if (!customer) return null;

  return {
    ...customer,
    fullName:
      customer.firstName && customer.lastName
        ? `${customer.firstName} ${customer.lastName}`
        : customer.CardName,
    hasOutstandingBalance: (customer.outstandingBalance || 0) > 0,
    fullAddress: customer.address
      ? `${customer.address.street || ""} ${customer.address.city || ""} ${
          customer.address.zipCode || ""
        } ${customer.address.country || ""}`.trim()
      : "",
    initials: getCustomerInitials(customer),
    displayName: getCustomerDisplayName(customer),
  };
};

// Helper function to get customer initials
const getCustomerInitials = (customer) => {
  if (!customer) return "?";

  if (customer.firstName && customer.lastName) {
    return `${customer.firstName.charAt(0)}${customer.lastName.charAt(
      0
    )}`.toUpperCase();
  }

  if (customer.CardName) {
    const nameParts = customer.CardName.split(" ");
    if (nameParts.length >= 2) {
      return `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`.toUpperCase();
    }
    return customer.CardName.charAt(0).toUpperCase();
  }

  return "?";
};

// Helper function to get customer display name
const getCustomerDisplayName = (customer) => {
  if (!customer) return "Unknown Customer";

  if (customer.firstName && customer.lastName) {
    return `${customer.firstName} ${customer.lastName} (${
      customer.CardCode || customer.CardName
    })`;
  }

  return `${customer.CardName} (${customer.CardCode || "No Code"})`;
};

module.exports = {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  getCustomerByCardCode,
  updateCustomer,
  deleteCustomer,
  searchCustomers,
  getCustomerStats,
  getCustomersWithMetrics,
  assignSalesAgent,
  getAgentAssignedCustomers,
  getAllCustomersWithSAPStatus,
  pushCustomerToSAP,
};
