const express = require("express");
const {
  getAllTasks,
  getQuotationApprovalTasks,
  getTaskById,

  updateTaskStatus,
  approveQuotationTask,
  rejectQuotationTask,
} = require("../controllers/quotationTask.controller");

const router = express.Router();
const { auth } = require("../middleware/auth.middleware");
// Get quotation approval tasks for leads board
router.get("/quotation-approvals", auth, getQuotationApprovalTasks);

// Approve quotation task
router.patch("/:id/approve", auth, approveQuotationTask);

// Reject quotation task
router.patch("/:id/reject", auth, rejectQuotationTask);

// Get all tasks
router.get("/", auth, getAllTasks);

// Get single task by ID
router.get("/:id", auth, getTaskById);

// Update task status
router.patch("/:id/status", auth, updateTaskStatus);

module.exports = router;
