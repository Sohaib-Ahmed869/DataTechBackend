const express = require("express");
const {
  getAdminDashboardStats,
} = require("../controllers/AdminDashboardStats.controller");
const router = express.Router();

router.get("/stats", getAdminDashboardStats);
module.exports = router;
