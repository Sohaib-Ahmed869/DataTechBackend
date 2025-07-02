const express = require("express");
const router = express.Router();
const emailController = require("../controllers/Email.controller"); // Make sure this path matches your file

// Get available email accounts
router.get("/accounts", emailController.getAccounts);

// Get emails for specific account
router.get("/:account", emailController.getEmails);

// Send email from specific account
router.post("/:account/send", emailController.sendEmail);

// Sync emails for specific account
router.post("/:account/sync", emailController.syncEmails);

// Mark email as read/unread
router.put("/:account/:id/read", emailController.markAsRead);

// Toggle star on email
router.put("/:account/:id/star", emailController.toggleStar);

// Delete email
router.delete("/:account/:id", emailController.deleteEmail);

// Search emails in specific account
router.get("/:account/search", emailController.searchEmails);

module.exports = router;
