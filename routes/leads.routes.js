// Updated routes file with new endpoints

const express = require("express");
const {
  getLeads,
  getLeadsByAgentForLeadsBoard,
  updateLeadStatus,
  assignAgent,
  addRemarks,
  getLeadById,
  getLeadsforLeadsBoard,
  getLeadsByAgentId,
} = require("../controllers/leads.controller");

const router = express.Router();

// Existing routes
router.get("/", getLeads);
router.get("/allLeads", getLeadsforLeadsBoard);
router.get("/agentLeads/:agentId", getLeadsByAgentForLeadsBoard);

// New routes for lead board functionality
router.get("/:leadId", getLeadById);
router.get("/:agentId/leadsAssigned", getLeadsByAgentId);
router.put("/:leadId/status", updateLeadStatus);
router.put("/:leadId/assign", assignAgent);
router.put("/:leadId/remarks", addRemarks);

module.exports = router;
