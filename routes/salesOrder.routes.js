const express = require("express");
const {
  createSalesOrder,
  getSalesOrdersByCustomer,
  getAllSalesOrders,
  getSalesOrderById,
  getSalesOrderByDocEntry,
  updateSalesOrder,
  cancelSalesOrder,
  duplicateSalesOrder,
  getSalesOrderStats,
} = require("../controllers/salesOrder.controller");

const router = express.Router();

// Get sales order statistics
router.get("/stats", getSalesOrderStats);

// Get sales orders by customer CardCode
router.get("/customer/:cardCode", getSalesOrdersByCustomer);

// Get sales order by DocEntry
router.get("/docEntry/:docEntry", getSalesOrderByDocEntry);

// Create a new sales order
router.post("/", createSalesOrder);

// Get all sales orders with pagination and filtering
router.get("/", getAllSalesOrders);

// Duplicate sales order
router.post("/:docEntry/duplicate", duplicateSalesOrder);

// Cancel sales order
router.put("/:docEntry/cancel", cancelSalesOrder);

// Get single sales order by ID
router.get("/:id", getSalesOrderById);

// Update sales order by ID
router.put("/:id", updateSalesOrder);

module.exports = router;
