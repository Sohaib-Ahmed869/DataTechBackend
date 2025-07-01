const Task = require("../models/Task.model");
const Leads = require("../models/Leads.model");
const Quotation = require("../models/Quotation.model");
const User = require("../models/user.model");
const NotificationService = require("../utils/notificationService");

// Get all tasks with role-based filtering
const getAllTasks = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;

    // Extract filter parameters from query
    const {
      view = "all", // all, created_by_me
      priority, // low, medium, high, urgent
      taskType, // lead, quotation
      assignedTo,
      dateRange, // today, last_7_days, last_30_days, all_time
      startDate,
      endDate,
      search,
    } = req.query;

    // Build filter for active tasks
    const filter = {
      isActive: true,
    };

    // Role-based filtering
    if (userRole === "data_tech_admin") {
      // Admin can see all tasks, but apply view filter
      if (view === "created_by_me") {
        filter.createdBy = userId;
      }
    } else if (userRole === "data_tech_sales_agent") {
      // Sales agents can only see their assigned tasks or tasks they created
      if (view === "created_by_me") {
        filter.createdBy = userId;
      } else {
        // Default view for sales agents - their assigned or created tasks
        filter.$or = [{ assignedTo: userId }, { createdBy: userId }];
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Priority filter
    if (priority && priority !== "all") {
      filter.priority = priority;
    }

    // Task type filter
    if (taskType && taskType !== "all") {
      filter.taskType = taskType;
    }

    // Assigned to filter (admin only)
    if (assignedTo && assignedTo !== "all" && userRole === "data_tech_admin") {
      if (assignedTo === "unassigned") {
        filter.assignedTo = { $exists: false };
      } else {
        filter.assignedTo = assignedTo;
      }
    }

    // Date range filter
    if (dateRange && dateRange !== "all_time") {
      const now = new Date();
      let startDateFilter;

      switch (dateRange) {
        case "today":
          startDateFilter = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );
          break;
        case "last_7_days":
          startDateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "last_30_days":
          startDateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      if (startDateFilter) {
        filter.createdAt = { $gte: startDateFilter };
      }
    }

    // Custom date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Add 1 day to include the end date
        const endDatePlusOne = new Date(endDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        filter.createdAt.$lt = endDatePlusOne;
      }
    }

    // Search filter
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: "i" };
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { customerName: searchRegex },
        { "leadData.name": searchRegex },
        { "leadData.email": searchRegex },
      ];
    }

    // Add this condition to your existing filter
    filter.status = { $ne: "rejected" };

    const tasks = await Task.find(filter)
      .populate("assignedTo", "firstName lastName email role")
      .populate("createdBy", "firstName lastName email role")
      .populate("leadId")
      .populate(
        "quotationId",
        "DocEntry DocNum CardName DocTotal DocumentLines"
      )
      .populate("approvedBy", "firstName lastName email")
      .populate("rejectedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .lean();

    // Group tasks by status for the 3-column layout
    const groupedTasks = {
      pending: tasks.filter((task) => task.status === "pending"),
      awaiting_approval: tasks.filter(
        (task) => task.status === "awaiting_approval"
      ),
      completed: tasks.filter(
        (task) => task.status === "completed" || task.status === "rejected"
      ),
    };

    // Calculate stats
    const stats = {
      total: tasks.length,
      pending: groupedTasks.pending.length,
      awaiting_approval: groupedTasks.awaiting_approval.length,
      completed: groupedTasks.completed.length,
      byPriority: {
        low: tasks.filter((t) => t.priority === "low").length,
        medium: tasks.filter((t) => t.priority === "medium").length,
        high: tasks.filter((t) => t.priority === "high").length,
        urgent: tasks.filter((t) => t.priority === "urgent").length,
      },
      byType: {
        lead: tasks.filter((t) => t.taskType === "lead").length,
        quotation: tasks.filter((t) => t.taskType === "quotation").length,
      },
    };

    res.status(200).json({
      success: true,
      data: groupedTasks,
      stats,
      filters: {
        view,
        priority,
        taskType,
        assignedTo,
        dateRange,
        startDate,
        endDate,
        search,
      },
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tasks",
      error: error.message,
    });
  }
};

// Get single task by ID
const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    const userRole = req.user?.role;

    const task = await Task.findById(id)
      .populate("assignedTo", "firstName lastName email role")
      .populate("createdBy", "firstName lastName email role")
      .populate("leadId")
      .populate("quotationId")
      .populate("approvedBy", "firstName lastName email")
      .populate("rejectedBy", "firstName lastName email")
      .lean();

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Check permissions
    if (userRole === "data_tech_admin") {
      // Admin can see all tasks
    } else if (userRole === "data_tech_sales_agent") {
      // Sales agents can only see their own tasks
      if (
        task.assignedTo?._id?.toString() !== userId.toString() &&
        task.createdBy._id.toString() !== userId.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch task",
      error: error.message,
    });
  }
};

// Create lead task when a new lead is received
const createLeadTask = async (leadData) => {
  try {
    const taskData = {
      title: `New Lead: ${leadData.name}`,
      description: `New ${leadData.lead_type} lead received from ${leadData.name}`,
      taskType: "lead",
      status: "pending",
      priority: "medium",
      createdBy: leadData.createdBy || null, // System created
      leadId: leadData._id,
      leadData: {
        name: leadData.name,
        email: leadData.email,
        contact: leadData.contact,
        lead_type: leadData.lead_type,
        service_interested_in: leadData.service_interested_in,
        description: leadData.description,
      },
    };

    const newTask = new Task(taskData);
    const savedTask = await newTask.save();

    return savedTask;
  } catch (error) {
    console.error("Error creating lead task:", error);
    throw error;
  }
};

// Create quotation task when a new quotation is created
const createQuotationTask = async (quotationData, createdBy) => {
  try {
    const taskData = {
      title: `Approve Quotation #${quotationData.DocEntry}`,
      description: `Quotation approval required for ${quotationData.CardName} - Amount: €${quotationData.DocTotal}`,
      taskType: "quotation",
      status: "awaiting_approval",
      priority: quotationData.DocTotal > 10000 ? "high" : "medium",
      createdBy: createdBy,
      quotationId: quotationData._id,
      quotationDocEntry: quotationData.DocEntry,
      customerName: quotationData.CardName,
      quotationAmount: quotationData.DocTotal,
      dueDate:
        quotationData.DocDueDate ||
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    const newTask = new Task(taskData);
    const savedTask = await newTask.save();

    return savedTask;
  } catch (error) {
    console.error("Error creating quotation task:", error);
    throw error;
  }
};

// Assign agent to lead task
const assignAgentToTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;
    const userId = req.user?._id;
    const userRole = req.user?.role;

    // Only admins can assign agents
    if (userRole !== "data_tech_admin") {
      return res.status(403).json({
        success: false,
        message: "Only administrators can assign agents",
      });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (task.taskType !== "lead") {
      return res.status(400).json({
        success: false,
        message: "Can only assign agents to lead tasks",
      });
    }

    // Update task
    const updateData = { assignedTo: agentId };
    const updatedTask = await Task.findByIdAndUpdate(id, updateData, {
      new: true,
    })
      .populate("assignedTo", "firstName lastName email role")
      .populate("createdBy", "firstName lastName email role")
      .populate("leadId");

    // Update the related lead
    if (task.leadId) {
      const agent = await User.findById(agentId);
      await Leads.findByIdAndUpdate(task.leadId, {
        assigned_agent_id: agentId,
        assigned_agent_name: `${agent.firstName} ${agent.lastName}`,
      });

      // Create notification
      try {
        await NotificationService.createTaskAssignedNotification(
          updatedTask,
          userId
        );
      } catch (notificationError) {
        console.error(
          "Error creating assignment notification:",
          notificationError
        );
      }
    }

    res.status(200).json({
      success: true,
      data: updatedTask,
      message: "Agent assigned successfully",
    });
  } catch (error) {
    console.error("Error assigning agent:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign agent",
      error: error.message,
    });
  }
};

// Update task status
const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, rejectionReason, approvalComments } = req.body;
    const userId = req.user?._id;
    const userRole = req.user?.role;

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Status transition rules
    const canUpdateStatus = (currentStatus, newStatus, userRole, taskType) => {
      // Admin can do most transitions
      if (userRole === "data_tech_admin") {
        // Prevent moving back from completed states
        if (["completed", "rejected"].includes(currentStatus)) {
          return false;
        }
        return true;
      }

      // Sales agents have limited permissions
      if (userRole === "data_tech_sales_agent") {
        // Can only update their own lead tasks to awaiting_approval
        if (
          taskType === "lead" &&
          currentStatus === "pending" &&
          newStatus === "awaiting_approval"
        ) {
          return task.assignedTo?.toString() === userId.toString();
        }
        return false;
      }

      return false;
    };

    if (!canUpdateStatus(task.status, status, userRole, task.taskType)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to update this task status",
      });
    }

    const updateData = { status };

    // Handle priority updates (admin only)
    if (priority && userRole === "data_tech_admin") {
      updateData.priority = priority;
    }

    // Add approval/rejection metadata
    if (status === "approved") {
      updateData.approvedBy = userId;
      updateData.approvedDate = new Date();
      updateData.status = "completed"; // Automatically set to completed
      updateData.completedDate = new Date();
      if (approvalComments) {
        updateData.approvalComments = approvalComments;
      }
    } else if (status === "rejected") {
      updateData.rejectedBy = userId;
      updateData.rejectedDate = new Date();
      updateData.completedDate = new Date();
      if (rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }
    }

    const updatedTask = await Task.findByIdAndUpdate(id, updateData, {
      new: true,
    })
      .populate("assignedTo", "firstName lastName email role")
      .populate("createdBy", "firstName lastName email role")
      .populate("leadId")
      .populate("quotationId")
      .populate("approvedBy", "firstName lastName email")
      .populate("rejectedBy", "firstName lastName email");

    // Update related entities
    if (task.taskType === "lead" && task.leadId) {
      let leadStatus = "pending";
      if (status === "awaiting_approval") leadStatus = "awaiting_approval";
      else if (status === "approved" || status === "completed")
        leadStatus = "approved";
      else if (status === "rejected") leadStatus = "rejected";

      await Leads.findByIdAndUpdate(task.leadId, { lead_status: leadStatus });
    } else if (task.taskType === "quotation" && task.quotationId) {
      const quotationUpdateData = {
        approvalStatus: status === "completed" ? "approved" : status,
      };

      if (status === "approved" || status === "completed") {
        quotationUpdateData.approvedBy = userId;
        quotationUpdateData.approvedDate = new Date();
        if (approvalComments) {
          quotationUpdateData.approvalComments = approvalComments;
        }
      } else if (status === "rejected") {
        quotationUpdateData.rejectedBy = userId;
        quotationUpdateData.rejectedDate = new Date();
        quotationUpdateData.IsActive = false;
        if (rejectionReason) {
          quotationUpdateData.rejectionReason = rejectionReason;
        }
      }

      await Quotation.findByIdAndUpdate(task.quotationId, quotationUpdateData);
    }

    // Create status change notification
    try {
      await NotificationService.createTaskStatusNotification(
        updatedTask,
        userId,
        updatedTask.status
      );
    } catch (notificationError) {
      console.error("Error creating status notification:", notificationError);
    }

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: updatedTask,
    });
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update task",
      error: error.message,
    });
  }
};

module.exports = {
  getAllTasks,
  getTaskById,
  createLeadTask,
  createQuotationTask,
  assignAgentToTask,
  updateTaskStatus,
};
