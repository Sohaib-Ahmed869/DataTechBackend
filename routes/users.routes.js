const express = require("express");
const {
  getDataTechSalesAgents,
  getUserById,
  getDataTechSalesAgentById,
  getDataTechSalesAgentsForLeads,
  getDataTechSalesAgentPerformanceStats,
} = require("../controllers/users.controller");

const router = express.Router();

router.get("/getSalesAgents", getDataTechSalesAgents);
router.get("/LeadsBoard/getSalesAgents", getDataTechSalesAgentsForLeads);
router.get("/datatech-sales-agents/:id", getDataTechSalesAgentById);
router.get(
  "/datatech-sales-agents/:id/performance",
  getDataTechSalesAgentPerformanceStats
);
router.get("/:id", getUserById);

module.exports = router;
