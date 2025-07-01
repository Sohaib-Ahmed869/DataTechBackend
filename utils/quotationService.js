const Quotation = require("../models/Quotation.model");
const { createQuotationTask } = require("../controllers/task.controller");
const NotificationService = require("./notificationService");

const quotationService = {
  // Create quotation with automatic task creation
  createQuotationWithTask: async (quotationData, createdBy) => {
    try {
      // Generate DocEntry
      const lastQuotation = await Quotation.findOne().sort({ DocEntry: -1 });
      const newDocEntry = lastQuotation ? lastQuotation.DocEntry + 1 : 1;
      const newDocNum = newDocEntry;

      // Prepare quotation data
      const finalQuotationData = {
        ...quotationData,
        DocEntry: newDocEntry,
        DocNum: newDocNum,
        DocDate: quotationData.DocDate || new Date(),
        DocDueDate: quotationData.DocDueDate || new Date(),
        salesAgent: quotationData.salesAgent || createdBy,
        CreationDate: new Date(),
        UpdateDate: new Date(),
        IsActive: true,
        assignedTo: createdBy,
        approvalStatus: "awaiting_approval", // Changed from "pending" to match task system
      };

      // Create quotation
      const newQuotation = new Quotation(finalQuotationData);
      const savedQuotation = await newQuotation.save();

      // Create quotation task using our unified task system
      const quotationTask = await createQuotationTask(
        savedQuotation,
        createdBy,
        {
          // Pass additional data for task creation
          assignedTo: quotationData.assignedTo || createdBy, // Who should approve this quotation
          dueDate: quotationData.DocDueDate,
          priority: quotationData.priority || "medium",
        }
      );

      // Update quotation with task reference
      await Quotation.findByIdAndUpdate(savedQuotation._id, {
        approvalTask: quotationTask._id,
      });

      // Create admin notification for new quotation (if NotificationService exists)
      try {
        if (
          NotificationService &&
          NotificationService.createNewQuotationNotification
        ) {
          await NotificationService.createNewQuotationNotification(
            savedQuotation,
            quotationTask
          );
        }
      } catch (notificationError) {
        console.error(
          "Error creating quotation notification:",
          notificationError
        );
      }

      // Return populated quotation
      const populatedQuotation = await Quotation.findById(savedQuotation._id)
        .populate("salesAgent", "firstName lastName email")
        .populate("approvalTask")
        .lean();

      return {
        success: true,
        data: populatedQuotation,
        task: quotationTask,
      };
    } catch (error) {
      console.error("Error creating quotation with task:", error);
      throw error;
    }
  },

  // Update quotation approval status
  updateQuotationApproval: async (
    quotationId,
    status,
    userId,
    additionalData = {}
  ) => {
    try {
      const updateData = {
        approvalStatus: status,
        UpdateDate: new Date(),
      };

      if (status === "approved") {
        updateData.approvedBy = userId;
        updateData.approvedDate = new Date();
        if (additionalData.approvalComments) {
          updateData.approvalComments = additionalData.approvalComments;
        }
      } else if (status === "rejected") {
        updateData.rejectedBy = userId;
        updateData.rejectedDate = new Date();
        updateData.IsActive = false;
        if (additionalData.rejectionReason) {
          updateData.rejectionReason = additionalData.rejectionReason;
        }
      }

      const updatedQuotation = await Quotation.findByIdAndUpdate(
        quotationId,
        updateData,
        { new: true }
      )
        .populate("salesAgent", "firstName lastName email")
        .populate("approvalTask");

      return updatedQuotation;
    } catch (error) {
      console.error("Error updating quotation approval:", error);
      throw error;
    }
  },
};

module.exports = quotationService;
