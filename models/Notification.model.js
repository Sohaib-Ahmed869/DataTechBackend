const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const NotificationSchema = new Schema({
  recipient: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: false, // Made optional for system notifications
    default: null,
  },
  type: {
    type: String,
    enum: [
      "task_assigned",
      "task_updated",
      "task_completed",
      "task_approved",
      "task_rejected",
      "lead_assigned",
      "lead_updated",
      "lead_status_changed",
      "lead_unassigned",
      "lead_received", // New type for admin notifications
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  relatedLead: {
    type: Schema.Types.ObjectId,
    ref: "Leads",
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for efficient queries
NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, isRead: 1 });

module.exports = mongoose.model("Notification", NotificationSchema);
