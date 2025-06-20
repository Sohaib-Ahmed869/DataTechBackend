const Leads = require("../models/Leads.model");
const User = require("../models/user.model");
const mongoose = require("mongoose"); // Make sure to import mongoose
const NotificationService = require("../utils/notificationService");

// Get all leads with filtering, sorting, and pagination

const getLeads = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      lead_type,
      lead_status,
      lead_remarks,
      assigned_agent,
      search,
      sort_by = "createdAt",
      sort_order = "desc",
      start_date,
      end_date,
    } = req.query;

    // Build filter object
    const filter = {};

    // Filter by lead type
    if (lead_type) {
      filter.lead_type = lead_type;
    }

    // Filter by lead status
    if (lead_status) {
      filter.lead_status = lead_status;
    }

    // Filter by lead remarks
    if (lead_remarks) {
      filter.lead_remarks = lead_remarks;
    }

    // Filter by assigned agent
    if (assigned_agent) {
      filter.assigned_agent_id = assigned_agent;
    }

    // Search functionality (name, email, description)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { service_interested_in: { $regex: search, $options: "i" } },
      ];
    }

    // Date range filter
    if (start_date || end_date) {
      filter.createdAt = {};
      if (start_date) {
        filter.createdAt.$gte = new Date(start_date);
      }
      if (end_date) {
        filter.createdAt.$lte = new Date(end_date);
      }
    }

    // Pagination calculations
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort configuration
    const sortConfig = {};
    sortConfig[sort_by] = sort_order === "desc" ? -1 : 1;

    // Execute query with pagination, sorting, and population
    const leads = await Leads.find(filter)
      .populate("assigned_agent_name", "name email")
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination
    const totalLeads = await Leads.countDocuments(filter);
    const totalPages = Math.ceil(totalLeads / limitNum);

    // Calculate statistics
    const stats = await Leads.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          newLeads: {
            $sum: { $cond: [{ $eq: ["$lead_status", "New"] }, 1, 0] },
          },
          inProgressLeads: {
            $sum: { $cond: [{ $eq: ["$lead_status", "In Progress"] }, 1, 0] },
          },
          closedLeads: {
            $sum: { $cond: [{ $eq: ["$lead_status", "Closed"] }, 1, 0] },
          },
          successfulLeads: {
            $sum: { $cond: [{ $eq: ["$lead_remarks", "Successful"] }, 1, 0] },
          },
          unsuccessfulLeads: {
            $sum: { $cond: [{ $eq: ["$lead_remarks", "Unsuccessful"] }, 1, 0] },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        leads,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalLeads,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum,
        },
        statistics:
          stats.length > 0
            ? stats[0]
            : {
                totalLeads: 0,
                newLeads: 0,
                inProgressLeads: 0,
                closedLeads: 0,
                successfulLeads: 0,
                unsuccessfulLeads: 0,
              },
      },
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch leads",
      details: error.message,
    });
  }
};
const getLeadsByAgentId = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      lead_type,
      lead_status,
      lead_remarks,
      assigned_agent,
      search,
      sort_by = "createdAt",
      sort_order = "desc",
      start_date,
      end_date,
    } = req.query;
    const { agentId } = req.params;

    // Convert agentId string to ObjectId for proper comparison
    const agentObjectId = new mongoose.Types.ObjectId(agentId);

    // Build filter object
    const filter = { assigned_agent_id: agentObjectId }; // Use ObjectId here

    // Filter by lead type
    if (lead_type) {
      filter.lead_type = lead_type;
    }

    // Filter by lead status
    if (lead_status) {
      filter.lead_status = lead_status;
    }

    // Filter by lead remarks
    if (lead_remarks) {
      filter.lead_remarks = lead_remarks;
    }

    // Filter by assigned agent (this might override the agentId, be careful)
    if (assigned_agent) {
      filter.assigned_agent_id = new mongoose.Types.ObjectId(assigned_agent);
    }

    // Search functionality (name, email, description)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { service_interested_in: { $regex: search, $options: "i" } },
      ];
    }

    // Date range filter
    if (start_date || end_date) {
      filter.createdAt = {};
      if (start_date) {
        filter.createdAt.$gte = new Date(start_date);
      }
      if (end_date) {
        filter.createdAt.$lte = new Date(end_date);
      }
    }

    // Pagination calculations
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort configuration
    const sortConfig = {};
    sortConfig[sort_by] = sort_order === "desc" ? -1 : 1;

    // Execute query with pagination, sorting, and population
    const leads = await Leads.find(filter)
      .populate("assigned_agent_name", "name email")
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination
    const totalLeads = await Leads.countDocuments(filter);
    const totalPages = Math.ceil(totalLeads / limitNum);

    // Calculate statistics - Create filter with ObjectId for aggregation
    const aggregationFilter = { assigned_agent_id: agentObjectId }; // Use ObjectId for aggregation

    // Apply same filters to aggregation
    if (lead_type) {
      aggregationFilter.lead_type = lead_type;
    }
    if (lead_status) {
      aggregationFilter.lead_status = lead_status;
    }
    if (lead_remarks) {
      aggregationFilter.lead_remarks = lead_remarks;
    }
    if (assigned_agent) {
      aggregationFilter.assigned_agent_id = new mongoose.Types.ObjectId(
        assigned_agent
      );
    }
    if (search) {
      aggregationFilter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { service_interested_in: { $regex: search, $options: "i" } },
      ];
    }
    if (start_date || end_date) {
      aggregationFilter.createdAt = {};
      if (start_date) {
        aggregationFilter.createdAt.$gte = new Date(start_date);
      }
      if (end_date) {
        aggregationFilter.createdAt.$lte = new Date(end_date);
      }
    }

    const stats = await Leads.aggregate([
      { $match: aggregationFilter }, // Use the ObjectId filter
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          newLeads: {
            $sum: { $cond: [{ $eq: ["$lead_status", "New"] }, 1, 0] },
          },
          inProgressLeads: {
            $sum: { $cond: [{ $eq: ["$lead_status", "In Progress"] }, 1, 0] },
          },
          closedLeads: {
            $sum: { $cond: [{ $eq: ["$lead_status", "Closed"] }, 1, 0] },
          },
          successfulLeads: {
            $sum: { $cond: [{ $eq: ["$lead_remarks", "Successful"] }, 1, 0] },
          },
          unsuccessfulLeads: {
            $sum: { $cond: [{ $eq: ["$lead_remarks", "Unsuccessful"] }, 1, 0] },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        leads,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalLeads,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum,
        },
        statistics:
          stats.length > 0
            ? stats[0]
            : {
                totalLeads: 0,
                newLeads: 0,
                inProgressLeads: 0,
                closedLeads: 0,
                successfulLeads: 0,
                unsuccessfulLeads: 0,
              },
      },
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch leads",
      details: error.message,
    });
  }
};

const getLeadById = async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await Leads.findById(id)
      .populate("assigned_agent", "name email")
      .populate("related_form_id")
      .lean();

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    res.status(200).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    console.error("Error fetching lead by ID:", error);

    // Handle invalid ObjectId
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        error: "Invalid lead ID format",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to fetch lead",
      details: error.message,
    });
  }
};

// Get leads by assigned agent
const getLeadsByAgentForLeadsBoard = async (req, res) => {
  try {
    const { agentId } = req.params;
    const {
      lead_type,
      lead_status,
      lead_remarks,
      search,
      sort_by = "createdAt",
      sort_order = "desc",
      start_date,
      end_date,
      date_filter = "this_week", // Default to this week
    } = req.query;

    // Build filter object with agentId as base filter
    const filter = { assigned_agent_id: agentId };

    // Filter by lead type
    if (lead_type) {
      filter.lead_type = lead_type;
    }

    // Filter by lead status
    if (lead_status) {
      filter.lead_status = lead_status;
    }

    // Filter by lead remarks
    if (lead_remarks) {
      filter.lead_remarks = lead_remarks;
    }

    // Search functionality (name, email, description)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { service_interested_in: { $regex: search, $options: "i" } },
      ];
    }

    // Helper function to get date ranges
    const getDateRange = (identifier) => {
      const now = new Date();
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      const endOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999
      );

      switch (identifier) {
        case "last_7_days":
          return {
            start: new Date(startOfDay.getTime() - 6 * 24 * 60 * 60 * 1000),
            end: endOfDay,
          };

        case "this_week":
          const startOfWeek = new Date(startOfDay);
          const dayOfWeek = startOfWeek.getDay();
          const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday as start
          startOfWeek.setDate(startOfWeek.getDate() - daysToSubtract);
          return {
            start: startOfWeek,
            end: endOfDay,
          };

        case "this_month":
          return {
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end: endOfDay,
          };

        case "last_15_days":
          return {
            start: new Date(startOfDay.getTime() - 14 * 24 * 60 * 60 * 1000),
            end: endOfDay,
          };

        case "last_30_days":
          return {
            start: new Date(startOfDay.getTime() - 29 * 24 * 60 * 60 * 1000),
            end: endOfDay,
          };

        case "today":
          return {
            start: startOfDay,
            end: endOfDay,
          };

        case "yesterday":
          const yesterday = new Date(
            startOfDay.getTime() - 24 * 60 * 60 * 1000
          );
          return {
            start: yesterday,
            end: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1),
          };

        case "last_week":
          const lastWeekEnd = new Date(startOfDay);
          const lastWeekDaysToSubtract =
            lastWeekEnd.getDay() === 0 ? 6 : lastWeekEnd.getDay() - 1;
          lastWeekEnd.setDate(
            lastWeekEnd.getDate() - lastWeekDaysToSubtract - 1
          );
          lastWeekEnd.setHours(23, 59, 59, 999);

          const lastWeekStart = new Date(lastWeekEnd);
          lastWeekStart.setDate(lastWeekStart.getDate() - 6);
          lastWeekStart.setHours(0, 0, 0, 0);

          return {
            start: lastWeekStart,
            end: lastWeekEnd,
          };

        case "last_month":
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthEnd = new Date(
            now.getFullYear(),
            now.getMonth(),
            0,
            23,
            59,
            59,
            999
          );
          return {
            start: lastMonth,
            end: lastMonthEnd,
          };

        default:
          // Default to this week
          const defaultStartOfWeek = new Date(startOfDay);
          const defaultDayOfWeek = defaultStartOfWeek.getDay();
          const defaultDaysToSubtract =
            defaultDayOfWeek === 0 ? 6 : defaultDayOfWeek - 1;
          defaultStartOfWeek.setDate(
            defaultStartOfWeek.getDate() - defaultDaysToSubtract
          );
          return {
            start: defaultStartOfWeek,
            end: endOfDay,
          };
      }
    };

    // Date range filter - prioritize start_date/end_date over date_filter
    if (start_date || end_date) {
      filter.createdAt = {};
      if (start_date) {
        filter.createdAt.$gte = new Date(start_date);
      }
      if (end_date) {
        filter.createdAt.$lte = new Date(end_date);
      }
    } else if (date_filter) {
      const dateRange = getDateRange(date_filter);
      filter.createdAt = {
        $gte: dateRange.start,
        $lte: dateRange.end,
      };
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sort_by] = sort_order === "desc" ? -1 : 1;

    // Execute query without pagination
    const leads = await Leads.find(filter)
      .populate("assigned_agent_id", "name email")
      .sort(sortConfig)
      .lean();

    // Calculate statistics for this agent
    const stats = await Leads.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          newLeads: {
            $sum: { $cond: [{ $eq: ["$lead_status", "New"] }, 1, 0] },
          },
          inProgressLeads: {
            $sum: { $cond: [{ $eq: ["$lead_status", "In Progress"] }, 1, 0] },
          },
          closedLeads: {
            $sum: { $cond: [{ $eq: ["$lead_status", "Closed"] }, 1, 0] },
          },
          successfulLeads: {
            $sum: { $cond: [{ $eq: ["$lead_remarks", "Successful"] }, 1, 0] },
          },
          unsuccessfulLeads: {
            $sum: { $cond: [{ $eq: ["$lead_remarks", "Unsuccessful"] }, 1, 0] },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        leads,
        totalLeads: leads.length,
        agentId,
        dateFilter: date_filter,
        statistics:
          stats.length > 0
            ? stats[0]
            : {
                totalLeads: 0,
                newLeads: 0,
                inProgressLeads: 0,
                closedLeads: 0,
                successfulLeads: 0,
                unsuccessfulLeads: 0,
              },
      },
    });
  } catch (error) {
    console.error("Error fetching leads by agent:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch leads by agent",
      details: error.message,
    });
  }
};

const getLeadsforLeadsBoard = async (req, res) => {
  try {
    const {
      lead_type,
      lead_status,
      lead_remarks,
      assigned_agent,
      search,
      sort_by = "createdAt",
      sort_order = "desc",
      start_date,
      end_date,
      date_filter = "this_week", // Default to this week
    } = req.query;

    // Build filter object
    const filter = {};

    // Filter by lead type
    if (lead_type) {
      filter.lead_type = lead_type;
    }

    // Filter by lead status
    if (lead_status) {
      filter.lead_status = lead_status;
    }

    // Filter by lead remarks
    if (lead_remarks) {
      filter.lead_remarks = lead_remarks;
    }

    // Filter by assigned agent
    if (assigned_agent) {
      filter.assigned_agent_id = assigned_agent;
    }

    // Search functionality (name, email, description)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { service_interested_in: { $regex: search, $options: "i" } },
      ];
    }

    // Helper function to get date ranges
    const getDateRange = (identifier) => {
      const now = new Date();
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      const endOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999
      );

      switch (identifier) {
        case "last_7_days":
          return {
            start: new Date(startOfDay.getTime() - 6 * 24 * 60 * 60 * 1000),
            end: endOfDay,
          };

        case "this_week":
          const startOfWeek = new Date(startOfDay);
          const dayOfWeek = startOfWeek.getDay();
          const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday as start
          startOfWeek.setDate(startOfWeek.getDate() - daysToSubtract);
          return {
            start: startOfWeek,
            end: endOfDay,
          };

        case "this_month":
          return {
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end: endOfDay,
          };

        case "last_15_days":
          return {
            start: new Date(startOfDay.getTime() - 14 * 24 * 60 * 60 * 1000),
            end: endOfDay,
          };

        case "last_30_days":
          return {
            start: new Date(startOfDay.getTime() - 29 * 24 * 60 * 60 * 1000),
            end: endOfDay,
          };

        case "today":
          return {
            start: startOfDay,
            end: endOfDay,
          };

        case "yesterday":
          const yesterday = new Date(
            startOfDay.getTime() - 24 * 60 * 60 * 1000
          );
          return {
            start: yesterday,
            end: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1),
          };

        case "last_week":
          const lastWeekEnd = new Date(startOfDay);
          const lastWeekDaysToSubtract =
            lastWeekEnd.getDay() === 0 ? 6 : lastWeekEnd.getDay() - 1;
          lastWeekEnd.setDate(
            lastWeekEnd.getDate() - lastWeekDaysToSubtract - 1
          );
          lastWeekEnd.setHours(23, 59, 59, 999);

          const lastWeekStart = new Date(lastWeekEnd);
          lastWeekStart.setDate(lastWeekStart.getDate() - 6);
          lastWeekStart.setHours(0, 0, 0, 0);

          return {
            start: lastWeekStart,
            end: lastWeekEnd,
          };

        case "last_month":
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthEnd = new Date(
            now.getFullYear(),
            now.getMonth(),
            0,
            23,
            59,
            59,
            999
          );
          return {
            start: lastMonth,
            end: lastMonthEnd,
          };

        default:
          // Default to this week
          const defaultStartOfWeek = new Date(startOfDay);
          const defaultDayOfWeek = defaultStartOfWeek.getDay();
          const defaultDaysToSubtract =
            defaultDayOfWeek === 0 ? 6 : defaultDayOfWeek - 1;
          defaultStartOfWeek.setDate(
            defaultStartOfWeek.getDate() - defaultDaysToSubtract
          );
          return {
            start: defaultStartOfWeek,
            end: endOfDay,
          };
      }
    };

    // Date range filter - prioritize start_date/end_date over date_filter
    if (start_date || end_date) {
      filter.createdAt = {};
      if (start_date) {
        filter.createdAt.$gte = new Date(start_date);
      }
      if (end_date) {
        filter.createdAt.$lte = new Date(end_date);
      }
    } else if (date_filter) {
      const dateRange = getDateRange(date_filter);
      filter.createdAt = {
        $gte: dateRange.start,
        $lte: dateRange.end,
      };
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sort_by] = sort_order === "desc" ? -1 : 1;

    // Execute query without pagination
    const leads = await Leads.find(filter)
      .populate("assigned_agent_name", "name email")
      .sort(sortConfig)
      .lean();

    // Calculate statistics
    const stats = await Leads.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          newLeads: {
            $sum: { $cond: [{ $eq: ["$lead_status", "New"] }, 1, 0] },
          },
          inProgressLeads: {
            $sum: { $cond: [{ $eq: ["$lead_status", "In Progress"] }, 1, 0] },
          },
          closedLeads: {
            $sum: { $cond: [{ $eq: ["$lead_status", "Closed"] }, 1, 0] },
          },
          successfulLeads: {
            $sum: { $cond: [{ $eq: ["$lead_remarks", "Successful"] }, 1, 0] },
          },
          unsuccessfulLeads: {
            $sum: { $cond: [{ $eq: ["$lead_remarks", "Unsuccessful"] }, 1, 0] },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        leads,
        totalLeads: leads.length,
        dateFilter: date_filter,
        statistics:
          stats.length > 0
            ? stats[0]
            : {
                totalLeads: 0,
                newLeads: 0,
                inProgressLeads: 0,
                closedLeads: 0,
                successfulLeads: 0,
                unsuccessfulLeads: 0,
              },
      },
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch leads",
      details: error.message,
    });
  }
};
// Update lead status when moved between columns
const updateLeadStatus = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { lead_status, lead_remarks } = req.body;

    const updateData = { lead_status };

    // Only update remarks if provided
    if (lead_remarks) {
      updateData.lead_remarks = lead_remarks;
    }

    const updatedLead = await Leads.findByIdAndUpdate(leadId, updateData, {
      new: true,
      runValidators: true,
    }).populate("assigned_agent_id", "name email firstName lastName");

    if (!updatedLead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    res.status(200).json({
      success: true,
      data: updatedLead,
      message: "Lead status updated successfully",
    });
  } catch (error) {
    console.error("Error updating lead status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update lead status",
      details: error.message,
    });
  }
};

const assignAgent = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { assigned_agent } = req.body;

    // Validate that assigned_agent is provided
    if (!assigned_agent) {
      return res.status(400).json({
        success: false,
        error: "assigned_agent is required",
      });
    }

    // Get the current lead to check for previous assignment
    const currentLead = await Leads.findById(leadId).populate(
      "assigned_agent_id"
    );

    if (!currentLead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    const previousAgent = currentLead.assigned_agent_id;
    let updateData;
    let newAgent = null;

    if (assigned_agent === "unassigned") {
      // Handle unassigned case
      updateData = {
        assigned_agent_id: null,
        assigned_agent_name: "unassigned",
      };

      // Create unassignment notification if there was a previous agent
      if (previousAgent && req.user) {
        try {
          await NotificationService.createLeadUnassignedNotification(
            currentLead,
            req.user._id,
            previousAgent
          );
        } catch (notificationError) {
          console.error(
            "Error creating unassignment notification:",
            notificationError
          );
          // Don't fail the main operation if notification fails
        }
      }
    } else {
      // Find the user to get their name
      const agent = await User.findById(assigned_agent);

      if (!agent) {
        return res.status(400).json({
          success: false,
          error: "Agent not found",
        });
      }

      newAgent = agent;
      updateData = {
        assigned_agent_id: assigned_agent,
        assigned_agent_name: `${agent.firstName} ${agent.lastName}`,
      };
    }

    const updatedLead = await Leads.findByIdAndUpdate(leadId, updateData, {
      new: true,
      runValidators: true,
    }).populate("assigned_agent_id", "firstName lastName email role");

    if (!updatedLead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    // Create notifications for assignment/reassignment
    if (newAgent && req.user) {
      try {
        if (
          previousAgent &&
          previousAgent._id.toString() !== newAgent._id.toString()
        ) {
          // Lead was reassigned
          await NotificationService.createLeadReassignedNotification(
            updatedLead,
            req.user._id,
            previousAgent,
            newAgent
          );
        } else if (!previousAgent) {
          // Lead was newly assigned
          await NotificationService.createLeadAssignedNotification(
            updatedLead,
            req.user._id,
            newAgent
          );
        }
      } catch (notificationError) {
        console.error(
          "Error creating assignment notification:",
          notificationError
        );
        // Don't fail the main operation if notification fails
      }
    }

    res.status(200).json({
      success: true,
      data: updatedLead,
      message:
        assigned_agent === "unassigned"
          ? "Agent unassigned successfully"
          : "Agent assigned successfully",
    });
  } catch (error) {
    console.error("Error assigning agent:", error);
    res.status(500).json({
      success: false,
      error: "Failed to assign agent",
      details: error.message,
    });
  }
};

// Add remarks to lead
const addRemarks = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { lead_remarks } = req.body;

    const updatedLead = await Leads.findByIdAndUpdate(
      leadId,
      { lead_remarks },
      { new: true, runValidators: true }
    ).populate("assigned_agent_id", "name email firstName lastName");

    if (!updatedLead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    res.status(200).json({
      success: true,
      data: updatedLead,
      message: "Remarks added successfully",
    });
  } catch (error) {
    console.error("Error adding remarks:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add remarks",
      details: error.message,
    });
  }
};

module.exports = {
  updateLeadStatus,
  assignAgent,
  addRemarks,
  getLeads,
  getLeadById,
  getLeadsByAgentForLeadsBoard,
  getLeadsforLeadsBoard,
  getLeadsByAgentId,
};
