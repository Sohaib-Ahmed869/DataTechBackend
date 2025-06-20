const Leads = require("../models/Leads.model");
const User = require("../models/user.model");
const getAdminDashboardStats = async (req, res) => {
  try {
    // Get current date and week start date
    const now = new Date();
    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // End of current week (Saturday)
    endOfWeek.setHours(23, 59, 59, 999);

    // 1. Get total leads count
    const totalLeads = await Leads.countDocuments();

    // 2. Get total sales agents count
    const totalSalesAgents = await User.countDocuments({
      role: { $in: ["sales_agent", "data_tech_sales_agent"] },
      deactivated: false,
    });

    // 3. Get leads assigned to each agent
    const leadsPerAgent = await Leads.aggregate([
      {
        $match: {
          assigned_agent_id: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$assigned_agent_id",
          leadCount: { $sum: 1 },
          agentName: { $first: "$assigned_agent_name" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "agentDetails",
        },
      },
      {
        $project: {
          agentId: "$_id",
          leadCount: 1,
          agentName: {
            $cond: {
              if: { $gt: [{ $size: "$agentDetails" }, 0] },
              then: {
                $concat: [
                  { $arrayElemAt: ["$agentDetails.firstName", 0] },
                  " ",
                  { $arrayElemAt: ["$agentDetails.lastName", 0] },
                ],
              },
              else: "$agentName",
            },
          },
        },
      },
      {
        $sort: { leadCount: -1 },
      },
    ]);

    // 4. Get unassigned leads count
    const unassignedLeads = await Leads.countDocuments({
      $or: [
        { assigned_agent_id: null },
        { assigned_agent_id: { $exists: false } },
      ],
    });

    // 5. Get leads by status
    const leadsByStatus = await Leads.aggregate([
      {
        $group: {
          _id: "$lead_status",
          count: { $sum: 1 },
        },
      },
    ]);

    // 6. Get leads received this week for graph (daily breakdown)
    const leadsThisWeek = await Leads.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startOfWeek,
            $lte: endOfWeek,
          },
        },
      },
      {
        $group: {
          _id: {
            $dayOfWeek: "$createdAt",
          },
          count: { $sum: 1 },
          date: {
            $first: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Transform weekly data for frontend consumption
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyGraphData = [];

    for (let i = 0; i < 7; i++) {
      const dayData = leadsThisWeek.find((day) => day._id === i + 1);
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);

      weeklyGraphData.push({
        day: daysOfWeek[i],
        date: currentDate.toISOString().split("T")[0],
        leads: dayData ? dayData.count : 0,
      });
    }

    // 7. Get recent activity (last 10 leads)
    const recentActivity = await Leads.find()
      .populate("assigned_agent_id", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(10)
      .select("name lead_type lead_status createdAt assigned_agent_name")
      .lean();

    // 8. Calculate conversion rate
    const totalClosedLeads = await Leads.countDocuments({
      lead_status: "Closed",
    });
    const successfulLeads = await Leads.countDocuments({
      lead_remarks: "Successful",
    });
    const conversionRate =
      totalLeads > 0 ? ((successfulLeads / totalLeads) * 100).toFixed(1) : 0;

    // 9. Get top performing agents (by successful leads)
    const topPerformers = await Leads.aggregate([
      {
        $match: {
          assigned_agent_id: { $ne: null },
          lead_remarks: "Successful",
        },
      },
      {
        $group: {
          _id: "$assigned_agent_id",
          successfulLeads: { $sum: 1 },
          agentName: { $first: "$assigned_agent_name" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "agentDetails",
        },
      },
      {
        $project: {
          agentId: "$_id",
          successfulLeads: 1,
          agentName: {
            $cond: {
              if: { $gt: [{ $size: "$agentDetails" }, 0] },
              then: {
                $concat: [
                  { $arrayElemAt: ["$agentDetails.firstName", 0] },
                  " ",
                  { $arrayElemAt: ["$agentDetails.lastName", 0] },
                ],
              },
              else: "$agentName",
            },
          },
          target: { $arrayElemAt: ["$agentDetails.target", 0] },
        },
      },
      {
        $sort: { successfulLeads: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    // Structure response for KPI cards
    const dashboardStats = {
      kpiCards: [
        {
          title: "Total Leads",
          value: totalLeads,
          subtitle: "All time leads",
          icon: "users",
          color: "blue",
          trend: {
            percentage: 12.5, // You can calculate this based on previous period
            isPositive: true,
          },
        },
        {
          title: "Sales Agents",
          value: totalSalesAgents,
          subtitle: "Active agents",
          icon: "user-check",
          color: "green",
          trend: {
            percentage: 5.2,
            isPositive: true,
          },
        },
        {
          title: "Assigned Leads",
          value: totalLeads - unassignedLeads,
          subtitle: `${unassignedLeads} unassigned`,
          icon: "assignment",
          color: "purple",
          trend: {
            percentage: 8.1,
            isPositive: true,
          },
        },
        {
          title: "Conversion Rate",
          value: `${conversionRate}%`,
          subtitle: "Success rate",
          icon: "trending-up",
          color: "orange",
          trend: {
            percentage: 3.2,
            isPositive: true,
          },
        },
      ],
      agentPerformance: {
        leadsPerAgent,
        topPerformers,
      },
      weeklyGraph: {
        title: "Leads This Week",
        data: weeklyGraphData,
        totalThisWeek: weeklyGraphData.reduce((sum, day) => sum + day.leads, 0),
      },
      leadsByStatus: leadsByStatus.reduce((acc, status) => {
        acc[status._id] = status.count;
        return acc;
      }, {}),
      recentActivity: recentActivity.map((lead) => ({
        id: lead._id,
        name: lead.name,
        type: lead.lead_type,
        status: lead.lead_status,
        agent: lead.assigned_agent_name || "Unassigned",
        createdAt: lead.createdAt,
        timeAgo: getTimeAgo(lead.createdAt),
      })),
    };

    res.status(200).json({
      success: true,
      data: dashboardStats,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard statistics",
      details: error.message,
    });
  }
};

// Helper function to calculate time ago
const getTimeAgo = (date) => {
  const now = new Date();
  const diffInMs = now - new Date(date);
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInDays > 0) {
    return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
  } else if (diffInHours > 0) {
    return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
  } else {
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`;
  }
};

module.exports = {
  getAdminDashboardStats,
};
