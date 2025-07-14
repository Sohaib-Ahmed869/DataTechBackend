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
  getAllSalesOrdersWithSAPStatus,
  pushOrderToSAP,
} = require("../controllers/salesOrder.controller");

const router = express.Router();

// Get sales order statistics
router.post("/", createSalesOrder);
router.get("/", getAllSalesOrders);
router.get("/stats", getSalesOrderStats);
router.get("/with-sap-status", getAllSalesOrdersWithSAPStatus); // New route with SAP status

// Get sales orders by customer CardCode
router.get("/customer/:cardCode", getSalesOrdersByCustomer);

// Get sales order by DocEntry
router.get("/docEntry/:docEntry", getSalesOrderByDocEntry);

// Create a new sales order

// Get all sales orders with pagination and filtering

// Duplicate sales order
router.post("/:docEntry/duplicate", duplicateSalesOrder);

// Cancel sales order
router.put("/:docEntry/cancel", cancelSalesOrder);

// Get single sales order by ID
router.get("/:id", getSalesOrderById);

// Update sales order by ID
router.put("/:id", updateSalesOrder);
router.post("/sap/push/:docEntry", pushOrderToSAP); // Manual push to SAP

module.exports = router;
