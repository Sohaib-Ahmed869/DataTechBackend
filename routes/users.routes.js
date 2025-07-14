const express = require("express");
const {
  getDataTechSalesAgents,
  getUserById,
  getDataTechSalesAgentById,
  getDataTechSalesAgentsForLeads,
  getDataTechSalesAgentPerformanceStats,
  activateUser,
  deactivateUser,
  toggleUserActivation,
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
router.patch("/:id/activate", activateUser);
router.patch("/:id/deactivate", deactivateUser);
router.patch("/:id/toggle-activation", toggleUserActivation);
module.exports = router;
