const express = require("express");
const {
  getAllCustomers,
  getCustomerById,
  getCustomerByCardCode,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  searchCustomers,
  getCustomersWithMetrics,
  assignSalesAgent,
  getCustomerStats,
  getAgentAssignedCustomers,
} = require("../controllers/customer.controller");

const router = express.Router();

// Get customer statistics
router.get("/stats", getCustomerStats);

// Get customer by CardCode
router.get("/cardCode/:cardCode", getCustomerByCardCode);

// Create a new customer
router.post("/", createCustomer);

// Get all customers with pagination and filtering
router.get("/", getAllCustomers);

// Get customers with metrics (sales orders, quotations)
router.get("/with-metrics", getCustomersWithMetrics);

// Assign sales agent to customer
router.put("/:customerId/assign-agent", assignSalesAgent);
// Get single customer by ID

router.get("/:id", getCustomerById);
router.get("/agent-assigned-customers/:agentId", getAgentAssignedCustomers);

// Search customers (must be before /:id route)
router.get("/search", searchCustomers);
// Update customer by ID
router.put("/:id", updateCustomer);

// Delete customer by ID
router.delete("/:id", deleteCustomer);

module.exports = router;
