const express = require("express");
const {
  getDataTechSalesAgents,
  getUserById,
  getDataTechSalesAgentsForLeads,
} = require("../controllers/users.controller");
const router = express.Router();
router.get("/getSalesAgents", getDataTechSalesAgents);
router.get("/LeadsBoard/getSalesAgents", getDataTechSalesAgentsForLeads);
router.get("/:id", getUserById);

module.exports = router;
