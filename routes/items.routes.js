const express = require("express");
const router = express.Router();
const {
  getAllItems,
  getItemByCode,
  getAvailableItems,
  getItemCategories,
  searchItems,
} = require("../controllers/items.controller");
const { auth } = require("../middleware/auth.middleware");

// Apply auth middleware to all routes
router.use(auth);

// Get all items with pagination and filtering
router.get("/", getAllItems);

// Search items (for autocomplete)
router.get("/search", searchItems);

// Get available items (with stock)
router.get("/available", getAvailableItems);

// Get item categories
router.get("/categories", getItemCategories);

// Get item by ItemCode
router.get("/:itemCode", getItemByCode);

module.exports = router;
