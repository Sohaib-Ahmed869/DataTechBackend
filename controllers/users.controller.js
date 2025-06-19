const User = require("../models/user.model");
const bcrypt = require("bcrypt");
const Leads = require("../models/Leads.model");
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get all data tech sales agents
// const getDataTechSalesAgents = async (req, res) => {
//   try {
//     const {
//       page = 1,
//       limit = 10,
//       search,
//       deactivated,
//       sort_by = "createdAt",
//       sort_order = "desc",
//       include_deactivated = false,
//     } = req.query;

//     // Build filter object
//     const filter = { role: "data_tech_sales_agent" };

//     // Filter by deactivated status
//     if (deactivated !== undefined) {
//       filter.deactivated = deactivated === "true";
//     } else if (!include_deactivated) {
//       // By default, exclude deactivated users unless explicitly requested
//       filter.deactivated = false;
//     }

//     // Search functionality (name, email, phone)
//     if (search) {
//       filter.$or = [
//         { firstName: { $regex: search, $options: "i" } },
//         { lastName: { $regex: search, $options: "i" } },
//         { email: { $regex: search, $options: "i" } },
//         { phone: { $regex: search, $options: "i" } },
//       ];
//     }

//     // Pagination calculations
//     const pageNum = parseInt(page);
//     const limitNum = parseInt(limit);
//     const skip = (pageNum - 1) * limitNum;

//     // Sort configuration
//     const sortConfig = {};
//     sortConfig[sort_by] = sort_order === "desc" ? -1 : 1;

//     // Execute query with pagination, sorting, and population
//     const agents = await User.find(filter)
//       .populate("createdBy", "firstName lastName email")
//       .populate("manager", "firstName lastName email")
//       .sort(sortConfig)
//       .skip(skip)
//       .limit(limitNum)
//       .select("-password") // Exclude password from response
//       .lean();

//     // Get total count for pagination
//     const totalAgents = await User.countDocuments(filter);
//     const totalPages = Math.ceil(totalAgents / limitNum);

//     // Calculate statistics
//     const stats = await User.aggregate([
//       { $match: filter },
//       {
//         $group: {
//           _id: null,
//           totalAgents: { $sum: 1 },
//           activeAgents: {
//             $sum: { $cond: [{ $eq: ["$deactivated", false] }, 1, 0] },
//           },
//           deactivatedAgents: {
//             $sum: { $cond: [{ $eq: ["$deactivated", true] }, 1, 0] },
//           },
//           totalTarget: { $sum: "$target" },
//           totalTargetAchieved: { $sum: "$targetAchieved" },
//           totalCallsMade: { $sum: "$callsMade" },
//           averageTarget: { $avg: "$target" },
//           averageAchieved: { $avg: "$targetAchieved" },
//         },
//       },
//     ]);

//     // Format agents data with computed fields
//     const formattedAgents = agents.map((agent) => ({
//       ...agent,
//       fullName: `${agent.firstName} ${agent.lastName}`,
//       achievementRate:
//         agent.target > 0
//           ? ((agent.targetAchieved / agent.target) * 100).toFixed(2)
//           : 0,
//     }));

//     res.status(200).json({
//       success: true,
//       data: {
//         agents: formattedAgents,
//         pagination: {
//           currentPage: pageNum,
//           totalPages,
//           totalAgents,
//           hasNextPage: pageNum < totalPages,
//           hasPrevPage: pageNum > 1,
//           limit: limitNum,
//         },
//         statistics:
//           stats.length > 0
//             ? {
//                 ...stats[0],
//                 overallAchievementRate:
//                   stats[0].totalTarget > 0
//                     ? (
//                         (stats[0].totalTargetAchieved / stats[0].totalTarget) *
//                         100
//                       ).toFixed(2)
//                     : 0,
//               }
//             : {
//                 totalAgents: 0,
//                 activeAgents: 0,
//                 deactivatedAgents: 0,
//                 totalTarget: 0,
//                 totalTargetAchieved: 0,
//                 totalCallsMade: 0,
//                 averageTarget: 0,
//                 averageAchieved: 0,
//                 overallAchievementRate: 0,
//               },
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching data tech sales agents:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to fetch data tech sales agents",
//       details: error.message,
//     });
//   }
// };
const getDataTechSalesAgents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      deactivated,
      sort_by = "createdAt",
      sort_order = "desc",
      include_deactivated = false,
    } = req.query;

    // Build filter object
    const filter = { role: "data_tech_sales_agent" };

    // Filter by deactivated status
    if (deactivated !== undefined) {
      filter.deactivated = deactivated === "true";
    } else if (!include_deactivated) {
      // By default, exclude deactivated users unless explicitly requested
      filter.deactivated = false;
    }

    // Search functionality (name, email, phone)
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination calculations
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort configuration
    const sortConfig = {};
    sortConfig[sort_by] = sort_order === "desc" ? -1 : 1;

    // Execute query with pagination, sorting, and population
    const agents = await User.find(filter)
      .populate("createdBy", "firstName lastName email")
      .populate("manager", "firstName lastName email")
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum)
      .select("-password") // Exclude password from response
      .lean();

    // Get total count for pagination
    const totalAgents = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalAgents / limitNum);

    // Calculate leads statistics for all agents
    const leadsStats = await Leads.aggregate([
      {
        $match: {
          assigned_agent_id: { $in: agents.map((agent) => agent._id) },
        },
      },
      {
        $group: {
          _id: "$assigned_agent_id",
          totalLeadsAssigned: { $sum: 1 },
          successfulLeads: {
            $sum: {
              $cond: [{ $eq: ["$lead_remarks", "Successful"] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Create a map for quick lookup of leads stats by agent ID
    const leadsStatsMap = leadsStats.reduce((map, stat) => {
      map[stat._id.toString()] = {
        totalLeadsAssigned: stat.totalLeadsAssigned,
        successfulLeads: stat.successfulLeads,
        achievementRate:
          stat.totalLeadsAssigned > 0
            ? ((stat.successfulLeads / stat.totalLeadsAssigned) * 100).toFixed(
                2
              )
            : 0,
      };
      return map;
    }, {});

    // Calculate overall statistics
    const overallStats = await Leads.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "assigned_agent_id",
          foreignField: "_id",
          as: "agent",
        },
      },
      {
        $match: {
          "agent.role": "data_tech_sales_agent",
          ...(filter.deactivated !== undefined
            ? { "agent.deactivated": filter.deactivated }
            : !include_deactivated
            ? { "agent.deactivated": false }
            : {}),
        },
      },
      {
        $group: {
          _id: null,
          totalLeadsAssigned: { $sum: 1 },
          totalSuccessfulLeads: {
            $sum: {
              $cond: [{ $eq: ["$lead_remarks", "Successful"] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Format agents data with computed fields and leads data
    const formattedAgents = agents.map((agent) => {
      const agentLeadsStats = leadsStatsMap[agent._id.toString()] || {
        totalLeadsAssigned: 0,
        successfulLeads: 0,
        achievementRate: 0,
      };

      return {
        ...agent,
        fullName: `${agent.firstName} ${agent.lastName}`,
        leadsAssigned: agentLeadsStats.totalLeadsAssigned,
        successfulLeads: agentLeadsStats.successfulLeads,
        achievementRate: agentLeadsStats.achievementRate,
      };
    });

    // Count active and deactivated agents
    const agentStats = await User.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAgents: { $sum: 1 },
          activeAgents: {
            $sum: { $cond: [{ $eq: ["$deactivated", false] }, 1, 0] },
          },
          deactivatedAgents: {
            $sum: { $cond: [{ $eq: ["$deactivated", true] }, 1, 0] },
          },
        },
      },
    ]);

    const statistics = {
      totalAgents: agentStats.length > 0 ? agentStats[0].totalAgents : 0,
      activeAgents: agentStats.length > 0 ? agentStats[0].activeAgents : 0,
      deactivatedAgents:
        agentStats.length > 0 ? agentStats[0].deactivatedAgents : 0,
      totalLeadsAssigned:
        overallStats.length > 0 ? overallStats[0].totalLeadsAssigned : 0,
      totalSuccessfulLeads:
        overallStats.length > 0 ? overallStats[0].totalSuccessfulLeads : 0,
      overallAchievementRate:
        overallStats.length > 0 && overallStats[0].totalLeadsAssigned > 0
          ? (
              (overallStats[0].totalSuccessfulLeads /
                overallStats[0].totalLeadsAssigned) *
              100
            ).toFixed(2)
          : 0,
    };

    res.status(200).json({
      success: true,
      data: {
        agents: formattedAgents,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalAgents,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum,
        },
        statistics,
      },
    });
  } catch (error) {
    console.error("Error fetching data tech sales agents:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch data tech sales agents",
      details: error.message,
    });
  }
};
const getDataTechSalesAgentsForLeads = async (req, res) => {
  try {
    // Get only active data tech sales agents with essential fields
    const agents = await User.find({
      role: "data_tech_sales_agent",
      deactivated: false, // Only active agents
    })
      .select("firstName lastName email") // Only select needed fields
      .lean(); // Return plain JavaScript objects for better performance

    // Format the response to match your required structure
    const formattedAgents = agents.map((agent) => ({
      _id: agent._id,
      firstName: agent.firstName,
      lastName: agent.lastName,
      role: "datatech_sales_agent",
      email: agent.email,
    }));

    res.status(200).json({
      success: true,
      data: formattedAgents,
    });
  } catch (error) {
    console.error("Error fetching data tech sales agents:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch data tech sales agents",
    });
  }
};
// Get single data tech sales agent by ID
const getDataTechSalesAgentById = async (req, res) => {
  try {
    const { id } = req.params;

    const agent = await User.findById(id)
      .populate("createdBy", "firstName lastName email")
      .populate("manager", "firstName lastName email")
      .populate("salesHistory.orders")
      .select("-password")
      .lean();

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: "Data tech sales agent not found",
      });
    }

    if (agent.role !== "data_tech_sales_agent") {
      return res.status(400).json({
        success: false,
        error: "User is not a data tech sales agent",
      });
    }

    // Add computed fields
    const formattedAgent = {
      ...agent,
      fullName: `${agent.firstName} ${agent.lastName}`,
      achievementRate:
        agent.target > 0
          ? ((agent.targetAchieved / agent.target) * 100).toFixed(2)
          : 0,
    };

    res.status(200).json({
      success: true,
      data: formattedAgent,
    });
  } catch (error) {
    console.error("Error fetching data tech sales agent by ID:", error);

    // Handle invalid ObjectId
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        error: "Invalid agent ID format",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to fetch data tech sales agent",
      details: error.message,
    });
  }
};

// Get data tech sales agents performance summary
const getDataTechSalesAgentsPerformance = async (req, res) => {
  try {
    const { month, year } = req.query;

    const filter = {
      role: "data_tech_sales_agent",
      deactivated: false,
    };

    // Get performance data with optional month/year filtering
    const performanceData = await User.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "salesorders",
          localField: "_id",
          foreignField: "assignedAgent",
          as: "orders",
        },
      },
      {
        $addFields: {
          fullName: { $concat: ["$firstName", " ", "$lastName"] },
          achievementRate: {
            $cond: [
              { $gt: ["$target", 0] },
              { $multiply: [{ $divide: ["$targetAchieved", "$target"] }, 100] },
              0,
            ],
          },
        },
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          fullName: 1,
          email: 1,
          target: 1,
          targetAchieved: 1,
          achievementRate: 1,
          callsMade: 1,
          lastLogin: 1,
          salesHistory: 1,
          targetHistory: 1,
          orderCount: { $size: "$orders" },
        },
      },
      { $sort: { achievementRate: -1 } },
    ]);

    // Calculate team statistics
    const teamStats = {
      totalAgents: performanceData.length,
      totalTarget: performanceData.reduce(
        (sum, agent) => sum + agent.target,
        0
      ),
      totalAchieved: performanceData.reduce(
        (sum, agent) => sum + agent.targetAchieved,
        0
      ),
      totalCalls: performanceData.reduce(
        (sum, agent) => sum + agent.callsMade,
        0
      ),
      totalOrders: performanceData.reduce(
        (sum, agent) => sum + agent.orderCount,
        0
      ),
      topPerformer: performanceData.length > 0 ? performanceData[0] : null,
    };

    teamStats.overallAchievementRate =
      teamStats.totalTarget > 0
        ? ((teamStats.totalAchieved / teamStats.totalTarget) * 100).toFixed(2)
        : 0;

    res.status(200).json({
      success: true,
      data: {
        agents: performanceData,
        teamStatistics: teamStats,
      },
    });
  } catch (error) {
    console.error("Error fetching data tech sales agents performance:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch performance data",
      details: error.message,
    });
  }
};

module.exports = {
  getDataTechSalesAgents,
  getDataTechSalesAgentById,
  getDataTechSalesAgentsPerformance,
  getDataTechSalesAgentsForLeads,
  getUserById,
};
