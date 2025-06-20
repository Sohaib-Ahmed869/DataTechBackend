const Notification = require("../models/Notification.model");
const Leads = require("../models/Leads.model");
const User = require("../models/user.model");

class NotificationService {
  static async createNotification({
    recipient,
    sender = null,
    type,
    title,
    message,
    relatedTask = null,
    relatedLead = null,
  }) {
    try {
      // Don't create notification if sender and recipient are the same (only when sender exists)
      if (sender && sender.toString() === recipient.toString()) {
        return null;
      }

      const notification = new Notification({
        recipient,
        sender, // Can be null for system notifications
        type,
        title,
        message,
        relatedTask,
        relatedLead,
      });

      await notification.save();
      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }
  static async createNewLeadNotification(lead) {
    try {
      // Find the admin user (assuming role is 'data_tech_admin')
      const admin = await User.findOne({ role: "data_tech_admin" });

      if (!admin) {
        console.error("Admin user not found for new lead notification");
        return null;
      }

      const title = "New Lead Received";
      const message = `A new lead "${lead.name}" (${lead.lead_type}) has been received and is awaiting assignment`;

      return this.createNotification({
        recipient: admin._id,
        sender: null, // No sender for system notifications
        type: "lead_received",
        title,
        message,
        relatedLead: lead._id,
      });
    } catch (error) {
      console.error("Error creating new lead notification:", error);
      throw error;
    }
  }
  // Lead-specific notification methods
  static async createLeadAssignedNotification(lead, assignedBy, agent) {
    const title = "New Lead Assigned";
    const message = `You have been assigned a new lead: "${lead.name}" (${lead.lead_type})`;

    return this.createNotification({
      recipient: agent._id,
      sender: assignedBy,
      type: "lead_assigned",
      title,
      message,
      relatedLead: lead._id,
    });
  }

  static async createLeadUnassignedNotification(
    lead,
    unassignedBy,
    previousAgent
  ) {
    const title = "Lead Unassigned";
    const message = `Lead "${lead.name}" of type (${lead.lead_type}) has been unassigned from you`;

    return this.createNotification({
      recipient: previousAgent._id,
      sender: unassignedBy,
      type: "lead_unassigned",
      title,
      message,
      relatedLead: lead._id,
    });
  }

  static async createLeadReassignedNotification(
    lead,
    reassignedBy,
    previousAgent,
    newAgent
  ) {
    const notifications = [];

    // Notify previous agent
    if (previousAgent) {
      notifications.push(
        this.createNotification({
          recipient: previousAgent._id,
          sender: reassignedBy,
          type: "lead_unassigned",
          title: "Lead Reassigned",
          message: `Lead "${lead.name}" of type (${lead.lead_type}) has been reassigned to another agent`,
          relatedLead: lead._id,
        })
      );
    }

    // Notify new agent
    notifications.push(
      this.createNotification({
        recipient: newAgent._id,
        sender: reassignedBy,
        type: "lead_assigned",
        title: "New Lead Assigned",
        message: `You have been assigned a lead: "${lead.name}" (${lead.lead_type})`,
        relatedLead: lead._id,
      })
    );

    return Promise.all(notifications);
  }

  static async createLeadStatusChangedNotification(
    lead,
    updatedBy,
    newStatus,
    oldStatus
  ) {
    if (!lead.assigned_agent_id) {
      return null; // No agent to notify
    }

    const title = "Lead Status Updated";
    const message = `Lead "${lead.name}" status changed from "${oldStatus}" to "${newStatus}"`;

    return this.createNotification({
      recipient: lead.assigned_agent_id,
      sender: updatedBy,
      type: "lead_status_changed",
      title,
      message,
      relatedLead: lead._id,
    });
  }

  // Task-specific methods (keeping existing functionality)
  static async createTaskAssignedNotification(task, assignedBy) {
    const title = "New Task Assigned";
    const message = `You have been assigned a new task: "${task.title}"`;

    return this.createNotification({
      recipient: task.assignedTo,
      sender: assignedBy,
      type: "task_assigned",
      title,
      message,
      relatedTask: task._id,
      relatedLead: task.leadId,
    });
  }

  static async createTaskUpdatedNotification(
    task,
    updatedBy,
    previousAssignee = null
  ) {
    // If task was reassigned, notify both old and new assignee
    const notifications = [];

    if (
      previousAssignee &&
      previousAssignee.toString() !== task.assignedTo.toString()
    ) {
      // Notify previous assignee
      notifications.push(
        this.createNotification({
          recipient: previousAssignee,
          sender: updatedBy,
          type: "task_updated",
          title: "Task Reassigned",
          message: `Task "${task.title}" has been reassigned to someone else`,
          relatedTask: task._id,
        })
      );

      // Notify new assignee
      notifications.push(
        this.createNotification({
          recipient: task.assignedTo,
          sender: updatedBy,
          type: "task_assigned",
          title: "New Task Assigned",
          message: `You have been assigned a task: "${task.title}"`,
          relatedTask: task._id,
        })
      );
    } else {
      // Regular update notification
      notifications.push(
        this.createNotification({
          recipient: task.assignedTo,
          sender: updatedBy,
          type: "task_updated",
          title: "Task Updated",
          message: `Task "${task.title}" has been updated`,
          relatedTask: task._id,
        })
      );
    }

    return Promise.all(notifications);
  }

  static async createTaskStatusNotification(task, updatedBy, newStatus) {
    let title, message, type;

    switch (newStatus) {
      case "completed":
        title = "Task Completed";
        message = `Task "${task.title}" has been completed`;
        type = "task_completed";
        break;
      case "pending_approval":
        title = "Task Awaiting Approval";
        message = `Task "${task.title}" is awaiting your approval`;
        type = "task_updated";
        break;
      case "approved":
        title = "Task Approved";
        message = `Your task "${task.title}" has been approved`;
        type = "task_approved";
        break;
      case "rejected":
        title = "Task Rejected";
        message = `Your task "${task.title}" has been rejected`;
        type = "task_rejected";
        break;
      default:
        title = "Task Status Changed";
        message = `Task "${task.title}" status changed to ${newStatus}`;
        type = "task_updated";
    }

    // Notify task creator if status changed by assignee
    if (newStatus === "pending_approval") {
      return this.createNotification({
        recipient: task.createdBy,
        sender: updatedBy,
        type,
        title,
        message,
        relatedTask: task._id,
      });
    }

    // Notify assignee for other status changes
    return this.createNotification({
      recipient: task.assignedTo,
      sender: updatedBy,
      type,
      title,
      message,
      relatedTask: task._id,
    });
  }

  // Utility methods
  static async markAsRead(notificationId, userId) {
    return Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true },
      { new: true }
    );
  }

  static async markAllAsRead(userId) {
    return Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true }
    );
  }

  static async getUserNotifications(userId, limit = 20, skip = 0) {
    return Notification.find({ recipient: userId })
      .populate("sender", "firstName lastName")
      .populate("relatedLead", "name lead_type")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();
  }

  static async getUnreadCount(userId) {
    return Notification.countDocuments({ recipient: userId, isRead: false });
  }

  static async deleteNotification(notificationId, userId) {
    return Notification.findOneAndDelete({
      _id: notificationId,
      recipient: userId,
    });
  }
}

module.exports = NotificationService;
