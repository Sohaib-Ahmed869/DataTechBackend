const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth.middleware");
const {
  getCampaigns,
  getCampaignStats,
  getCampaignsWithStats,
  getRateLimiterStatus,
  healthCheck,
  validateApiKey,
  getAllActivities,
} = require("../controllers/lemlist.controller");

/**
 * GET /api/lemlist/campaigns
 * Fetch all campaigns from Lemlist
 */
router.get("/campaigns", auth, validateApiKey, getCampaigns);

/**
 * GET /api/lemlist/campaigns/:campaignId/stats
 * Fetch statistics for a specific campaign
 */
router.get(
  "/campaigns/:campaignId/stats",
  auth,
  validateApiKey,
  getCampaignStats
);

/**
 * GET /api/lemlist/campaigns-with-stats
 * Fetch all campaigns with their statistics
 * Note: This endpoint will make multiple API calls and may take longer
 */
router.get(
  "/campaigns-with-stats",
  auth,
  validateApiKey,
  getCampaignsWithStats
);

/**
 * GET /api/lemlist/rate-limit-status
 * Get current rate limiter status (useful for debugging)
 */
router.get("/rate-limit-status", auth, validateApiKey, getRateLimiterStatus);
/**
 * GET /api/lemlist/activities
 * Fetch all activities from Lemlist
 */
router.get("/activities", auth, validateApiKey, getAllActivities);
/**
 * GET /api/lemlist/health
 * Health check endpoint to verify API connectivity
 * Note: Health check doesn't require validateApiKey as it performs its own validation
 */
router.get("/health", auth, healthCheck);

module.exports = router;
