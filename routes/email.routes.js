const express = require("express");
const router = express.Router();
const emailController = require("../controllers/Email.controller");

// Get available email accounts
router.get("/accounts", emailController.getAccounts);

// Get folder counts for specific account
router.get("/:account/counts", emailController.getFolderCounts);

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

// Move email to folder
router.put("/:account/:id/move", emailController.moveToFolder);

// Delete email (move to trash)
router.delete("/:account/:id", emailController.deleteEmail);

// Permanently delete email
router.delete("/:account/:id/permanent", emailController.permanentDelete);

// Search emails in specific account
router.get("/:account/search", emailController.searchEmails);

module.exports = router;
