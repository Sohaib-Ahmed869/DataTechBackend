const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TaskSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: String,

    // Task type to differentiate between leads and quotations
    taskType: {
      type: String,
      enum: ["lead", "quotation"],
      required: true,
    },

    // Updated status system - approved tasks automatically go to completed
    status: {
      type: String,
      enum: [
        "pending",
        "awaiting_approval",
        "approved",
        "rejected",
        "completed",
      ],
      default: function () {
        return this.taskType === "lead" ? "pending" : "awaiting_approval";
      },
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    dueDate: Date,
    completedDate: Date,

    // Lead-specific fields
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Leads",
      required: function () {
        return this.taskType === "lead";
      },
    },

    // Lead data (denormalized for performance)
    leadData: {
      name: String,
      email: String,
      contact: String,
      lead_type: String,
      service_interested_in: String,
      description: String,
    },

    // Quotation-specific fields
    quotationId: {
      type: Schema.Types.ObjectId,
      ref: "Quotation",
      required: function () {
        return this.taskType === "quotation";
      },
    },

    quotationDocEntry: {
      type: Number,
      required: function () {
        return this.taskType === "quotation";
      },
    },

    customerName: {
      type: String,
      required: function () {
        return this.taskType === "quotation";
      },
    },

    quotationAmount: {
      type: Number,
      default: 0,
    },

    // Approval fields
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    approvedDate: Date,
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    rejectedDate: Date,
    rejectionReason: String,
    approvalComments: String,

    // Additional metadata
    metadata: {
      type: Map,
      of: String,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "Tasks",
  }
);

// Pre-save middleware to automatically set status to completed when approved
TaskSchema.pre("save", function (next) {
  if (this.isModified("status") && this.status === "approved") {
    this.status = "completed";
    this.completedDate = new Date();
  }
  next();
});

// Pre-update middleware for findOneAndUpdate operations
TaskSchema.pre(
  ["findOneAndUpdate", "updateOne", "updateMany"],
  function (next) {
    const update = this.getUpdate();
    if (update.$set && update.$set.status === "approved") {
      update.$set.status = "completed";
      update.$set.completedDate = new Date();
    } else if (update.status === "approved") {
      update.status = "completed";
      update.completedDate = new Date();
    }
    next();
  }
);

// Indexes for better performance
TaskSchema.index({ assignedTo: 1 });
TaskSchema.index({ createdBy: 1 });
TaskSchema.index({ taskType: 1 });
TaskSchema.index({ status: 1 });
TaskSchema.index({ leadId: 1 });
TaskSchema.index({ quotationId: 1 });
TaskSchema.index({ quotationDocEntry: 1 });
TaskSchema.index({ createdAt: 1 });
TaskSchema.index({ isActive: 1 });
TaskSchema.index({ priority: 1 });

// Compound indexes
TaskSchema.index({ taskType: 1, status: 1 });
TaskSchema.index({ createdBy: 1, status: 1 });
TaskSchema.index({ assignedTo: 1, status: 1 });

const Task = mongoose.model("Task", TaskSchema);
module.exports = Task;
