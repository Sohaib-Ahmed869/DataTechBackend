const axios = require("axios");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Rate limiter utility
class RateLimiter {
  constructor(maxRequests = 20, windowMs = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async waitForSlot() {
    const now = Date.now();

    // Remove requests older than the window
    this.requests = this.requests.filter(
      (timestamp) => now - timestamp < this.windowMs
    );

    // If we're at the limit, wait until we can make another request
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.windowMs - (now - oldestRequest);

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime + 10)); // Add 10ms buffer
        return this.waitForSlot(); // Recursive call to check again
      }
    }

    // Record this request
    this.requests.push(now);
  }
}

// Create rate limiter instance
const rateLimiter = new RateLimiter(20, 1000); // 20 requests per second

// Helper function to process activities into statistics
const processActivitiesIntoStats = (activities) => {
  const stats = {
    emailsSent: 0,
    emailsOpened: 0,
    emailsClicked: 0,
    emailsReplied: 0,
    emailsBounced: 0,
    unsubscribed: 0,
    interested: 0,
    uniqueLeads: new Set(),
    activities: [],
  };

  activities.forEach((activity) => {
    const type = activity.type || activity.metaData?.type;

    // Track unique leads
    if (activity.leadId) {
      stats.uniqueLeads.add(activity.leadId);
    }

    // Count different activity types
    switch (type) {
      case "emailsSent":
        stats.emailsSent++;
        break;
      case "emailsOpened":
        stats.emailsOpened++;
        break;
      case "emailsClicked":
        stats.emailsClicked++;
        break;
      case "emailsReplied":
        stats.emailsReplied++;
        break;
      case "emailsBounced":
        stats.emailsBounced++;
        break;
      case "unsubscribed":
        stats.unsubscribed++;
        break;
      case "interested":
        stats.interested++;
        break;
    }

    // Store activity for detailed view
    stats.activities.push({
      id: activity._id,
      type: type,
      leadEmail: activity.leadEmail,
      leadFirstName: activity.leadFirstName,
      leadLastName: activity.leadLastName,
      createdAt: activity.createdAt,
      campaignName: activity.name,
    });
  });

  // Convert Set to count
  stats.totalUniqueLeads = stats.uniqueLeads.size;
  delete stats.uniqueLeads; // Remove Set as it's not JSON serializable

  // Calculate rates
  if (stats.emailsSent > 0) {
    stats.openRate = ((stats.emailsOpened / stats.emailsSent) * 100).toFixed(2);
    stats.clickRate = ((stats.emailsClicked / stats.emailsSent) * 100).toFixed(
      2
    );
    stats.replyRate = ((stats.emailsReplied / stats.emailsSent) * 100).toFixed(
      2
    );
    stats.bounceRate = ((stats.emailsBounced / stats.emailsSent) * 100).toFixed(
      2
    );
  } else {
    stats.openRate = "0.00";
    stats.clickRate = "0.00";
    stats.replyRate = "0.00";
    stats.bounceRate = "0.00";
  }

  return stats;
};

// Base configuration
const BASE_URL = "https://api.lemlist.com/api";
const API_KEY = process.env.LEMLIST_API_KEY;

// Create axios instance
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Generic API request function
const makeRequest = async (endpoint, method = "GET", data = null) => {
  try {
    // Wait for rate limit slot
    await rateLimiter.waitForSlot();

    // Handle URL construction properly
    let url;
    if (endpoint.includes("?")) {
      // If endpoint already has query parameters, append the access token
      url = `${endpoint}&access_token=${API_KEY}`;
    } else {
      // If no query parameters, add access token as first parameter
      url = `${endpoint}?access_token=${API_KEY}`;
    }

    const config = {
      method,
      url,
      data,
    };

    console.log(`Making ${method} request to: ${BASE_URL}${url}`);

    const response = await axiosInstance(config);
    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    console.error(
      `Lemlist API Error [${endpoint}]:`,
      error.response?.data || error.message
    );

    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message,
        status: error.response?.status,
        code: error.code,
        details: error.response?.data,
      },
    };
  }
};

// Fetch single campaign details
const getCampaignData = async (campaignId) => {
  try {
    if (!API_KEY) {
      throw new Error("LEMLIST_API_KEY not found in environment variables");
    }

    const response = await makeRequest(`/campaigns/${campaignId}`);

    if (!response.success) {
      throw new Error(response.error.message);
    }

    return {
      success: true,
      campaign: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// Fetch all campaigns
const getCampaignsData = async () => {
  try {
    if (!API_KEY) {
      throw new Error("LEMLIST_API_KEY not found in environment variables");
    }

    const response = await makeRequest("/campaigns");

    if (!response.success) {
      throw new Error(response.error.message);
    }

    return {
      success: true,
      campaigns: response.data,
      count: response.data?.length || 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// Fetch campaign statistics (activities) - UPDATED VERSION
const getCampaignStatsData = async (
  campaignId,
  startDate = null,
  endDate = null
) => {
  if (!campaignId) {
    return {
      success: false,
      error: "Campaign ID is required",
    };
  }

  try {
    if (!API_KEY) {
      throw new Error("LEMLIST_API_KEY not found in environment variables");
    }

    let finalStartDate = startDate;
    let finalEndDate = endDate || new Date().toISOString().split("T")[0];

    // If no start date is provided, fetch campaign details to get creation date
    if (!finalStartDate) {
      console.log(
        `Fetching campaign details to get creation date for campaign ${campaignId}`
      );

      const campaignResult = await getCampaignData(campaignId);

      if (campaignResult.success && campaignResult.campaign) {
        const campaign = campaignResult.campaign;

        // Try different possible field names for creation date
        const createdAt =
          campaign.createdAt || campaign.created_at || campaign.creationDate;

        if (createdAt) {
          // Convert to YYYY-MM-DD format
          const campaignCreationDate = new Date(createdAt);
          finalStartDate = campaignCreationDate.toISOString().split("T")[0];
          console.log(
            `Using campaign creation date as start date: ${finalStartDate}`
          );
        } else {
          console.log(
            `No creation date found for campaign ${campaignId}, using default 60 days ago`
          );
          // Fallback to 60 days ago if creation date not found
          const defaultStartDate = new Date();
          defaultStartDate.setDate(defaultStartDate.getDate() - 60);
          finalStartDate = defaultStartDate.toISOString().split("T")[0];
        }
      } else {
        console.log(
          `Failed to fetch campaign details for ${campaignId}, using default 60 days ago`
        );
        // Fallback to 60 days ago if campaign fetch fails
        const defaultStartDate = new Date();
        defaultStartDate.setDate(defaultStartDate.getDate() - 60);
        finalStartDate = defaultStartDate.toISOString().split("T")[0];
      }
    }

    // Build the endpoint with date parameters
    const endpoint = `/v2/campaigns/${campaignId}/stats?startDate=${finalStartDate}&endDate=${finalEndDate}`;

    console.log(
      `Fetching stats for campaign ${campaignId} from ${finalStartDate} to ${finalEndDate}`
    );

    const response = await makeRequest(endpoint);

    if (!response.success) {
      throw new Error(response.error.message);
    }

    // The stats endpoint returns structured data
    const stats = response.data || {};

    return {
      success: true,
      stats: stats,
      campaignId,
      dateRange: {
        startDate: finalStartDate,
        endDate: finalEndDate,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      campaignId,
    };
  }
};

// Fetch all activities
const getAllActivitiesData = async () => {
  try {
    if (!API_KEY) {
      throw new Error("LEMLIST_API_KEY not found in environment variables");
    }

    const response = await makeRequest("/activities");

    if (!response.success) {
      throw new Error(response.error.message);
    }

    return {
      success: true,
      activities: response.data,
      count: response.data?.length || 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// Fetch campaigns with their statistics (batch operation)
const getCampaignsWithStatsData = async () => {
  try {
    if (!API_KEY) {
      throw new Error("LEMLIST_API_KEY not found in environment variables");
    }

    // First, get all campaigns
    const campaignsResult = await getCampaignsData();

    if (!campaignsResult.success) {
      return campaignsResult;
    }

    const campaigns = campaignsResult.campaigns;

    if (!campaigns || campaigns.length === 0) {
      return {
        success: true,
        campaigns: [],
        message: "No campaigns found",
      };
    }

    // Fetch stats for each campaign (will automatically use creation date as start date)
    const campaignsWithStats = [];

    for (const campaign of campaigns) {
      const statsResult = await getCampaignStatsData(
        campaign._id || campaign.id
      );

      const campaignData = {
        ...campaign,
        statistics: statsResult.success ? statsResult.stats : null,
        statsError: statsResult.success ? null : statsResult.error,
        statsDateRange: statsResult.success ? statsResult.dateRange : null,
      };

      campaignsWithStats.push(campaignData);
    }

    return {
      success: true,
      campaigns: campaignsWithStats,
      count: campaignsWithStats.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// Get rate limiter status
const getRateLimiterStatusData = () => {
  const now = Date.now();
  const recentRequests = rateLimiter.requests.filter(
    (timestamp) => now - timestamp < rateLimiter.windowMs
  );

  return {
    maxRequests: rateLimiter.maxRequests,
    windowMs: rateLimiter.windowMs,
    currentRequests: recentRequests.length,
    remainingRequests: rateLimiter.maxRequests - recentRequests.length,
    resetTime:
      recentRequests.length > 0
        ? Math.max(...recentRequests) + rateLimiter.windowMs
        : now,
  };
};

// Test API connectivity
const testApiConnectivity = async () => {
  try {
    if (!API_KEY) {
      throw new Error("LEMLIST_API_KEY not found in environment variables");
    }

    // Test with a simple team endpoint
    const response = await makeRequest("/team");

    return {
      success: response.success,
      message: response.success
        ? "API connection successful"
        : "API connection failed",
      error: response.success ? null : response.error,
    };
  } catch (error) {
    return {
      success: false,
      message: "API connection failed",
      error: error.message,
    };
  }
};

// Middleware to handle API responses
const handleResponse = (res, result) => {
  if (result.success) {
    return res.status(200).json({
      success: true,
      ...result,
    });
  } else {
    return res.status(400).json({
      success: false,
      error: result.error,
    });
  }
};

// Middleware to validate API key
const validateApiKey = (req, res, next) => {
  if (!API_KEY) {
    return res.status(500).json({
      success: false,
      error: "LEMLIST_API_KEY not configured in environment variables",
    });
  }
  next();
};

// Controller endpoint functions
const getCampaigns = async (req, res) => {
  try {
    console.log("Fetching campaigns from Lemlist...");
    console.log("API Key exists:", !!API_KEY);
    console.log(
      "API Key preview:",
      API_KEY ? `${API_KEY.substring(0, 8)}...` : "undefined"
    );

    const result = await getCampaignsData();

    console.log(`Found ${result.count || 0} campaigns`);
    handleResponse(res, result);
  } catch (error) {
    console.error("Error fetching campaigns:", error.message);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error while fetching campaigns",
    });
  }
};

const getCampaignStats = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { startDate, endDate } = req.query;

    console.log(`Fetching stats for campaign: ${campaignId}`);
    const result = await getCampaignStatsData(campaignId, startDate, endDate);

    handleResponse(res, result);
  } catch (error) {
    console.error("Error fetching campaign stats:", error.message);
    res.status(500).json({
      success: false,
      error:
        error.message ||
        "Internal server error while fetching campaign statistics",
    });
  }
};

const getCampaignsWithStats = async (req, res) => {
  try {
    console.log("Fetching campaigns with statistics...");
    console.log("API Key exists:", !!API_KEY);

    // Set a longer timeout for this endpoint due to multiple API calls
    req.setTimeout(120000); // 2 minutes

    const result = await getCampaignsWithStatsData();

    console.log(`Processed ${result.count || 0} campaigns with statistics`);
    handleResponse(res, result);
  } catch (error) {
    console.error("Error fetching campaigns with stats:", error.message);
    res.status(500).json({
      success: false,
      error:
        error.message ||
        "Internal server error while fetching campaigns with statistics",
    });
  }
};

const getRateLimiterStatus = (req, res) => {
  try {
    const status = getRateLimiterStatusData();

    res.status(200).json({
      success: true,
      rateLimitStatus: status,
    });
  } catch (error) {
    console.error("Error getting rate limit status:", error.message);
    res.status(500).json({
      success: false,
      error:
        error.message ||
        "Internal server error while getting rate limit status",
    });
  }
};

const healthCheck = async (req, res) => {
  try {
    console.log("Running health check...");
    console.log("Environment check - API Key exists:", !!API_KEY);
    console.log(
      "API Key preview:",
      API_KEY ? `${API_KEY.substring(0, 8)}...` : "undefined"
    );

    // Test API connectivity
    const connectivityTest = await testApiConnectivity();

    // Also test campaigns endpoint
    const campaignsTest = await getCampaignsData();

    const healthStatus = {
      lemlistApi:
        connectivityTest.success && campaignsTest.success
          ? "connected"
          : "error",
      apiKey: API_KEY ? "configured" : "missing",
      connectivity: connectivityTest,
      rateLimiter: getRateLimiterStatusData(),
      timestamp: new Date().toISOString(),
    };

    const statusCode =
      connectivityTest.success && campaignsTest.success ? 200 : 503;

    res.status(statusCode).json({
      success: connectivityTest.success && campaignsTest.success,
      health: healthStatus,
      error:
        connectivityTest.success && campaignsTest.success
          ? null
          : connectivityTest.error || campaignsTest.error,
    });
  } catch (error) {
    console.error("Health check error:", error.message);
    res.status(503).json({
      success: false,
      health: {
        lemlistApi: "error",
        apiKey: API_KEY ? "configured" : "missing",
        timestamp: new Date().toISOString(),
      },
      error: error.message || "Health check failed",
    });
  }
};

const getAllActivities = async (req, res) => {
  try {
    console.log("Fetching all activities from Lemlist...");
    console.log("API Key exists:", !!API_KEY);

    const result = await getAllActivitiesData();

    console.log(`Found ${result.count || 0} activities`);
    handleResponse(res, result);
  } catch (error) {
    console.error("Error fetching activities:", error.message);
    res.status(500).json({
      success: false,
      error: error.message || "Internal server error while fetching activities",
    });
  }
};

module.exports = {
  getCampaigns,
  getCampaignStats,
  getCampaignsWithStats,
  getRateLimiterStatus,
  healthCheck,
  getAllActivities,
  validateApiKey,
  // Export utility functions
  getCampaignsData,
  getCampaignData, // Added new function export
  getCampaignStatsData,
  getCampaignsWithStatsData,
  getAllActivitiesData,
  testApiConnectivity,
};
