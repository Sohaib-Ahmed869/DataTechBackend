// const User = require("../models/user.model");
// const bcrypt = require("bcrypt");
// const Leads = require("../models/Leads.model");
// const Quotation = require("../models/Quotation.model");
// const Customer = require("../models/Customer.model");
// const SalesOrder = require("../models/SalesOrder.model");

// const getUserById = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const user = await User.findById(id);

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       data: user,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };

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
//     const pageNum = Number.parseInt(page);
//     const limitNum = Number.parseInt(limit);
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

//     // Calculate leads statistics for all agents (based on approval status)
//     const leadsStats = await Leads.aggregate([
//       {
//         $match: {
//           assigned_agent_id: { $in: agents.map((agent) => agent._id) },
//         },
//       },
//       {
//         $group: {
//           _id: "$assigned_agent_id",
//           totalLeadsAssigned: { $sum: 1 },
//           approvedLeads: {
//             $sum: {
//               $cond: [{ $eq: ["$lead_status", "approved"] }, 1, 0],
//             },
//           },
//           pendingLeads: {
//             $sum: {
//               $cond: [{ $eq: ["$lead_status", "pending"] }, 1, 0],
//             },
//           },
//           awaitingApprovalLeads: {
//             $sum: {
//               $cond: [{ $eq: ["$lead_status", "awaiting_approval"] }, 1, 0],
//             },
//           },
//           rejectedLeads: {
//             $sum: {
//               $cond: [{ $eq: ["$lead_status", "rejected"] }, 1, 0],
//             },
//           },
//         },
//       },
//     ]);

//     // Calculate quotations statistics for all agents (based on approval status)
//     const quotationsStats = await Quotation.aggregate([
//       {
//         $match: {
//           salesAgent: { $in: agents.map((agent) => agent._id) },
//         },
//       },
//       {
//         $group: {
//           _id: "$salesAgent",
//           totalQuotationsAssigned: { $sum: 1 },
//           approvedQuotations: {
//             $sum: {
//               $cond: [{ $eq: ["$approvalStatus", "approved"] }, 1, 0],
//             },
//           },
//           pendingQuotations: {
//             $sum: {
//               $cond: [{ $eq: ["$approvalStatus", "pending"] }, 1, 0],
//             },
//           },
//           awaitingApprovalQuotations: {
//             $sum: {
//               $cond: [{ $eq: ["$approvalStatus", "awaiting_approval"] }, 1, 0],
//             },
//           },
//           rejectedQuotations: {
//             $sum: {
//               $cond: [{ $eq: ["$approvalStatus", "rejected"] }, 1, 0],
//             },
//           },
//           totalQuotationValue: { $sum: "$DocTotal" },
//           approvedQuotationValue: {
//             $sum: {
//               $cond: [{ $eq: ["$approvalStatus", "approved"] }, "$DocTotal", 0],
//             },
//           },
//         },
//       },
//     ]);

//     // Create maps for quick lookup
//     const leadsStatsMap = leadsStats.reduce((map, stat) => {
//       const totalItems = stat.totalLeadsAssigned;
//       const approvedItems = stat.approvedLeads;
//       map[stat._id.toString()] = {
//         totalLeadsAssigned: totalItems,
//         approvedLeads: approvedItems,
//         pendingLeads: stat.pendingLeads,
//         awaitingApprovalLeads: stat.awaitingApprovalLeads,
//         rejectedLeads: stat.rejectedLeads,
//         leadsAchievementRate:
//           totalItems > 0 ? ((approvedItems / totalItems) * 100).toFixed(2) : 0,
//       };
//       return map;
//     }, {});

//     const quotationsStatsMap = quotationsStats.reduce((map, stat) => {
//       const totalItems = stat.totalQuotationsAssigned;
//       const approvedItems = stat.approvedQuotations;
//       map[stat._id.toString()] = {
//         totalQuotationsAssigned: totalItems,
//         approvedQuotations: approvedItems,
//         pendingQuotations: stat.pendingQuotations,
//         awaitingApprovalQuotations: stat.awaitingApprovalQuotations,
//         rejectedQuotations: stat.rejectedQuotations,
//         quotationsAchievementRate:
//           totalItems > 0 ? ((approvedItems / totalItems) * 100).toFixed(2) : 0,
//         totalQuotationValue: stat.totalQuotationValue || 0,
//         approvedQuotationValue: stat.approvedQuotationValue || 0,
//       };
//       return map;
//     }, {});

//     // Calculate overall statistics for leads
//     const overallLeadsStats = await Leads.aggregate([
//       {
//         $lookup: {
//           from: "users",
//           localField: "assigned_agent_id",
//           foreignField: "_id",
//           as: "agent",
//         },
//       },
//       {
//         $match: {
//           "agent.role": "data_tech_sales_agent",
//           ...(filter.deactivated !== undefined
//             ? { "agent.deactivated": filter.deactivated }
//             : !include_deactivated
//             ? { "agent.deactivated": false }
//             : {}),
//         },
//       },
//       {
//         $group: {
//           _id: null,
//           totalLeadsAssigned: { $sum: 1 },
//           totalApprovedLeads: {
//             $sum: {
//               $cond: [{ $eq: ["$lead_status", "approved"] }, 1, 0],
//             },
//           },
//         },
//       },
//     ]);

//     // Calculate overall statistics for quotations
//     const overallQuotationsStats = await Quotation.aggregate([
//       {
//         $lookup: {
//           from: "users",
//           localField: "salesAgent",
//           foreignField: "_id",
//           as: "agent",
//         },
//       },
//       {
//         $match: {
//           "agent.role": "data_tech_sales_agent",
//           ...(filter.deactivated !== undefined
//             ? { "agent.deactivated": filter.deactivated }
//             : !include_deactivated
//             ? { "agent.deactivated": false }
//             : {}),
//         },
//       },
//       {
//         $group: {
//           _id: null,
//           totalQuotationsAssigned: { $sum: 1 },
//           totalApprovedQuotations: {
//             $sum: {
//               $cond: [{ $eq: ["$approvalStatus", "approved"] }, 1, 0],
//             },
//           },
//           totalQuotationValue: { $sum: "$DocTotal" },
//           totalApprovedQuotationValue: {
//             $sum: {
//               $cond: [{ $eq: ["$approvalStatus", "approved"] }, "$DocTotal", 0],
//             },
//           },
//         },
//       },
//     ]);

//     // Format agents data with computed fields and statistics
//     const formattedAgents = agents.map((agent) => {
//       const agentLeadsStats = leadsStatsMap[agent._id.toString()] || {
//         totalLeadsAssigned: 0,
//         approvedLeads: 0,
//         pendingLeads: 0,
//         awaitingApprovalLeads: 0,
//         rejectedLeads: 0,
//         leadsAchievementRate: 0,
//       };

//       const agentQuotationsStats = quotationsStatsMap[agent._id.toString()] || {
//         totalQuotationsAssigned: 0,
//         approvedQuotations: 0,
//         pendingQuotations: 0,
//         awaitingApprovalQuotations: 0,
//         rejectedQuotations: 0,
//         quotationsAchievementRate: 0,
//         totalQuotationValue: 0,
//         approvedQuotationValue: 0,
//       };

//       // Calculate overall achievement rate (combining leads and quotations)
//       const totalAssigned =
//         agentLeadsStats.totalLeadsAssigned +
//         agentQuotationsStats.totalQuotationsAssigned;
//       const totalApproved =
//         agentLeadsStats.approvedLeads + agentQuotationsStats.approvedQuotations;

//       const overallAchievementRate =
//         totalAssigned > 0
//           ? ((totalApproved / totalAssigned) * 100).toFixed(2)
//           : 0;

//       return {
//         ...agent,
//         fullName: `${agent.firstName} ${agent.lastName}`,
//         // Leads statistics
//         leadsAssigned: agentLeadsStats.totalLeadsAssigned,
//         approvedLeads: agentLeadsStats.approvedLeads,
//         pendingLeads: agentLeadsStats.pendingLeads,
//         awaitingApprovalLeads: agentLeadsStats.awaitingApprovalLeads,
//         rejectedLeads: agentLeadsStats.rejectedLeads,
//         leadsAchievementRate: agentLeadsStats.leadsAchievementRate,
//         // Quotations statistics
//         quotationsAssigned: agentQuotationsStats.totalQuotationsAssigned,
//         approvedQuotations: agentQuotationsStats.approvedQuotations,
//         pendingQuotations: agentQuotationsStats.pendingQuotations,
//         awaitingApprovalQuotations:
//           agentQuotationsStats.awaitingApprovalQuotations,
//         rejectedQuotations: agentQuotationsStats.rejectedQuotations,
//         quotationsAchievementRate:
//           agentQuotationsStats.quotationsAchievementRate,
//         totalQuotationValue: agentQuotationsStats.totalQuotationValue,
//         approvedQuotationValue: agentQuotationsStats.approvedQuotationValue,
//         // Overall statistics
//         totalAssigned: totalAssigned,
//         totalApproved: totalApproved,
//         overallAchievementRate: overallAchievementRate,
//       };
//     });

//     // Count active and deactivated agents
//     const agentStats = await User.aggregate([
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
//         },
//       },
//     ]);

//     const statistics = {
//       // Agent statistics
//       totalAgents: agentStats.length > 0 ? agentStats[0].totalAgents : 0,
//       activeAgents: agentStats.length > 0 ? agentStats[0].activeAgents : 0,
//       deactivatedAgents:
//         agentStats.length > 0 ? agentStats[0].deactivatedAgents : 0,
//       // Leads statistics
//       totalLeadsAssigned:
//         overallLeadsStats.length > 0
//           ? overallLeadsStats[0].totalLeadsAssigned
//           : 0,
//       totalApprovedLeads:
//         overallLeadsStats.length > 0
//           ? overallLeadsStats[0].totalApprovedLeads
//           : 0,
//       overallLeadsAchievementRate:
//         overallLeadsStats.length > 0 &&
//         overallLeadsStats[0].totalLeadsAssigned > 0
//           ? (
//               (overallLeadsStats[0].totalApprovedLeads /
//                 overallLeadsStats[0].totalLeadsAssigned) *
//               100
//             ).toFixed(2)
//           : 0,
//       // Quotations statistics
//       totalQuotationsAssigned:
//         overallQuotationsStats.length > 0
//           ? overallQuotationsStats[0].totalQuotationsAssigned
//           : 0,
//       totalApprovedQuotations:
//         overallQuotationsStats.length > 0
//           ? overallQuotationsStats[0].totalApprovedQuotations
//           : 0,
//       totalQuotationValue:
//         overallQuotationsStats.length > 0
//           ? overallQuotationsStats[0].totalQuotationValue
//           : 0,
//       totalApprovedQuotationValue:
//         overallQuotationsStats.length > 0
//           ? overallQuotationsStats[0].totalApprovedQuotationValue
//           : 0,
//       overallQuotationsAchievementRate:
//         overallQuotationsStats.length > 0 &&
//         overallQuotationsStats[0].totalQuotationsAssigned > 0
//           ? (
//               (overallQuotationsStats[0].totalApprovedQuotations /
//                 overallQuotationsStats[0].totalQuotationsAssigned) *
//               100
//             ).toFixed(2)
//           : 0,
//       // Combined statistics
//       overallAchievementRate: (() => {
//         const totalLeads =
//           overallLeadsStats.length > 0
//             ? overallLeadsStats[0].totalLeadsAssigned
//             : 0;
//         const totalQuotations =
//           overallQuotationsStats.length > 0
//             ? overallQuotationsStats[0].totalQuotationsAssigned
//             : 0;
//         const approvedLeads =
//           overallLeadsStats.length > 0
//             ? overallLeadsStats[0].totalApprovedLeads
//             : 0;
//         const approvedQuotations =
//           overallQuotationsStats.length > 0
//             ? overallQuotationsStats[0].totalApprovedQuotations
//             : 0;

//         const totalAssigned = totalLeads + totalQuotations;
//         const totalApproved = approvedLeads + approvedQuotations;

//         return totalAssigned > 0
//           ? ((totalApproved / totalAssigned) * 100).toFixed(2)
//           : 0;
//       })(),
//     };

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
//         statistics,
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

// const getDataTechSalesAgentsForLeads = async (req, res) => {
//   try {
//     // Get only active data tech sales agents with essential fields
//     const agents = await User.find({
//       role: "data_tech_sales_agent",
//       deactivated: false, // Only active agents
//     })
//       .select("firstName lastName email") // Only select needed fields
//       .lean(); // Return plain JavaScript objects for better performance

//     // Format the response to match your required structure
//     const formattedAgents = agents.map((agent) => ({
//       _id: agent._id,
//       firstName: agent.firstName,
//       lastName: agent.lastName,
//       role: "datatech_sales_agent",
//       email: agent.email,
//     }));

//     res.status(200).json({
//       success: true,
//       data: formattedAgents,
//     });
//   } catch (error) {
//     console.error("Error fetching data tech sales agents:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to fetch data tech sales agents",
//     });
//   }
// };

// // Get single data tech sales agent by ID
// const getDataTechSalesAgentById = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const agent = await User.findById(id)
//       .populate("createdBy", "firstName lastName email")
//       .populate("manager", "firstName lastName email")
//       .select("-password")
//       .lean();

//     if (!agent) {
//       return res.status(404).json({
//         success: false,
//         error: "Data tech sales agent not found",
//       });
//     }

//     if (agent.role !== "data_tech_sales_agent") {
//       return res.status(400).json({
//         success: false,
//         error: "User is not a data tech sales agent",
//       });
//     }

//     // Calculate leads statistics
//     const leadsStats = await Leads.aggregate([
//       {
//         $match: {
//           assigned_agent_id: agent._id,
//         },
//       },
//       {
//         $group: {
//           _id: null,
//           totalLeadsAssigned: { $sum: 1 },
//           approvedLeads: {
//             $sum: {
//               $cond: [{ $eq: ["$lead_status", "approved"] }, 1, 0],
//             },
//           },
//           pendingLeads: {
//             $sum: {
//               $cond: [{ $eq: ["$lead_status", "pending"] }, 1, 0],
//             },
//           },
//           awaitingApprovalLeads: {
//             $sum: {
//               $cond: [{ $eq: ["$lead_status", "awaiting_approval"] }, 1, 0],
//             },
//           },
//           rejectedLeads: {
//             $sum: {
//               $cond: [{ $eq: ["$lead_status", "rejected"] }, 1, 0],
//             },
//           },
//         },
//       },
//     ]);

//     // Calculate quotations statistics
//     const quotationsStats = await Quotation.aggregate([
//       {
//         $match: {
//           salesAgent: agent._id,
//         },
//       },
//       {
//         $group: {
//           _id: null,
//           totalQuotationsAssigned: { $sum: 1 },
//           approvedQuotations: {
//             $sum: {
//               $cond: [{ $eq: ["$approvalStatus", "approved"] }, 1, 0],
//             },
//           },
//           pendingQuotations: {
//             $sum: {
//               $cond: [{ $eq: ["$approvalStatus", "pending"] }, 1, 0],
//             },
//           },
//           awaitingApprovalQuotations: {
//             $sum: {
//               $cond: [{ $eq: ["$approvalStatus", "awaiting_approval"] }, 1, 0],
//             },
//           },
//           rejectedQuotations: {
//             $sum: {
//               $cond: [{ $eq: ["$approvalStatus", "rejected"] }, 1, 0],
//             },
//           },
//           totalQuotationValue: { $sum: "$DocTotal" },
//           approvedQuotationValue: {
//             $sum: {
//               $cond: [{ $eq: ["$approvalStatus", "approved"] }, "$DocTotal", 0],
//             },
//           },
//         },
//       },
//     ]);

//     const agentLeadsStats =
//       leadsStats.length > 0
//         ? leadsStats[0]
//         : {
//             totalLeadsAssigned: 0,
//             approvedLeads: 0,
//             pendingLeads: 0,
//             awaitingApprovalLeads: 0,
//             rejectedLeads: 0,
//           };

//     const agentQuotationsStats =
//       quotationsStats.length > 0
//         ? quotationsStats[0]
//         : {
//             totalQuotationsAssigned: 0,
//             approvedQuotations: 0,
//             pendingQuotations: 0,
//             awaitingApprovalQuotations: 0,
//             rejectedQuotations: 0,
//             totalQuotationValue: 0,
//             approvedQuotationValue: 0,
//           };

//     // Calculate achievement rates
//     const leadsAchievementRate =
//       agentLeadsStats.totalLeadsAssigned > 0
//         ? (
//             (agentLeadsStats.approvedLeads /
//               agentLeadsStats.totalLeadsAssigned) *
//             100
//           ).toFixed(2)
//         : 0;

//     const quotationsAchievementRate =
//       agentQuotationsStats.totalQuotationsAssigned > 0
//         ? (
//             (agentQuotationsStats.approvedQuotations /
//               agentQuotationsStats.totalQuotationsAssigned) *
//             100
//           ).toFixed(2)
//         : 0;

//     const totalAssigned =
//       agentLeadsStats.totalLeadsAssigned +
//       agentQuotationsStats.totalQuotationsAssigned;
//     const totalApproved =
//       agentLeadsStats.approvedLeads + agentQuotationsStats.approvedQuotations;
//     const overallAchievementRate =
//       totalAssigned > 0
//         ? ((totalApproved / totalAssigned) * 100).toFixed(2)
//         : 0;

//     // Add computed fields
//     const formattedAgent = {
//       ...agent,
//       fullName: `${agent.firstName} ${agent.lastName}`,
//       // Leads statistics
//       leadsAssigned: agentLeadsStats.totalLeadsAssigned,
//       approvedLeads: agentLeadsStats.approvedLeads,
//       pendingLeads: agentLeadsStats.pendingLeads,
//       awaitingApprovalLeads: agentLeadsStats.awaitingApprovalLeads,
//       rejectedLeads: agentLeadsStats.rejectedLeads,
//       leadsAchievementRate: Number.parseFloat(leadsAchievementRate),
//       // Quotations statistics
//       quotationsAssigned: agentQuotationsStats.totalQuotationsAssigned,
//       approvedQuotations: agentQuotationsStats.approvedQuotations,
//       pendingQuotations: agentQuotationsStats.pendingQuotations,
//       awaitingApprovalQuotations:
//         agentQuotationsStats.awaitingApprovalQuotations,
//       rejectedQuotations: agentQuotationsStats.rejectedQuotations,
//       quotationsAchievementRate: Number.parseFloat(quotationsAchievementRate),
//       totalQuotationValue: agentQuotationsStats.totalQuotationValue,
//       approvedQuotationValue: agentQuotationsStats.approvedQuotationValue,
//       // Overall statistics
//       totalAssigned: totalAssigned,
//       totalApproved: totalApproved,
//       overallAchievementRate: Number.parseFloat(overallAchievementRate),
//     };

//     res.status(200).json({
//       success: true,
//       data: formattedAgent,
//     });
//   } catch (error) {
//     console.error("Error fetching data tech sales agent by ID:", error);
//     // Handle invalid ObjectId
//     if (error.name === "CastError") {
//       return res.status(400).json({
//         success: false,
//         error: "Invalid agent ID format",
//       });
//     }

//     res.status(500).json({
//       success: false,
//       error: "Failed to fetch data tech sales agent",
//       details: error.message,
//     });
//   }
// };

// // Get agent performance stats - REMOVED DATE FILTER
// const getDataTechSalesAgentPerformanceStats = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const agent = await User.findById(id);
//     if (!agent || agent.role !== "data_tech_sales_agent") {
//       return res.status(404).json({
//         success: false,
//         error: "Data tech sales agent not found",
//       });
//     }

//     // Get performance stats for ALL TIME (no date filter)
//     const [customerStats, leadStats, quotationStats, orderStats] =
//       await Promise.all([
//         // Customer stats
//         Customer.aggregate([
//           {
//             $match: {
//               assignedTo: agent._id,
//             },
//           },
//           {
//             $group: {
//               _id: null,
//               totalCustomers: { $sum: 1 },
//               activeCustomers: {
//                 $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
//               },
//             },
//           },
//         ]),

//         // Lead stats
//         Leads.aggregate([
//           {
//             $match: {
//               assigned_agent_id: agent._id,
//             },
//           },
//           {
//             $group: {
//               _id: null,
//               totalLeads: { $sum: 1 },
//               approvedLeads: {
//                 $sum: { $cond: [{ $eq: ["$lead_status", "approved"] }, 1, 0] },
//               },
//               pendingLeads: {
//                 $sum: { $cond: [{ $eq: ["$lead_status", "pending"] }, 1, 0] },
//               },
//               rejectedLeads: {
//                 $sum: { $cond: [{ $eq: ["$lead_status", "rejected"] }, 1, 0] },
//               },
//             },
//           },
//         ]),

//         // Quotation stats
//         Quotation.aggregate([
//           {
//             $match: {
//               salesAgent: agent._id,
//             },
//           },
//           {
//             $group: {
//               _id: null,
//               totalQuotations: { $sum: 1 },
//               approvedQuotations: {
//                 $sum: {
//                   $cond: [{ $eq: ["$approvalStatus", "approved"] }, 1, 0],
//                 },
//               },
//               pendingQuotations: {
//                 $sum: {
//                   $cond: [{ $eq: ["$approvalStatus", "pending"] }, 1, 0],
//                 },
//               },
//               totalValue: { $sum: "$DocTotal" },
//               approvedValue: {
//                 $sum: {
//                   $cond: [
//                     { $eq: ["$approvalStatus", "approved"] },
//                     "$DocTotal",
//                     0,
//                   ],
//                 },
//               },
//             },
//           },
//         ]),

//         // Sales Order stats
//         SalesOrder.aggregate([
//           {
//             $match: {
//               salesAgent: agent._id,
//             },
//           },
//           {
//             $group: {
//               _id: null,
//               totalOrders: { $sum: 1 },
//               openOrders: {
//                 $sum: { $cond: [{ $eq: ["$DocumentStatus", "Open"] }, 1, 0] },
//               },
//               closedOrders: {
//                 $sum: { $cond: [{ $eq: ["$DocumentStatus", "Closed"] }, 1, 0] },
//               },
//               totalOrderValue: { $sum: "$DocTotal" },
//             },
//           },
//         ]),
//       ]);

//     const performanceData = {
//       totalCustomers:
//         customerStats.length > 0 ? customerStats[0].totalCustomers : 0,
//       activeCustomers:
//         customerStats.length > 0 ? customerStats[0].activeCustomers : 0,
//       totalLeads: leadStats.length > 0 ? leadStats[0].totalLeads : 0,
//       approvedLeads: leadStats.length > 0 ? leadStats[0].approvedLeads : 0,
//       pendingLeads: leadStats.length > 0 ? leadStats[0].pendingLeads : 0,
//       rejectedLeads: leadStats.length > 0 ? leadStats[0].rejectedLeads : 0,
//       totalQuotations:
//         quotationStats.length > 0 ? quotationStats[0].totalQuotations : 0,
//       approvedQuotations:
//         quotationStats.length > 0 ? quotationStats[0].approvedQuotations : 0,
//       pendingQuotations:
//         quotationStats.length > 0 ? quotationStats[0].pendingQuotations : 0,
//       totalQuotationValue:
//         quotationStats.length > 0 ? quotationStats[0].totalValue : 0,
//       approvedQuotationValue:
//         quotationStats.length > 0 ? quotationStats[0].approvedValue : 0,
//       totalOrders: orderStats.length > 0 ? orderStats[0].totalOrders : 0,
//       openOrders: orderStats.length > 0 ? orderStats[0].openOrders : 0,
//       closedOrders: orderStats.length > 0 ? orderStats[0].closedOrders : 0,
//       totalOrderValue:
//         orderStats.length > 0 ? orderStats[0].totalOrderValue : 0,
//     };

//     res.status(200).json({
//       success: true,
//       data: performanceData,
//     });
//   } catch (error) {
//     console.error("Error fetching agent performance stats:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to fetch agent performance stats",
//       details: error.message,
//     });
//   }
// };

// // Get data tech sales agents performance summary
// const getDataTechSalesAgentsPerformance = async (req, res) => {
//   try {
//     const { month, year } = req.query;

//     const filter = {
//       role: "data_tech_sales_agent",
//       deactivated: false,
//     };

//     // Get performance data with optional month/year filtering
//     const performanceData = await User.aggregate([
//       { $match: filter },
//       {
//         $lookup: {
//           from: "salesorders",
//           localField: "_id",
//           foreignField: "assignedAgent",
//           as: "orders",
//         },
//       },
//       {
//         $addFields: {
//           fullName: { $concat: ["$firstName", " ", "$lastName"] },
//           achievementRate: {
//             $cond: [
//               { $gt: ["$target", 0] },
//               { $multiply: [{ $divide: ["$targetAchieved", "$target"] }, 100] },
//               0,
//             ],
//           },
//         },
//       },
//       {
//         $project: {
//           firstName: 1,
//           lastName: 1,
//           fullName: 1,
//           email: 1,
//           target: 1,
//           targetAchieved: 1,
//           achievementRate: 1,
//           callsMade: 1,
//           lastLogin: 1,
//           salesHistory: 1,
//           targetHistory: 1,
//           orderCount: { $size: "$orders" },
//         },
//       },
//       { $sort: { achievementRate: -1 } },
//     ]);

//     // Calculate team statistics
//     const teamStats = {
//       totalAgents: performanceData.length,
//       totalTarget: performanceData.reduce(
//         (sum, agent) => sum + agent.target,
//         0
//       ),
//       totalAchieved: performanceData.reduce(
//         (sum, agent) => sum + agent.targetAchieved,
//         0
//       ),
//       totalCalls: performanceData.reduce(
//         (sum, agent) => sum + agent.callsMade,
//         0
//       ),
//       totalOrders: performanceData.reduce(
//         (sum, agent) => sum + agent.orderCount,
//         0
//       ),
//       topPerformer: performanceData.length > 0 ? performanceData[0] : null,
//     };

//     teamStats.overallAchievementRate =
//       teamStats.totalTarget > 0
//         ? ((teamStats.totalAchieved / teamStats.totalTarget) * 100).toFixed(2)
//         : 0;

//     res.status(200).json({
//       success: true,
//       data: {
//         agents: performanceData,
//         teamStatistics: teamStats,
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching data tech sales agents performance:", error);
//     res.status(500).json({
//       success: false,
//       error: "Failed to fetch performance data",
//       details: error.message,
//     });
//   }
// };

// module.exports = {
//   getDataTechSalesAgents,
//   getDataTechSalesAgentById,
//   getDataTechSalesAgentsPerformance,
//   getDataTechSalesAgentsForLeads,
//   getDataTechSalesAgentPerformanceStats,
//   getUserById,
// };
const User = require("../models/user.model");
const bcrypt = require("bcrypt");
const Leads = require("../models/Leads.model");
const Quotation = require("../models/Quotation.model");
const Customer = require("../models/Customer.model");
const SalesOrder = require("../models/SalesOrder.model");

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

// Activate a user
const activateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is already active
    if (!user.deactivated) {
      return res.status(400).json({
        success: false,
        message: "User is already active",
      });
    }

    // Activate the user
    user.deactivated = false;
    await user.save();

    // Log the activation (you can add audit logging here)
    console.log(`User ${user.email} (${user._id}) has been activated by admin`);

    res.status(200).json({
      success: true,
      message: "User activated successfully",
      data: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        deactivated: user.deactivated,
      },
    });
  } catch (error) {
    console.error("Error activating user:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Deactivate a user
const deactivateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body; // Optional reason for deactivation

    // Find the user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is already deactivated
    if (user.deactivated) {
      return res.status(400).json({
        success: false,
        message: "User is already deactivated",
      });
    }

    // Prevent self-deactivation (optional security measure)
    if (req.user && req.user.id === id) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
    }

    // Deactivate the user
    user.deactivated = true;

    // Optionally store deactivation reason and timestamp
    if (reason) {
      user.deactivationReason = reason;
    }
    user.deactivatedAt = new Date();

    await user.save();

    // Log the deactivation (you can add audit logging here)
    console.log(
      `User ${user.email} (${
        user._id
      }) has been deactivated by admin. Reason: ${
        reason || "No reason provided"
      }`
    );

    res.status(200).json({
      success: true,
      message: "User deactivated successfully",
      data: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        deactivated: user.deactivated,
        deactivatedAt: user.deactivatedAt,
      },
    });
  } catch (error) {
    console.error("Error deactivating user:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Toggle user activation status (activate if deactivated, deactivate if active)
const toggleUserActivation = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body; // Optional reason for deactivation

    // Find the user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent self-deactivation (optional security measure)
    if (req.user && req.user.id === id && !user.deactivated) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
    }

    // Toggle the activation status
    const wasDeactivated = user.deactivated;
    user.deactivated = !user.deactivated;

    if (user.deactivated) {
      // Being deactivated
      if (reason) {
        user.deactivationReason = reason;
      }
      user.deactivatedAt = new Date();
    } else {
      // Being activated
      user.deactivationReason = undefined;
      user.deactivatedAt = undefined;
    }

    await user.save();

    // Log the action
    const action = user.deactivated ? "deactivated" : "activated";
    console.log(`User ${user.email} (${user._id}) has been ${action} by admin`);

    res.status(200).json({
      success: true,
      message: `User ${action} successfully`,
      data: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        deactivated: user.deactivated,
        deactivatedAt: user.deactivatedAt,
        action: action,
        previousStatus: wasDeactivated ? "deactivated" : "active",
      },
    });
  } catch (error) {
    console.error("Error toggling user activation:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

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
    const pageNum = Number.parseInt(page);
    const limitNum = Number.parseInt(limit);
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

    // Calculate leads statistics for all agents (based on approval status)
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
          approvedLeads: {
            $sum: {
              $cond: [{ $eq: ["$lead_status", "approved"] }, 1, 0],
            },
          },
          pendingLeads: {
            $sum: {
              $cond: [{ $eq: ["$lead_status", "pending"] }, 1, 0],
            },
          },
          awaitingApprovalLeads: {
            $sum: {
              $cond: [{ $eq: ["$lead_status", "awaiting_approval"] }, 1, 0],
            },
          },
          rejectedLeads: {
            $sum: {
              $cond: [{ $eq: ["$lead_status", "rejected"] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Calculate quotations statistics for all agents (based on approval status)
    const quotationsStats = await Quotation.aggregate([
      {
        $match: {
          salesAgent: { $in: agents.map((agent) => agent._id) },
        },
      },
      {
        $group: {
          _id: "$salesAgent",
          totalQuotationsAssigned: { $sum: 1 },
          approvedQuotations: {
            $sum: {
              $cond: [{ $eq: ["$approvalStatus", "approved"] }, 1, 0],
            },
          },
          pendingQuotations: {
            $sum: {
              $cond: [{ $eq: ["$approvalStatus", "pending"] }, 1, 0],
            },
          },
          awaitingApprovalQuotations: {
            $sum: {
              $cond: [{ $eq: ["$approvalStatus", "awaiting_approval"] }, 1, 0],
            },
          },
          rejectedQuotations: {
            $sum: {
              $cond: [{ $eq: ["$approvalStatus", "rejected"] }, 1, 0],
            },
          },
          totalQuotationValue: { $sum: "$DocTotal" },
          approvedQuotationValue: {
            $sum: {
              $cond: [{ $eq: ["$approvalStatus", "approved"] }, "$DocTotal", 0],
            },
          },
        },
      },
    ]);

    // Create maps for quick lookup
    const leadsStatsMap = leadsStats.reduce((map, stat) => {
      const totalItems = stat.totalLeadsAssigned;
      const approvedItems = stat.approvedLeads;
      map[stat._id.toString()] = {
        totalLeadsAssigned: totalItems,
        approvedLeads: approvedItems,
        pendingLeads: stat.pendingLeads,
        awaitingApprovalLeads: stat.awaitingApprovalLeads,
        rejectedLeads: stat.rejectedLeads,
        leadsAchievementRate:
          totalItems > 0 ? ((approvedItems / totalItems) * 100).toFixed(2) : 0,
      };
      return map;
    }, {});

    const quotationsStatsMap = quotationsStats.reduce((map, stat) => {
      const totalItems = stat.totalQuotationsAssigned;
      const approvedItems = stat.approvedQuotations;
      map[stat._id.toString()] = {
        totalQuotationsAssigned: totalItems,
        approvedQuotations: approvedItems,
        pendingQuotations: stat.pendingQuotations,
        awaitingApprovalQuotations: stat.awaitingApprovalQuotations,
        rejectedQuotations: stat.rejectedQuotations,
        quotationsAchievementRate:
          totalItems > 0 ? ((approvedItems / totalItems) * 100).toFixed(2) : 0,
        totalQuotationValue: stat.totalQuotationValue || 0,
        approvedQuotationValue: stat.approvedQuotationValue || 0,
      };
      return map;
    }, {});

    // Calculate overall statistics for leads
    const overallLeadsStats = await Leads.aggregate([
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
          totalApprovedLeads: {
            $sum: {
              $cond: [{ $eq: ["$lead_status", "approved"] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Calculate overall statistics for quotations
    const overallQuotationsStats = await Quotation.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "salesAgent",
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
          totalQuotationsAssigned: { $sum: 1 },
          totalApprovedQuotations: {
            $sum: {
              $cond: [{ $eq: ["$approvalStatus", "approved"] }, 1, 0],
            },
          },
          totalQuotationValue: { $sum: "$DocTotal" },
          totalApprovedQuotationValue: {
            $sum: {
              $cond: [{ $eq: ["$approvalStatus", "approved"] }, "$DocTotal", 0],
            },
          },
        },
      },
    ]);

    // Format agents data with computed fields and statistics
    const formattedAgents = agents.map((agent) => {
      const agentLeadsStats = leadsStatsMap[agent._id.toString()] || {
        totalLeadsAssigned: 0,
        approvedLeads: 0,
        pendingLeads: 0,
        awaitingApprovalLeads: 0,
        rejectedLeads: 0,
        leadsAchievementRate: 0,
      };

      const agentQuotationsStats = quotationsStatsMap[agent._id.toString()] || {
        totalQuotationsAssigned: 0,
        approvedQuotations: 0,
        pendingQuotations: 0,
        awaitingApprovalQuotations: 0,
        rejectedQuotations: 0,
        quotationsAchievementRate: 0,
        totalQuotationValue: 0,
        approvedQuotationValue: 0,
      };

      // Calculate overall achievement rate (combining leads and quotations)
      const totalAssigned =
        agentLeadsStats.totalLeadsAssigned +
        agentQuotationsStats.totalQuotationsAssigned;
      const totalApproved =
        agentLeadsStats.approvedLeads + agentQuotationsStats.approvedQuotations;
      const overallAchievementRate =
        totalAssigned > 0
          ? ((totalApproved / totalAssigned) * 100).toFixed(2)
          : 0;

      return {
        ...agent,
        fullName: `${agent.firstName} ${agent.lastName}`,
        // Leads statistics
        leadsAssigned: agentLeadsStats.totalLeadsAssigned,
        approvedLeads: agentLeadsStats.approvedLeads,
        pendingLeads: agentLeadsStats.pendingLeads,
        awaitingApprovalLeads: agentLeadsStats.awaitingApprovalLeads,
        rejectedLeads: agentLeadsStats.rejectedLeads,
        leadsAchievementRate: agentLeadsStats.leadsAchievementRate,
        // Quotations statistics
        quotationsAssigned: agentQuotationsStats.totalQuotationsAssigned,
        approvedQuotations: agentQuotationsStats.approvedQuotations,
        pendingQuotations: agentQuotationsStats.pendingQuotations,
        awaitingApprovalQuotations:
          agentQuotationsStats.awaitingApprovalQuotations,
        rejectedQuotations: agentQuotationsStats.rejectedQuotations,
        quotationsAchievementRate:
          agentQuotationsStats.quotationsAchievementRate,
        totalQuotationValue: agentQuotationsStats.totalQuotationValue,
        approvedQuotationValue: agentQuotationsStats.approvedQuotationValue,
        // Overall statistics
        totalAssigned: totalAssigned,
        totalApproved: totalApproved,
        overallAchievementRate: overallAchievementRate,
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
      // Agent statistics
      totalAgents: agentStats.length > 0 ? agentStats[0].totalAgents : 0,
      activeAgents: agentStats.length > 0 ? agentStats[0].activeAgents : 0,
      deactivatedAgents:
        agentStats.length > 0 ? agentStats[0].deactivatedAgents : 0,
      // Leads statistics
      totalLeadsAssigned:
        overallLeadsStats.length > 0
          ? overallLeadsStats[0].totalLeadsAssigned
          : 0,
      totalApprovedLeads:
        overallLeadsStats.length > 0
          ? overallLeadsStats[0].totalApprovedLeads
          : 0,
      overallLeadsAchievementRate:
        overallLeadsStats.length > 0 &&
        overallLeadsStats[0].totalLeadsAssigned > 0
          ? (
              (overallLeadsStats[0].totalApprovedLeads /
                overallLeadsStats[0].totalLeadsAssigned) *
              100
            ).toFixed(2)
          : 0,
      // Quotations statistics
      totalQuotationsAssigned:
        overallQuotationsStats.length > 0
          ? overallQuotationsStats[0].totalQuotationsAssigned
          : 0,
      totalApprovedQuotations:
        overallQuotationsStats.length > 0
          ? overallQuotationsStats[0].totalApprovedQuotations
          : 0,
      totalQuotationValue:
        overallQuotationsStats.length > 0
          ? overallQuotationsStats[0].totalQuotationValue
          : 0,
      totalApprovedQuotationValue:
        overallQuotationsStats.length > 0
          ? overallQuotationsStats[0].totalApprovedQuotationValue
          : 0,
      overallQuotationsAchievementRate:
        overallQuotationsStats.length > 0 &&
        overallQuotationsStats[0].totalQuotationsAssigned > 0
          ? (
              (overallQuotationsStats[0].totalApprovedQuotations /
                overallQuotationsStats[0].totalQuotationsAssigned) *
              100
            ).toFixed(2)
          : 0,
      // Combined statistics
      overallAchievementRate: (() => {
        const totalLeads =
          overallLeadsStats.length > 0
            ? overallLeadsStats[0].totalLeadsAssigned
            : 0;
        const totalQuotations =
          overallQuotationsStats.length > 0
            ? overallQuotationsStats[0].totalQuotationsAssigned
            : 0;
        const approvedLeads =
          overallLeadsStats.length > 0
            ? overallLeadsStats[0].totalApprovedLeads
            : 0;
        const approvedQuotations =
          overallQuotationsStats.length > 0
            ? overallQuotationsStats[0].totalApprovedQuotations
            : 0;

        const totalAssigned = totalLeads + totalQuotations;
        const totalApproved = approvedLeads + approvedQuotations;

        return totalAssigned > 0
          ? ((totalApproved / totalAssigned) * 100).toFixed(2)
          : 0;
      })(),
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

    // Calculate leads statistics
    const leadsStats = await Leads.aggregate([
      {
        $match: {
          assigned_agent_id: agent._id,
        },
      },
      {
        $group: {
          _id: null,
          totalLeadsAssigned: { $sum: 1 },
          approvedLeads: {
            $sum: {
              $cond: [{ $eq: ["$lead_status", "approved"] }, 1, 0],
            },
          },
          pendingLeads: {
            $sum: {
              $cond: [{ $eq: ["$lead_status", "pending"] }, 1, 0],
            },
          },
          awaitingApprovalLeads: {
            $sum: {
              $cond: [{ $eq: ["$lead_status", "awaiting_approval"] }, 1, 0],
            },
          },
          rejectedLeads: {
            $sum: {
              $cond: [{ $eq: ["$lead_status", "rejected"] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Calculate quotations statistics
    const quotationsStats = await Quotation.aggregate([
      {
        $match: {
          salesAgent: agent._id,
        },
      },
      {
        $group: {
          _id: null,
          totalQuotationsAssigned: { $sum: 1 },
          approvedQuotations: {
            $sum: {
              $cond: [{ $eq: ["$approvalStatus", "approved"] }, 1, 0],
            },
          },
          pendingQuotations: {
            $sum: {
              $cond: [{ $eq: ["$approvalStatus", "pending"] }, 1, 0],
            },
          },
          awaitingApprovalQuotations: {
            $sum: {
              $cond: [{ $eq: ["$approvalStatus", "awaiting_approval"] }, 1, 0],
            },
          },
          rejectedQuotations: {
            $sum: {
              $cond: [{ $eq: ["$approvalStatus", "rejected"] }, 1, 0],
            },
          },
          totalQuotationValue: { $sum: "$DocTotal" },
          approvedQuotationValue: {
            $sum: {
              $cond: [{ $eq: ["$approvalStatus", "approved"] }, "$DocTotal", 0],
            },
          },
        },
      },
    ]);

    const agentLeadsStats =
      leadsStats.length > 0
        ? leadsStats[0]
        : {
            totalLeadsAssigned: 0,
            approvedLeads: 0,
            pendingLeads: 0,
            awaitingApprovalLeads: 0,
            rejectedLeads: 0,
          };

    const agentQuotationsStats =
      quotationsStats.length > 0
        ? quotationsStats[0]
        : {
            totalQuotationsAssigned: 0,
            approvedQuotations: 0,
            pendingQuotations: 0,
            awaitingApprovalQuotations: 0,
            rejectedQuotations: 0,
            totalQuotationValue: 0,
            approvedQuotationValue: 0,
          };

    // Calculate achievement rates
    const leadsAchievementRate =
      agentLeadsStats.totalLeadsAssigned > 0
        ? (
            (agentLeadsStats.approvedLeads /
              agentLeadsStats.totalLeadsAssigned) *
            100
          ).toFixed(2)
        : 0;

    const quotationsAchievementRate =
      agentQuotationsStats.totalQuotationsAssigned > 0
        ? (
            (agentQuotationsStats.approvedQuotations /
              agentQuotationsStats.totalQuotationsAssigned) *
            100
          ).toFixed(2)
        : 0;

    const totalAssigned =
      agentLeadsStats.totalLeadsAssigned +
      agentQuotationsStats.totalQuotationsAssigned;
    const totalApproved =
      agentLeadsStats.approvedLeads + agentQuotationsStats.approvedQuotations;
    const overallAchievementRate =
      totalAssigned > 0
        ? ((totalApproved / totalAssigned) * 100).toFixed(2)
        : 0;

    // Add computed fields
    const formattedAgent = {
      ...agent,
      fullName: `${agent.firstName} ${agent.lastName}`,
      // Leads statistics
      leadsAssigned: agentLeadsStats.totalLeadsAssigned,
      approvedLeads: agentLeadsStats.approvedLeads,
      pendingLeads: agentLeadsStats.pendingLeads,
      awaitingApprovalLeads: agentLeadsStats.awaitingApprovalLeads,
      rejectedLeads: agentLeadsStats.rejectedLeads,
      leadsAchievementRate: Number.parseFloat(leadsAchievementRate),
      // Quotations statistics
      quotationsAssigned: agentQuotationsStats.totalQuotationsAssigned,
      approvedQuotations: agentQuotationsStats.approvedQuotations,
      pendingQuotations: agentQuotationsStats.pendingQuotations,
      awaitingApprovalQuotations:
        agentQuotationsStats.awaitingApprovalQuotations,
      rejectedQuotations: agentQuotationsStats.rejectedQuotations,
      quotationsAchievementRate: Number.parseFloat(quotationsAchievementRate),
      totalQuotationValue: agentQuotationsStats.totalQuotationValue,
      approvedQuotationValue: agentQuotationsStats.approvedQuotationValue,
      // Overall statistics
      totalAssigned: totalAssigned,
      totalApproved: totalApproved,
      overallAchievementRate: Number.parseFloat(overallAchievementRate),
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

// Get agent performance stats - REMOVED DATE FILTER
const getDataTechSalesAgentPerformanceStats = async (req, res) => {
  try {
    const { id } = req.params;

    const agent = await User.findById(id);
    if (!agent || agent.role !== "data_tech_sales_agent") {
      return res.status(404).json({
        success: false,
        error: "Data tech sales agent not found",
      });
    }

    // Get performance stats for ALL TIME (no date filter)
    const [customerStats, leadStats, quotationStats, orderStats] =
      await Promise.all([
        // Customer stats
        Customer.aggregate([
          {
            $match: {
              assignedTo: agent._id,
            },
          },
          {
            $group: {
              _id: null,
              totalCustomers: { $sum: 1 },
              activeCustomers: {
                $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
              },
            },
          },
        ]),

        // Lead stats
        Leads.aggregate([
          {
            $match: {
              assigned_agent_id: agent._id,
            },
          },
          {
            $group: {
              _id: null,
              totalLeads: { $sum: 1 },
              approvedLeads: {
                $sum: { $cond: [{ $eq: ["$lead_status", "approved"] }, 1, 0] },
              },
              pendingLeads: {
                $sum: { $cond: [{ $eq: ["$lead_status", "pending"] }, 1, 0] },
              },
              rejectedLeads: {
                $sum: { $cond: [{ $eq: ["$lead_status", "rejected"] }, 1, 0] },
              },
            },
          },
        ]),

        // Quotation stats
        Quotation.aggregate([
          {
            $match: {
              salesAgent: agent._id,
            },
          },
          {
            $group: {
              _id: null,
              totalQuotations: { $sum: 1 },
              approvedQuotations: {
                $sum: {
                  $cond: [{ $eq: ["$approvalStatus", "approved"] }, 1, 0],
                },
              },
              pendingQuotations: {
                $sum: {
                  $cond: [{ $eq: ["$approvalStatus", "pending"] }, 1, 0],
                },
              },
              totalValue: { $sum: "$DocTotal" },
              approvedValue: {
                $sum: {
                  $cond: [
                    { $eq: ["$approvalStatus", "approved"] },
                    "$DocTotal",
                    0,
                  ],
                },
              },
            },
          },
        ]),

        // Sales Order stats
        SalesOrder.aggregate([
          {
            $match: {
              salesAgent: agent._id,
            },
          },
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              openOrders: {
                $sum: { $cond: [{ $eq: ["$DocumentStatus", "Open"] }, 1, 0] },
              },
              closedOrders: {
                $sum: { $cond: [{ $eq: ["$DocumentStatus", "Closed"] }, 1, 0] },
              },
              totalOrderValue: { $sum: "$DocTotal" },
            },
          },
        ]),
      ]);

    const performanceData = {
      totalCustomers:
        customerStats.length > 0 ? customerStats[0].totalCustomers : 0,
      activeCustomers:
        customerStats.length > 0 ? customerStats[0].activeCustomers : 0,
      totalLeads: leadStats.length > 0 ? leadStats[0].totalLeads : 0,
      approvedLeads: leadStats.length > 0 ? leadStats[0].approvedLeads : 0,
      pendingLeads: leadStats.length > 0 ? leadStats[0].pendingLeads : 0,
      rejectedLeads: leadStats.length > 0 ? leadStats[0].rejectedLeads : 0,
      totalQuotations:
        quotationStats.length > 0 ? quotationStats[0].totalQuotations : 0,
      approvedQuotations:
        quotationStats.length > 0 ? quotationStats[0].approvedQuotations : 0,
      pendingQuotations:
        quotationStats.length > 0 ? quotationStats[0].pendingQuotations : 0,
      totalQuotationValue:
        quotationStats.length > 0 ? quotationStats[0].totalValue : 0,
      approvedQuotationValue:
        quotationStats.length > 0 ? quotationStats[0].approvedValue : 0,
      totalOrders: orderStats.length > 0 ? orderStats[0].totalOrders : 0,
      openOrders: orderStats.length > 0 ? orderStats[0].openOrders : 0,
      closedOrders: orderStats.length > 0 ? orderStats[0].closedOrders : 0,
      totalOrderValue:
        orderStats.length > 0 ? orderStats[0].totalOrderValue : 0,
    };

    res.status(200).json({
      success: true,
      data: performanceData,
    });
  } catch (error) {
    console.error("Error fetching agent performance stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch agent performance stats",
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
  getDataTechSalesAgentPerformanceStats,
  getUserById,
  activateUser,
  deactivateUser,
  toggleUserActivation,
};
