// const Leads = require("../models/Leads.model");
// const User = require("../models/user.model");
// const Quotation = require("../models/Quotation.model"); // Add quotation model

// const getAdminDashboardStats = async (req, res) => {
//   try {
//     // Get current date and week start date
//     const now = new Date();
//     const startOfWeek = new Date();
//     startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
//     startOfWeek.setHours(0, 0, 0, 0);

//     const endOfWeek = new Date(startOfWeek);
//     endOfWeek.setDate(startOfWeek.getDate() + 6); // End of current week (Saturday)
//     endOfWeek.setHours(23, 59, 59, 999);

//     // 1. Get total leads count
//     const totalLeads = await Leads.countDocuments();

//     // 2. Get total quotations count
//     const totalQuotations = await Quotation.countDocuments({ IsActive: true });

//     // 3. Get total sales agents count
//     const totalSalesAgents = await User.countDocuments({
//       role: { $in: ["sales_agent", "data_tech_sales_agent"] },
//       deactivated: false,
//     });

//     // 4. Get leads assigned to each agent
//     const leadsPerAgent = await Leads.aggregate([
//       {
//         $match: {
//           assigned_agent_id: { $ne: null },
//         },
//       },
//       {
//         $group: {
//           _id: "$assigned_agent_id",
//           leadCount: { $sum: 1 },
//           agentName: { $first: "$assigned_agent_name" },
//         },
//       },
//       {
//         $lookup: {
//           from: "users",
//           localField: "_id",
//           foreignField: "_id",
//           as: "agentDetails",
//         },
//       },
//       {
//         $project: {
//           agentId: "$_id",
//           leadCount: 1,
//           agentName: {
//             $cond: {
//               if: { $gt: [{ $size: "$agentDetails" }, 0] },
//               then: {
//                 $concat: [
//                   { $arrayElemAt: ["$agentDetails.firstName", 0] },
//                   " ",
//                   { $arrayElemAt: ["$agentDetails.lastName", 0] },
//                 ],
//               },
//               else: "$agentName",
//             },
//           },
//         },
//       },
//       {
//         $sort: { leadCount: -1 },
//       },
//     ]);

//     // 5. Get quotations assigned to each agent
//     const quotationsPerAgent = await Quotation.aggregate([
//       {
//         $match: {
//           salesAgent: { $ne: null },
//           IsActive: true,
//         },
//       },
//       {
//         $group: {
//           _id: "$salesAgent",
//           quotationCount: { $sum: 1 },
//           totalValue: { $sum: "$DocTotal" },
//         },
//       },
//       {
//         $lookup: {
//           from: "users",
//           localField: "_id",
//           foreignField: "_id",
//           as: "agentDetails",
//         },
//       },
//       {
//         $project: {
//           agentId: "$_id",
//           quotationCount: 1,
//           totalValue: 1,
//           agentName: {
//             $cond: {
//               if: { $gt: [{ $size: "$agentDetails" }, 0] },
//               then: {
//                 $concat: [
//                   { $arrayElemAt: ["$agentDetails.firstName", 0] },
//                   " ",
//                   { $arrayElemAt: ["$agentDetails.lastName", 0] },
//                 ],
//               },
//               else: "Unknown Agent",
//             },
//           },
//         },
//       },
//       {
//         $sort: { quotationCount: -1 },
//       },
//     ]);

//     // 6. Get unassigned leads count
//     const unassignedLeads = await Leads.countDocuments({
//       $or: [
//         { assigned_agent_id: null },
//         { assigned_agent_id: { $exists: false } },
//       ],
//     });

//     // 7. Get unassigned quotations count
//     const unassignedQuotations = await Quotation.countDocuments({
//       $or: [{ salesAgent: null }, { salesAgent: { $exists: false } }],
//       IsActive: true,
//     });

//     // 8. Get leads by status
//     const leadsByStatus = await Leads.aggregate([
//       {
//         $group: {
//           _id: "$lead_status",
//           count: { $sum: 1 },
//         },
//       },
//     ]);

//     // 9. Get quotations by approval status
//     const quotationsByStatus = await Quotation.aggregate([
//       {
//         $match: { IsActive: true },
//       },
//       {
//         $group: {
//           _id: "$approvalStatus",
//           count: { $sum: 1 },
//           totalValue: { $sum: "$DocTotal" },
//         },
//       },
//     ]);

//     // 10. Get leads received this week for graph (daily breakdown)
//     const leadsThisWeek = await Leads.aggregate([
//       {
//         $match: {
//           createdAt: {
//             $gte: startOfWeek,
//             $lte: endOfWeek,
//           },
//         },
//       },
//       {
//         $group: {
//           _id: {
//             $dayOfWeek: "$createdAt",
//           },
//           count: { $sum: 1 },
//           date: {
//             $first: {
//               $dateToString: {
//                 format: "%Y-%m-%d",
//                 date: "$createdAt",
//               },
//             },
//           },
//         },
//       },
//       {
//         $sort: { _id: 1 },
//       },
//     ]);

//     // 11. Get quotations created this week for graph (daily breakdown)
//     const quotationsThisWeek = await Quotation.aggregate([
//       {
//         $match: {
//           createdAt: {
//             $gte: startOfWeek,
//             $lte: endOfWeek,
//           },
//           IsActive: true,
//         },
//       },
//       {
//         $group: {
//           _id: {
//             $dayOfWeek: "$createdAt",
//           },
//           count: { $sum: 1 },
//           totalValue: { $sum: "$DocTotal" },
//           date: {
//             $first: {
//               $dateToString: {
//                 format: "%Y-%m-%d",
//                 date: "$createdAt",
//               },
//             },
//           },
//         },
//       },
//       {
//         $sort: { _id: 1 },
//       },
//     ]);

//     // Transform weekly data for frontend consumption
//     const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
//     const weeklyGraphData = [];

//     for (let i = 0; i < 7; i++) {
//       const leadData = leadsThisWeek.find((day) => day._id === i + 1);
//       const quotationData = quotationsThisWeek.find((day) => day._id === i + 1);
//       const currentDate = new Date(startOfWeek);
//       currentDate.setDate(startOfWeek.getDate() + i);

//       weeklyGraphData.push({
//         day: daysOfWeek[i],
//         date: currentDate.toISOString().split("T")[0],
//         leads: leadData ? leadData.count : 0,
//         quotations: quotationData ? quotationData.count : 0,
//         quotationValue: quotationData ? quotationData.totalValue : 0,
//       });
//     }

//     // 12. Get recent activity (last 10 leads and quotations combined)
//     const recentLeads = await Leads.find()
//       .populate("assigned_agent_id", "firstName lastName")
//       .sort({ createdAt: -1 })
//       .limit(5)
//       .select("name lead_type lead_status createdAt assigned_agent_name")
//       .lean();

//     const recentQuotations = await Quotation.find({ IsActive: true })
//       .populate("salesAgent", "firstName lastName")
//       .sort({ createdAt: -1 })
//       .limit(5)
//       .select("CardName DocTotal approvalStatus createdAt salesAgent DocNum")
//       .lean();

//     // Combine and sort recent activities
//     const recentActivity = [
//       ...recentLeads.map((lead) => ({
//         id: lead._id,
//         type: "lead",
//         name: lead.name,
//         subType: lead.lead_type,
//         status: lead.lead_status,
//         agent: lead.assigned_agent_name || "Unassigned",
//         createdAt: lead.createdAt,
//         timeAgo: getTimeAgo(lead.createdAt),
//         value: null,
//       })),
//       ...recentQuotations.map((quotation) => ({
//         id: quotation._id,
//         type: "quotation",
//         name: quotation.CardName,
//         subType: `Quotation #${quotation.DocNum}`,
//         status: quotation.approvalStatus,
//         agent: quotation.salesAgent
//           ? `${quotation.salesAgent.firstName} ${quotation.salesAgent.lastName}`
//           : "Unassigned",
//         createdAt: quotation.createdAt,
//         timeAgo: getTimeAgo(quotation.createdAt),
//         value: quotation.DocTotal,
//       })),
//     ]
//       .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
//       .slice(0, 10);

//     // 13. Calculate conversion rates
//     const approvedLeads = await Leads.countDocuments({
//       $or: [{ lead_status: "approved" }, { lead_remarks: "Successful" }],
//     });

//     const approvedQuotations = await Quotation.countDocuments({
//       approvalStatus: "approved",
//       IsActive: true,
//     });

//     const totalItems = totalLeads + totalQuotations;
//     const totalApproved = approvedLeads + approvedQuotations;
//     const overallConversionRate =
//       totalItems > 0 ? ((totalApproved / totalItems) * 100).toFixed(1) : 0;

//     const leadsConversionRate =
//       totalLeads > 0 ? ((approvedLeads / totalLeads) * 100).toFixed(1) : 0;
//     const quotationsConversionRate =
//       totalQuotations > 0
//         ? ((approvedQuotations / totalQuotations) * 100).toFixed(1)
//         : 0;

//     // 14. Get top performing agents (by approved leads and quotations)
//     const topPerformersLeads = await Leads.aggregate([
//       {
//         $match: {
//           assigned_agent_id: { $ne: null },
//           $or: [{ lead_status: "approved" }, { lead_remarks: "Successful" }],
//         },
//       },
//       {
//         $group: {
//           _id: "$assigned_agent_id",
//           approvedLeads: { $sum: 1 },
//           agentName: { $first: "$assigned_agent_name" },
//         },
//       },
//       {
//         $lookup: {
//           from: "users",
//           localField: "_id",
//           foreignField: "_id",
//           as: "agentDetails",
//         },
//       },
//       {
//         $project: {
//           agentId: "$_id",
//           approvedLeads: 1,
//           agentName: {
//             $cond: {
//               if: { $gt: [{ $size: "$agentDetails" }, 0] },
//               then: {
//                 $concat: [
//                   { $arrayElemAt: ["$agentDetails.firstName", 0] },
//                   " ",
//                   { $arrayElemAt: ["$agentDetails.lastName", 0] },
//                 ],
//               },
//               else: "$agentName",
//             },
//           },
//           target: { $arrayElemAt: ["$agentDetails.target", 0] },
//         },
//       },
//     ]);

//     const topPerformersQuotations = await Quotation.aggregate([
//       {
//         $match: {
//           salesAgent: { $ne: null },
//           approvalStatus: "approved",
//           IsActive: true,
//         },
//       },
//       {
//         $group: {
//           _id: "$salesAgent",
//           approvedQuotations: { $sum: 1 },
//           totalApprovedValue: { $sum: "$DocTotal" },
//         },
//       },
//       {
//         $lookup: {
//           from: "users",
//           localField: "_id",
//           foreignField: "_id",
//           as: "agentDetails",
//         },
//       },
//       {
//         $project: {
//           agentId: "$_id",
//           approvedQuotations: 1,
//           totalApprovedValue: 1,
//           agentName: {
//             $cond: {
//               if: { $gt: [{ $size: "$agentDetails" }, 0] },
//               then: {
//                 $concat: [
//                   { $arrayElemAt: ["$agentDetails.firstName", 0] },
//                   " ",
//                   { $arrayElemAt: ["$agentDetails.lastName", 0] },
//                 ],
//               },
//               else: "Unknown Agent",
//             },
//           },
//           target: { $arrayElemAt: ["$agentDetails.target", 0] },
//         },
//       },
//     ]);

//     // Combine top performers data
//     const agentPerformanceMap = new Map();

//     // Add leads data
//     topPerformersLeads.forEach((agent) => {
//       agentPerformanceMap.set(agent.agentId.toString(), {
//         agentId: agent.agentId,
//         agentName: agent.agentName,
//         approvedLeads: agent.approvedLeads,
//         approvedQuotations: 0,
//         totalApprovedValue: 0,
//         target: agent.target,
//       });
//     });

//     // Add quotations data
//     topPerformersQuotations.forEach((agent) => {
//       const existingAgent = agentPerformanceMap.get(agent.agentId.toString());
//       if (existingAgent) {
//         existingAgent.approvedQuotations = agent.approvedQuotations;
//         existingAgent.totalApprovedValue = agent.totalApprovedValue;
//       } else {
//         agentPerformanceMap.set(agent.agentId.toString(), {
//           agentId: agent.agentId,
//           agentName: agent.agentName,
//           approvedLeads: 0,
//           approvedQuotations: agent.approvedQuotations,
//           totalApprovedValue: agent.totalApprovedValue,
//           target: agent.target,
//         });
//       }
//     });

//     const topPerformers = Array.from(agentPerformanceMap.values())
//       .map((agent) => ({
//         ...agent,
//         totalApproved: agent.approvedLeads + agent.approvedQuotations,
//       }))
//       .sort((a, b) => b.totalApproved - a.totalApproved)
//       .slice(0, 5);

//     // 15. Get total quotation value
//     const totalQuotationValue = await Quotation.aggregate([
//       {
//         $match: { IsActive: true },
//       },
//       {
//         $group: {
//           _id: null,
//           totalValue: { $sum: "$DocTotal" },
//         },
//       },
//     ]);

//     const quotationValue =
//       totalQuotationValue.length > 0 ? totalQuotationValue[0].totalValue : 0;

//     // Structure response for KPI cards
//     const dashboardStats = {
//       kpiCards: [
//         {
//           title: "Total Leads",
//           value: totalLeads,
//           subtitle: "All time leads",
//           icon: "users",
//           color: "blue",
//           trend: {
//             percentage: 12.5, // You can calculate this based on previous period
//             isPositive: true,
//           },
//         },
//         {
//           title: "Total Quotations",
//           value: totalQuotations,
//           subtitle: `€${quotationValue.toLocaleString()} total value`,
//           icon: "file-text",
//           color: "indigo",
//           trend: {
//             percentage: 8.3,
//             isPositive: true,
//           },
//         },
//         {
//           title: "Sales Agents",
//           value: totalSalesAgents,
//           subtitle: "Active agents",
//           icon: "user-check",
//           color: "green",
//           trend: {
//             percentage: 5.2,
//             isPositive: true,
//           },
//         },
//         {
//           title: "Overall Conversion Rate",
//           value: `${overallConversionRate}%`,
//           subtitle: `Leads: ${leadsConversionRate}% | Quotations: ${quotationsConversionRate}%`,
//           icon: "trending-up",
//           color: "orange",
//           trend: {
//             percentage: 3.2,
//             isPositive: true,
//           },
//         },
//       ],
//       agentPerformance: {
//         leadsPerAgent,
//         quotationsPerAgent,
//         topPerformers,
//       },
//       weeklyGraph: {
//         title: "Weekly Activity",
//         data: weeklyGraphData,
//         totalLeadsThisWeek: weeklyGraphData.reduce(
//           (sum, day) => sum + day.leads,
//           0
//         ),
//         totalQuotationsThisWeek: weeklyGraphData.reduce(
//           (sum, day) => sum + day.quotations,
//           0
//         ),
//         totalQuotationValueThisWeek: weeklyGraphData.reduce(
//           (sum, day) => sum + day.quotationValue,
//           0
//         ),
//       },
//       statusBreakdown: {
//         leads: {
//           byStatus: leadsByStatus.reduce((acc, status) => {
//             acc[status._id] = status.count;
//             return acc;
//           }, {}),
//           assigned: totalLeads - unassignedLeads,
//           unassigned: unassignedLeads,
//         },
//         quotations: {
//           byStatus: quotationsByStatus.reduce((acc, status) => {
//             acc[status._id] = {
//               count: status.count,
//               totalValue: status.totalValue,
//             };
//             return acc;
//           }, {}),
//           assigned: totalQuotations - unassignedQuotations,
//           unassigned: unassignedQuotations,
//         },
//       },
//       recentActivity: recentActivity,
//       conversionMetrics: {
//         overall: {
//           rate: overallConversionRate,
//           approved: totalApproved,
//           total: totalItems,
//         },
//         leads: {
//           rate: leadsConversionRate,
//           approved: approvedLeads,
//           total: totalLeads,
//         },
//         quotations: {
//           rate: quotationsConversionRate,
//           approved: approvedQuotations,
//           total: totalQuotations,
//         },
//       },
//     };

//     res.status(200).json({
//       success: true,
//       data: dashboardStats,
//     });
//   } catch (error) {
//     console.error("Error fetching dashboard stats:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to fetch dashboard statistics",
//       details: error.message,
//     });
//   }
// };

// // Helper function to calculate time ago
// const getTimeAgo = (date) => {
//   const now = new Date();
//   const diffInMs = now - new Date(date);
//   const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
//   const diffInDays = Math.floor(diffInHours / 24);

//   if (diffInDays > 0) {
//     return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
//   } else if (diffInHours > 0) {
//     return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
//   } else {
//     const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
//     return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`;
//   }
// };

// module.exports = {
//   getAdminDashboardStats,
// };
const Leads = require("../models/Leads.model");
const User = require("../models/user.model");
const Quotation = require("../models/Quotation.model");
const SalesOrder = require("../models/SalesOrder.model"); // Add sales order model

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

    // 2. Get total quotations count
    const totalQuotations = await Quotation.countDocuments({ IsActive: true });

    // 3. Get total sales orders count
    const totalSalesOrders = await SalesOrder.countDocuments({
      DocumentStatus: { $ne: "Cancelled" },
      Cancelled: { $ne: "Y" },
    });

    // 4. Get total sales agents count
    const totalSalesAgents = await User.countDocuments({
      role: { $in: ["sales_agent", "data_tech_sales_agent"] },
      deactivated: false,
    });

    // 5. Get leads assigned to each agent
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

    // 6. Get quotations assigned to each agent
    const quotationsPerAgent = await Quotation.aggregate([
      {
        $match: {
          salesAgent: { $ne: null },
          IsActive: true,
        },
      },
      {
        $group: {
          _id: "$salesAgent",
          quotationCount: { $sum: 1 },
          totalValue: { $sum: "$DocTotal" },
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
          quotationCount: 1,
          totalValue: 1,
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
              else: "Unknown Agent",
            },
          },
        },
      },
      {
        $sort: { quotationCount: -1 },
      },
    ]);

    // 7. Get sales orders assigned to each agent
    const salesOrdersPerAgent = await SalesOrder.aggregate([
      {
        $match: {
          salesAgent: { $ne: null },
          DocumentStatus: { $ne: "Cancelled" },
          Cancelled: { $ne: "Y" },
        },
      },
      {
        $group: {
          _id: "$salesAgent",
          salesOrderCount: { $sum: 1 },
          totalValue: { $sum: "$DocTotal" },
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
          salesOrderCount: 1,
          totalValue: 1,
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
              else: "Unknown Agent",
            },
          },
        },
      },
      {
        $sort: { salesOrderCount: -1 },
      },
    ]);

    // 8. Get unassigned leads count
    const unassignedLeads = await Leads.countDocuments({
      $or: [
        { assigned_agent_id: null },
        { assigned_agent_id: { $exists: false } },
      ],
    });

    // 9. Get unassigned quotations count
    const unassignedQuotations = await Quotation.countDocuments({
      $or: [{ salesAgent: null }, { salesAgent: { $exists: false } }],
      IsActive: true,
    });

    // 10. Get unassigned sales orders count
    const unassignedSalesOrders = await SalesOrder.countDocuments({
      $or: [{ salesAgent: null }, { salesAgent: { $exists: false } }],
      DocumentStatus: { $ne: "Cancelled" },
      Cancelled: { $ne: "Y" },
    });

    // 11. Get leads by status
    const leadsByStatus = await Leads.aggregate([
      {
        $group: {
          _id: "$lead_status",
          count: { $sum: 1 },
        },
      },
    ]);

    // 12. Get quotations by approval status
    const quotationsByStatus = await Quotation.aggregate([
      {
        $match: { IsActive: true },
      },
      {
        $group: {
          _id: "$approvalStatus",
          count: { $sum: 1 },
          totalValue: { $sum: "$DocTotal" },
        },
      },
    ]);

    // 13. Get sales orders by status
    const salesOrdersByStatus = await SalesOrder.aggregate([
      {
        $match: {
          DocumentStatus: { $ne: "Cancelled" },
          Cancelled: { $ne: "Y" },
        },
      },
      {
        $group: {
          _id: "$DocumentStatus",
          count: { $sum: 1 },
          totalValue: { $sum: "$DocTotal" },
        },
      },
    ]);

    // 14. Get leads received this week for graph (daily breakdown)
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

    // 15. Get quotations created this week for graph (daily breakdown)
    const quotationsThisWeek = await Quotation.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startOfWeek,
            $lte: endOfWeek,
          },
          IsActive: true,
        },
      },
      {
        $group: {
          _id: {
            $dayOfWeek: "$createdAt",
          },
          count: { $sum: 1 },
          totalValue: { $sum: "$DocTotal" },
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

    // 16. Get sales orders created this week for graph (daily breakdown)
    const salesOrdersThisWeek = await SalesOrder.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startOfWeek,
            $lte: endOfWeek,
          },
          DocumentStatus: { $ne: "Cancelled" },
          Cancelled: { $ne: "Y" },
        },
      },
      {
        $group: {
          _id: {
            $dayOfWeek: "$createdAt",
          },
          count: { $sum: 1 },
          totalValue: { $sum: "$DocTotal" },
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
      const leadData = leadsThisWeek.find((day) => day._id === i + 1);
      const quotationData = quotationsThisWeek.find((day) => day._id === i + 1);
      const salesOrderData = salesOrdersThisWeek.find(
        (day) => day._id === i + 1
      );
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);

      weeklyGraphData.push({
        day: daysOfWeek[i],
        date: currentDate.toISOString().split("T")[0],
        leads: leadData ? leadData.count : 0,
        quotations: quotationData ? quotationData.count : 0,
        quotationValue: quotationData ? quotationData.totalValue : 0,
        salesOrders: salesOrderData ? salesOrderData.count : 0,
        salesOrderValue: salesOrderData ? salesOrderData.totalValue : 0,
      });
    }

    // 17. Get recent activity (last 10 leads, quotations, and sales orders combined)
    const recentLeads = await Leads.find()
      .populate("assigned_agent_id", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(4)
      .select("name lead_type lead_status createdAt assigned_agent_name")
      .lean();

    const recentQuotations = await Quotation.find({ IsActive: true })
      .populate("salesAgent", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(3)
      .select("CardName DocTotal approvalStatus createdAt salesAgent DocNum")
      .lean();

    const recentSalesOrders = await SalesOrder.find({
      DocumentStatus: { $ne: "Cancelled" },
      Cancelled: { $ne: "Y" },
    })
      .populate("salesAgent", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(3)
      .select("CardName DocTotal DocumentStatus createdAt salesAgent DocNum")
      .lean();

    // Combine and sort recent activities
    const recentActivity = [
      ...recentLeads.map((lead) => ({
        id: lead._id,
        type: "lead",
        name: lead.name,
        subType: lead.lead_type,
        status: lead.lead_status,
        agent: lead.assigned_agent_name || "Unassigned",
        createdAt: lead.createdAt,
        timeAgo: getTimeAgo(lead.createdAt),
        value: null,
      })),
      ...recentQuotations.map((quotation) => ({
        id: quotation._id,
        type: "quotation",
        name: quotation.CardName,
        subType: `Quotation #${quotation.DocNum}`,
        status: quotation.approvalStatus,
        agent: quotation.salesAgent
          ? `${quotation.salesAgent.firstName} ${quotation.salesAgent.lastName}`
          : "Unassigned",
        createdAt: quotation.createdAt,
        timeAgo: getTimeAgo(quotation.createdAt),
        value: quotation.DocTotal,
      })),
      ...recentSalesOrders.map((salesOrder) => ({
        id: salesOrder._id,
        type: "salesOrder",
        name: salesOrder.CardName,
        subType: `Order #${salesOrder.DocNum}`,
        status: salesOrder.DocumentStatus,
        agent: salesOrder.salesAgent
          ? `${salesOrder.salesAgent.firstName} ${salesOrder.salesAgent.lastName}`
          : "Unassigned",
        createdAt: salesOrder.createdAt,
        timeAgo: getTimeAgo(salesOrder.createdAt),
        value: salesOrder.DocTotal,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    // 18. Calculate conversion rates
    const approvedLeads = await Leads.countDocuments({
      $or: [{ lead_status: "approved" }, { lead_remarks: "Successful" }],
    });

    const approvedQuotations = await Quotation.countDocuments({
      approvalStatus: "approved",
      IsActive: true,
    });

    const completedSalesOrders = await SalesOrder.countDocuments({
      DocumentStatus: "Delivered", // Assuming "Delivered" means completed
      Cancelled: { $ne: "Y" },
    });

    const totalItems = totalLeads + totalQuotations + totalSalesOrders;
    const totalApproved =
      approvedLeads + approvedQuotations + completedSalesOrders;
    const overallConversionRate =
      totalItems > 0 ? ((totalApproved / totalItems) * 100).toFixed(1) : 0;

    const leadsConversionRate =
      totalLeads > 0 ? ((approvedLeads / totalLeads) * 100).toFixed(1) : 0;
    const quotationsConversionRate =
      totalQuotations > 0
        ? ((approvedQuotations / totalQuotations) * 100).toFixed(1)
        : 0;
    const salesOrdersConversionRate =
      totalSalesOrders > 0
        ? ((completedSalesOrders / totalSalesOrders) * 100).toFixed(1)
        : 0;

    // 19. Get top performing agents (by approved leads, quotations, and sales orders)
    const topPerformersLeads = await Leads.aggregate([
      {
        $match: {
          assigned_agent_id: { $ne: null },
          $or: [{ lead_status: "approved" }, { lead_remarks: "Successful" }],
        },
      },
      {
        $group: {
          _id: "$assigned_agent_id",
          approvedLeads: { $sum: 1 },
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
          approvedLeads: 1,
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
    ]);

    const topPerformersQuotations = await Quotation.aggregate([
      {
        $match: {
          salesAgent: { $ne: null },
          approvalStatus: "approved",
          IsActive: true,
        },
      },
      {
        $group: {
          _id: "$salesAgent",
          approvedQuotations: { $sum: 1 },
          totalApprovedValue: { $sum: "$DocTotal" },
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
          approvedQuotations: 1,
          totalApprovedValue: 1,
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
              else: "Unknown Agent",
            },
          },
          target: { $arrayElemAt: ["$agentDetails.target", 0] },
        },
      },
    ]);

    const topPerformersSalesOrders = await SalesOrder.aggregate([
      {
        $match: {
          salesAgent: { $ne: null },
          DocumentStatus: "Delivered", // Assuming "Delivered" means completed
          Cancelled: { $ne: "Y" },
        },
      },
      {
        $group: {
          _id: "$salesAgent",
          completedSalesOrders: { $sum: 1 },
          totalCompletedValue: { $sum: "$DocTotal" },
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
          completedSalesOrders: 1,
          totalCompletedValue: 1,
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
              else: "Unknown Agent",
            },
          },
          target: { $arrayElemAt: ["$agentDetails.target", 0] },
        },
      },
    ]);

    // Combine top performers data
    const agentPerformanceMap = new Map();

    // Add leads data
    topPerformersLeads.forEach((agent) => {
      agentPerformanceMap.set(agent.agentId.toString(), {
        agentId: agent.agentId,
        agentName: agent.agentName,
        approvedLeads: agent.approvedLeads,
        approvedQuotations: 0,
        totalApprovedValue: 0,
        completedSalesOrders: 0,
        totalCompletedValue: 0,
        target: agent.target,
      });
    });

    // Add quotations data
    topPerformersQuotations.forEach((agent) => {
      const existingAgent = agentPerformanceMap.get(agent.agentId.toString());
      if (existingAgent) {
        existingAgent.approvedQuotations = agent.approvedQuotations;
        existingAgent.totalApprovedValue = agent.totalApprovedValue;
      } else {
        agentPerformanceMap.set(agent.agentId.toString(), {
          agentId: agent.agentId,
          agentName: agent.agentName,
          approvedLeads: 0,
          approvedQuotations: agent.approvedQuotations,
          totalApprovedValue: agent.totalApprovedValue,
          completedSalesOrders: 0,
          totalCompletedValue: 0,
          target: agent.target,
        });
      }
    });

    // Add sales orders data
    topPerformersSalesOrders.forEach((agent) => {
      const existingAgent = agentPerformanceMap.get(agent.agentId.toString());
      if (existingAgent) {
        existingAgent.completedSalesOrders = agent.completedSalesOrders;
        existingAgent.totalCompletedValue = agent.totalCompletedValue;
      } else {
        agentPerformanceMap.set(agent.agentId.toString(), {
          agentId: agent.agentId,
          agentName: agent.agentName,
          approvedLeads: 0,
          approvedQuotations: 0,
          totalApprovedValue: 0,
          completedSalesOrders: agent.completedSalesOrders,
          totalCompletedValue: agent.totalCompletedValue,
          target: agent.target,
        });
      }
    });

    const topPerformers = Array.from(agentPerformanceMap.values())
      .map((agent) => ({
        ...agent,
        totalApproved:
          agent.approvedLeads +
          agent.approvedQuotations +
          agent.completedSalesOrders,
        totalValue: agent.totalApprovedValue + agent.totalCompletedValue,
      }))
      .sort((a, b) => b.totalApproved - a.totalApproved)
      .slice(0, 5);

    // 20. Get total quotation value
    const totalQuotationValue = await Quotation.aggregate([
      {
        $match: { IsActive: true },
      },
      {
        $group: {
          _id: null,
          totalValue: { $sum: "$DocTotal" },
        },
      },
    ]);

    const quotationValue =
      totalQuotationValue.length > 0 ? totalQuotationValue[0].totalValue : 0;

    // 21. Get total sales order value
    const totalSalesOrderValue = await SalesOrder.aggregate([
      {
        $match: {
          DocumentStatus: { $ne: "Cancelled" },
          Cancelled: { $ne: "Y" },
        },
      },
      {
        $group: {
          _id: null,
          totalValue: { $sum: "$DocTotal" },
        },
      },
    ]);

    const salesOrderValue =
      totalSalesOrderValue.length > 0 ? totalSalesOrderValue[0].totalValue : 0;

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
          title: "Total Quotations",
          value: totalQuotations,
          subtitle: `€${quotationValue.toLocaleString()} total value`,
          icon: "file-text",
          color: "indigo",
          trend: {
            percentage: 8.3,
            isPositive: true,
          },
        },
        {
          title: "Total Sales Orders",
          value: totalSalesOrders,
          subtitle: `€${salesOrderValue.toLocaleString()} total value`,
          icon: "shopping-cart",
          color: "purple",
          trend: {
            percentage: 15.7,
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
          title: "Overall Conversion Rate",
          value: `${overallConversionRate}%`,
          subtitle: `Leads: ${leadsConversionRate}% | Quotations: ${quotationsConversionRate}% | Orders: ${salesOrdersConversionRate}%`,
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
        quotationsPerAgent,
        salesOrdersPerAgent,
        topPerformers,
      },
      weeklyGraph: {
        title: "Weekly Activity",
        data: weeklyGraphData,
        totalLeadsThisWeek: weeklyGraphData.reduce(
          (sum, day) => sum + day.leads,
          0
        ),
        totalQuotationsThisWeek: weeklyGraphData.reduce(
          (sum, day) => sum + day.quotations,
          0
        ),
        totalQuotationValueThisWeek: weeklyGraphData.reduce(
          (sum, day) => sum + day.quotationValue,
          0
        ),
        totalSalesOrdersThisWeek: weeklyGraphData.reduce(
          (sum, day) => sum + day.salesOrders,
          0
        ),
        totalSalesOrderValueThisWeek: weeklyGraphData.reduce(
          (sum, day) => sum + day.salesOrderValue,
          0
        ),
      },
      statusBreakdown: {
        leads: {
          byStatus: leadsByStatus.reduce((acc, status) => {
            acc[status._id] = status.count;
            return acc;
          }, {}),
          assigned: totalLeads - unassignedLeads,
          unassigned: unassignedLeads,
        },
        quotations: {
          byStatus: quotationsByStatus.reduce((acc, status) => {
            acc[status._id] = {
              count: status.count,
              totalValue: status.totalValue,
            };
            return acc;
          }, {}),
          assigned: totalQuotations - unassignedQuotations,
          unassigned: unassignedQuotations,
        },
        salesOrders: {
          byStatus: salesOrdersByStatus.reduce((acc, status) => {
            acc[status._id] = {
              count: status.count,
              totalValue: status.totalValue,
            };
            return acc;
          }, {}),
          assigned: totalSalesOrders - unassignedSalesOrders,
          unassigned: unassignedSalesOrders,
        },
      },
      recentActivity: recentActivity,
      conversionMetrics: {
        overall: {
          rate: overallConversionRate,
          approved: totalApproved,
          total: totalItems,
        },
        leads: {
          rate: leadsConversionRate,
          approved: approvedLeads,
          total: totalLeads,
        },
        quotations: {
          rate: quotationsConversionRate,
          approved: approvedQuotations,
          total: totalQuotations,
        },
        salesOrders: {
          rate: salesOrdersConversionRate,
          approved: completedSalesOrders,
          total: totalSalesOrders,
        },
      },
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
