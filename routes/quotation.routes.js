const express = require("express");
const {
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
} = require("../controllers/quotation.controller");
const { auth } = require("../middleware/auth.middleware");
const router = express.Router();

// Stats endpoint - must come before /:docEntry
router.get("/stats", auth, getQuotationStats);

// Export endpoint
router.get("/export", auth, exportQuotations);

// Bulk operations
router.post("/bulk-approve", auth, bulkApproveQuotations);
router.post("/bulk-reject", auth, bulkRejectQuotations);

// Get all quotations with pagination and filtering
router.get("/", auth, getAllQuotations);

// Get quotations for a specific customer
router.get("/cardCode/:cardCode", auth, getCustomerQuotations);

// Payment operations
router.post("/:docNum/payment-link", auth, generatePaymentLink);
router.get("/:docNum/payment-status", auth, getPaymentStatus);

// Email operations
router.post("/:docEntry/send-email", auth, sendQuotationByEmail);

// Approval operations
router.patch("/:docEntry/approve", auth, approveQuotation);
router.patch("/:docEntry/reject", auth, rejectQuotation);

// Get single quotation by DocEntry - must come after specific routes
router.get("/:docEntry", auth, getQuotationByDocEntry);

// Create new quotation
router.post("/", auth, createQuotation);

// Update quotation
router.patch("/:docEntry", auth, updateQuotation);

// Convert quotation to order
router.post("/:docEntry/convert", auth, convertToOrder);

// Cancel quotation
router.patch("/:docEntry/cancel", auth, cancelQuotation);

// Duplicate quotation
router.post("/:docEntry/duplicate", auth, duplicateQuotation);

module.exports = router;
