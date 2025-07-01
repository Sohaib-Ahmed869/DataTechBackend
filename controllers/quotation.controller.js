const Quotation = require("../models/Quotation.model");
const Customer = require("../models/Customer.model");
const Task = require("../models/Task.model");
const quotationService = require("../utils/quotationService");
const emailService = require("../utils/emailService");
const pdfGenerator = require("../utils/pdfGenerator");
const SalesOrder = require("../models/SalesOrder.model");

// Get all quotations with pagination and filtering

// Get quotations for a specific customer
const getCustomerQuotations = async (req, res) => {
  try {
    const { cardCode } = req.params;

    const quotations = await Quotation.find({ CardCode: cardCode })
      .populate("salesAgent", "firstName lastName email")
      .sort({ DocDate: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: quotations,
    });
  } catch (error) {
    console.error("Error fetching customer quotations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer quotations",
      error: error.message,
    });
  }
};

// Get single quotation by DocEntry
const getQuotationByDocEntry = async (req, res) => {
  try {
    const { docEntry } = req.params;

    const quotation = await Quotation.findOne({ DocEntry: docEntry })
      .populate("salesAgent", "firstName lastName email")
      .lean();

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    res.status(200).json({
      success: true,
      data: quotation,
    });
  } catch (error) {
    console.error("Error fetching quotation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch quotation",
      error: error.message,
    });
  }
};

// Convert quotation to order
const convertToOrder = async (req, res) => {
  try {
    const { docEntry } = req.params;
    const userId = req.user?._id;
    const userRole = req.user?.role;
    const userName = `${req.user?.firstName} ${req.user?.lastName}`;

    console.log(
      `Converting quotation ${docEntry} to order by user ${userName}`
    );

    // Find the quotation
    const quotation = await Quotation.findOne({
      DocEntry: docEntry,
      IsActive: true,
    }).populate("salesAgent", "firstName lastName email");

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: `Active quotation with DocEntry ${docEntry} not found`,
      });
    }

    // Check if quotation is approved
    if (quotation.approvalStatus !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Quotation must be approved before conversion to order",
      });
    }

    // Check permissions for sales agents
    if (
      userRole === "data_tech_sales_agent" &&
      quotation.salesAgent &&
      quotation.salesAgent._id.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to convert this quotation",
      });
    }

    // Check if already converted
    if (quotation.ConvertedToOrderDocEntry) {
      return res.status(400).json({
        success: false,
        message: `Quotation already converted to order #${quotation.ConvertedToOrderDocEntry}`,
      });
    }

    // Generate DocEntry for the new order
    const lastOrder = await SalesOrder.findOne().sort({ DocEntry: -1 });
    const newDocEntry = lastOrder ? lastOrder.DocEntry + 1 : 10000;
    const newDocNum = newDocEntry;

    console.log(`Generated new order DocEntry: ${newDocEntry}`);

    // Create notes for the order
    const orderNotes = `This order was created from quotation #${quotation.DocEntry} by ${userName}. Original quotation amount: €${quotation.DocTotal}.`;

    // Prepare quotation data
    const quotationData = quotation.toObject();

    // Process document lines to ensure proper formatting
    const processedDocumentLines = quotationData.DocumentLines.map(
      (line, index) => ({
        ...line,
        LineNum: index, // Ensure proper line numbering
        PriceList: quotationData.PriceList || 2, // Default to Prix Livraison
        LineTotal: (line.Quantity || 0) * (line.Price || 0),
        // Remove any quotation-specific fields that shouldn't be in orders
        _id: undefined,
      })
    );

    // Create the sales order from quotation data
    const orderData = {
      // Basic document info
      DocEntry: newDocEntry,
      DocNum: newDocNum,
      DocType: "dDocument_Items",
      DocDate: req.body.DocDate || new Date(),
      DocDueDate: req.body.DocDueDate || quotation.DocDueDate || new Date(),
      CreationDate: new Date(),
      UpdateDate: new Date(),

      // Customer info
      CardCode: quotation.CardCode,
      CardName: quotation.CardName,
      Address: quotation.Address || "",

      // Financial info
      DocTotal: quotation.DocTotal,
      DocCurrency: quotation.DocCurrency || "EUR",
      PriceList: quotationData.PriceList || 2,

      // Document lines
      DocumentLines: processedDocumentLines,

      // Comments and notes
      Comments: quotation.Comments || "",
      U_Notes: orderNotes,

      // Sales agent
      salesAgent: quotation.salesAgent._id,

      // Reference to original quotation
      OriginatingQuotation: quotation.DocEntry,

      // SAP Integration fields
      SyncedWithSAP: false,
      LocalStatus: "Created",

      // Payment fields (if applicable)
      payment_status: quotation.payment_status || "pending",
      Payment_id: quotation.Payment_id || "",

      // Override with any additional data from request body
      ...req.body,

      // Ensure critical fields are not overridden
      DocEntry: newDocEntry,
      DocNum: newDocNum,
      OriginatingQuotation: quotation.DocEntry,
    };

    console.log("Creating new sales order with data:", {
      DocEntry: orderData.DocEntry,
      DocNum: orderData.DocNum,
      CardName: orderData.CardName,
      DocTotal: orderData.DocTotal,
      DocumentLinesCount: orderData.DocumentLines.length,
    });

    // Create the new order
    const newOrder = new SalesOrder(orderData);
    await newOrder.save();

    console.log(
      `Sales order created successfully with DocEntry: ${newOrder.DocEntry}`
    );

    // Update the quotation to mark it as converted
    quotation.IsActive = false;
    quotation.ConvertedToOrderDocEntry = newOrder.DocEntry;
    quotation.ConvertedDate = new Date();
    quotation.UpdateDate = new Date();
    await quotation.save();

    console.log(`Quotation ${docEntry} marked as converted`);

    // Update the associated task if it exists
    if (quotation.approvalTask) {
      await Task.findByIdAndUpdate(quotation.approvalTask, {
        status: "completed",
        completedDate: new Date(),
        metadata: {
          convertedToOrder: newOrder.DocEntry,
          convertedBy: userId,
          convertedDate: new Date().toISOString(),
        },
      });
      console.log(`Updated associated task: ${quotation.approvalTask}`);
    }

    // Populate the order for response
    const populatedOrder = await SalesOrder.findById(newOrder._id)
      .populate("salesAgent", "firstName lastName email")
      .lean();

    res.status(201).json({
      success: true,
      message: "Quotation successfully converted to order",
      data: {
        order: populatedOrder,
        originalQuotation: {
          DocEntry: quotation.DocEntry,
          status: "Converted",
          convertedDate: quotation.ConvertedDate,
        },
      },
    });
  } catch (error) {
    console.error("Error converting quotation to order:", error);
    res.status(500).json({
      success: false,
      message: "Error converting quotation to order",
      error: error.message,
    });
  }
};

// Cancel quotation
const cancelQuotation = async (req, res) => {
  try {
    const { docEntry } = req.params;
    const { reason } = req.body;

    const quotation = await Quotation.findOneAndUpdate(
      { DocEntry: docEntry },
      {
        IsActive: false,
        CancelReason: reason || "Cancelled by user",
        CancelDate: new Date(),
        UpdateDate: new Date(),
      },
      { new: true }
    )
      .populate("salesAgent", "firstName lastName email")
      .lean();

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Quotation cancelled successfully",
      data: quotation,
    });
  } catch (error) {
    console.error("Error cancelling quotation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel quotation",
      error: error.message,
    });
  }
};

// Duplicate quotation
const duplicateQuotation = async (req, res) => {
  const userId = req.user?._id; // Add this line - it was missing

  try {
    const { docEntry } = req.params;

    // Find the original quotation
    const originalQuotation = await Quotation.findOne({
      DocEntry: docEntry,
    }).lean();

    if (!originalQuotation) {
      return res.status(404).json({
        success: false,
        message: "Original quotation not found",
      });
    }

    // Generate new DocEntry
    const lastQuotation = await Quotation.findOne().sort({ DocEntry: -1 });
    const newDocEntry = lastQuotation ? lastQuotation.DocEntry + 1 : 1;

    // Create duplicate data - remove fields that shouldn't be duplicated
    const duplicateData = {
      ...originalQuotation,
      _id: undefined, // Remove the original ID
      DocEntry: newDocEntry,
      DocNum: newDocEntry,
      DocDate: new Date(),
      CreationDate: new Date(),
      UpdateDate: new Date(),
      DuplicatedFrom: docEntry, // Track the original quotation
      IsActive: true,
      approvalStatus: "awaiting_approval",
      approvalTask: undefined, // Remove original task reference
      ConvertedToOrderDocEntry: undefined,
      ConvertedDate: undefined,
      // Ensure the current user is assigned
      salesAgent: originalQuotation.salesAgent || userId,
      assignedTo: userId,
    };

    // Create the duplicate quotation with task using the same service
    const result = await quotationService.createQuotationWithTask(
      duplicateData,
      userId
    );

    res.status(201).json({
      success: true,
      message: "Quotation duplicated and approval task created successfully",
      data: result.data,
      task: result.task,
    });
  } catch (error) {
    console.error("Error duplicating quotation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to duplicate quotation",
      error: error.message,
    });
  }
};
// Get quotation statistics
const getQuotationStats = async (req, res) => {
  try {
    const { fromDate, toDate, salesAgent } = req.query;
    const userId = req.user?._id;
    const userRole = req.user?.role;

    // Build filter object
    const filter = { IsActive: true };

    // Role-based filtering
    if (userRole === "datatech_sales_agent") {
      filter.salesAgent = userId;
    } else if (salesAgent) {
      filter.salesAgent = salesAgent;
    }

    // Date range filter
    if (fromDate || toDate) {
      filter.DocDate = {};
      if (fromDate) filter.DocDate.$gte = new Date(fromDate);
      if (toDate) filter.DocDate.$lte = new Date(toDate);
    }

    // Get statistics
    const totalQuotations = await Quotation.countDocuments(filter);

    const totalValueResult = await Quotation.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: "$DocTotal" } } },
    ]);
    const totalValue =
      totalValueResult.length > 0 ? totalValueResult[0].total : 0;

    const awaitingApproval = await Quotation.countDocuments({
      ...filter,
      approvalStatus: "awaiting_approval",
    });

    const approved = await Quotation.countDocuments({
      ...filter,
      approvalStatus: "approved",
    });

    const rejected = await Quotation.countDocuments({
      ...filter,
      approvalStatus: "rejected",
    });

    const converted = await Quotation.countDocuments({
      ...filter,
      ConvertedToOrderDocEntry: { $exists: true },
    });

    res.status(200).json({
      success: true,
      data: {
        totalQuotations,
        totalValue,
        awaitingApproval,
        approved,
        rejected,
        converted,
      },
    });
  } catch (error) {
    console.error("Error fetching quotation stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch quotation statistics",
      error: error.message,
    });
  }
};

// Send quotation by email - simplified to just send quotation ID
const sendQuotationByEmail = async (req, res) => {
  try {
    console.log("Received request to send quotation by email", req.body);
    const { docEntry } = req.params;
    const emailData = req.body;

    if (!emailData || !emailData.to) {
      return res.status(400).json({
        success: false,
        message: "Recipient email address is required",
      });
    }

    console.log(
      `Processing quotation ${docEntry} for email to ${emailData.to}`
    );

    // Find the quotation
    const quotation = await Quotation.findOne({
      DocEntry: docEntry,
    }).populate("salesAgent", "firstName lastName email");

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: `Quotation with ID ${docEntry} not found`,
      });
    }

    // Prepare customer data (since you don't have a separate customer model)
    const customerForTemplate = {
      CardName: quotation.CardName || "Valued Customer",
      street: "",
      city: "",
      zipCode: "",
      Country: "",
      Phone: "",
    };

    console.log("Prepared customer template data:", customerForTemplate);

    // Generate PDF
    console.log("Generating PDF...");
    let pdfBuffer;
    try {
      pdfBuffer = await pdfGenerator.generateQuotationPDF(
        quotation,
        customerForTemplate
      );
      // Log PDF details
      console.log(`PDF generated successfully: ${pdfBuffer.length} bytes`);
    } catch (pdfError) {
      console.error("Error generating PDF:", pdfError);
      return res.status(500).json({
        success: false,
        message: `Error generating PDF: ${pdfError.message}`,
      });
    }

    // Send email with attachment
    console.log("Sending email with PDF attachment...");
    try {
      // Format the email for better deliverability
      const emailText =
        emailData.message ||
        `Dear ${quotation.CardName},\n\nPlease find attached your quotation #${quotation.DocNum}.\n\nThank you for your interest in our services.\n\nBest regards,\nDataTech Solutions Team`;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">DataTech Solutions</h1>
            <p style="margin: 5px 0 0 0;">Your Technology Partner</p>
          </div>
          <div style="padding: 30px 20px;">
            <h2 style="color: #2563eb; margin-bottom: 20px;">Quotation #${
              quotation.DocNum
            }</h2>
            <p>Dear ${quotation.CardName},</p>
            <p>Please find attached your quotation for the services you requested.</p>
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <h3 style="color: #2563eb; margin-top: 0;">Quotation Details:</h3>
              <p><strong>Quotation Number:</strong> #${quotation.DocNum}</p>
              <p><strong>Date:</strong> ${new Date(
                quotation.DocDate
              ).toLocaleDateString()}</p>
              <p><strong>Valid Until:</strong> ${new Date(
                quotation.DocDueDate
              ).toLocaleDateString()}</p>
              <p><strong>Total Amount:</strong> €${quotation.DocTotal}</p>
            </div>
            <p>${
              emailData.message ||
              "Thank you for your interest in our services. We look forward to working with you."
            }</p>
            <p>If you have any questions, please don't hesitate to contact us.</p>
            <p>Best regards,<br>
            <strong>DataTech Solutions Team</strong></p>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              DataTech Solutions | info@datatech.ie | www.datatech.ie
            </p>
          </div>
        </div>
      `;

      const info = await emailService.sendEmail({
        to: emailData.to,
        cc: emailData.cc || "",
        subject:
          emailData.subject ||
          `Quotation #${quotation.DocNum} - DataTech Solutions`,
        text: emailText,
        html: emailHtml,
        attachments: [
          {
            filename: `DataTech_Quotation_${quotation.DocNum}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
            encoding: "binary",
          },
        ],
      });

      // Record email sent
      quotation.emailSentTo = quotation.emailSentTo || [];
      quotation.emailSentTo.push({
        email: emailData.to,
        sentBy: req.user._id,
        sentDate: new Date(),
        messageId: info.messageId,
      });

      await quotation.save();

      return res.status(200).json({
        success: true,
        message: "Email sent successfully",
        messageId: info.messageId,
        data: {
          quotationNumber: quotation.DocNum,
          customer: quotation.CardName,
          sentTo: emailData.to,
          sentDate: new Date(),
        },
      });
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      return res.status(500).json({
        success: false,
        message: `Error sending email: ${emailError.message}`,
      });
    }
  } catch (error) {
    console.error("Error in sendQuotationByEmail:", error);
    return res.status(500).json({
      success: false,
      message: `An unexpected error occurred: ${error.message}`,
    });
  }
};

// Generate payment link - simplified to just use quotation ID
const generatePaymentLink = async (req, res) => {
  try {
    const { docNum } = req.params;

    const quotation = await Quotation.findOne({ DocNum: docNum });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    if (quotation.approvalStatus !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Quotation must be approved before generating payment link",
      });
    }

    // Generate a unique payment ID
    const paymentId = `PAY_${docNum}_${Date.now()}`;

    // Here you would integrate with your payment provider
    // For now, we'll simulate the payment link generation
    const paymentLink = `https://your-payment-provider.com/pay/${paymentId}`;

    // Update quotation with payment info
    await Quotation.findOneAndUpdate(
      { DocNum: docNum },
      {
        Payment_id: paymentId,
        paymentLink: paymentLink,
        paymentStatus: "pending",
        paymentLinkGeneratedDate: new Date(),
        UpdateDate: new Date(),
      }
    );

    res.status(200).json({
      success: true,
      message: "Payment link generated and sent to customer successfully",
      data: {
        paymentId,
        paymentLink,
        quotationNumber: docNum,
        customer: quotation.CardName,
        amount: quotation.DocTotal,
      },
    });
  } catch (error) {
    console.error("Error generating payment link:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate payment link",
      error: error.message,
    });
  }
};

// Get payment status
const getPaymentStatus = async (req, res) => {
  try {
    const { docNum } = req.params;

    const quotation = await Quotation.findOne({ DocNum: docNum });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    if (!quotation.Payment_id) {
      return res.status(400).json({
        success: false,
        message: "No payment link generated for this quotation",
      });
    }

    // Here you would check with your payment provider
    // For now, we'll simulate the status check
    const paymentStatus = quotation.paymentStatus || "pending";

    res.status(200).json({
      success: true,
      data: {
        paymentId: quotation.Payment_id,
        paymentStatus,
        paymentLink: quotation.paymentLink,
      },
    });
  } catch (error) {
    console.error("Error checking payment status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check payment status",
      error: error.message,
    });
  }
};

// Export quotations to CSV
const exportQuotations = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    const {
      search,
      status,
      cardCode,
      fromDate,
      toDate,
      salesAgent,
      showInactive,
    } = req.query;

    // Build filter object
    const filter = {};

    // Role-based filtering
    if (userRole === "datatech_sales_agent") {
      filter.salesAgent = userId;
    } else if (salesAgent) {
      filter.salesAgent = salesAgent;
    }

    // Apply other filters
    if (cardCode) filter.CardCode = { $regex: cardCode, $options: "i" };

    if (status) {
      if (status === "pending") {
        filter.approvalStatus = "pending";
      } else if (status === "approved") {
        filter.approvalStatus = "approved";
      } else if (status === "rejected") {
        filter.approvalStatus = "rejected";
      } else if (status === "active") {
        filter.IsActive = true;
      } else if (status === "converted") {
        filter.ConvertedToOrderDocEntry = { $exists: true };
      } else if (status === "cancelled") {
        filter.IsActive = false;
      }
    }

    if (!showInactive) {
      filter.IsActive = true;
    }

    if (fromDate || toDate) {
      filter.DocDate = {};
      if (fromDate) filter.DocDate.$gte = new Date(fromDate);
      if (toDate) filter.DocDate.$lte = new Date(toDate);
    }

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      const searchNumber = Number.parseInt(search) || 0;

      filter.$or = [
        { CardName: searchRegex },
        { CardCode: searchRegex },
        { Comments: searchRegex },
        ...(searchNumber > 0 ? [{ DocNum: searchNumber }] : []),
      ];
    }

    const quotations = await Quotation.find(filter)
      .populate("salesAgent", "firstName lastName email")
      .sort({ DocDate: -1 })
      .lean();

    // Convert to CSV format
    const csvHeader =
      "DocNum,CardCode,CardName,DocTotal,DocDate,ApprovalStatus,SalesAgent\n";
    const csvData = quotations
      .map(
        (q) =>
          `${q.DocNum},${q.CardCode},"${q.CardName}",${q.DocTotal},${
            q.DocDate?.toISOString().split("T")[0]
          },${q.approvalStatus},"${q.salesAgent?.firstName} ${
            q.salesAgent?.lastName
          }"`
      )
      .join("\n");

    const csv = csvHeader + csvData;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=quotations.csv");
    res.status(200).send(csv);
  } catch (error) {
    console.error("Error exporting quotations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export quotations",
      error: error.message,
    });
  }
};

// Bulk approve quotations
const bulkApproveQuotations = async (req, res) => {
  try {
    const { docEntries, comments } = req.body;

    if (!docEntries || docEntries.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No quotations selected for approval",
      });
    }

    const updateResult = await Quotation.updateMany(
      { DocEntry: { $in: docEntries } },
      {
        approvalStatus: "approved",
        approvedBy: req.user?.id,
        approvedDate: new Date(),
        approvalComments: comments,
        UpdateDate: new Date(),
      }
    );

    res.status(200).json({
      success: true,
      message: `${updateResult.modifiedCount} quotations approved successfully`,
      data: {
        approvedCount: updateResult.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Error bulk approving quotations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to bulk approve quotations",
      error: error.message,
    });
  }
};

// Bulk reject quotations
const bulkRejectQuotations = async (req, res) => {
  try {
    const { docEntries, reason } = req.body;

    if (!docEntries || docEntries.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No quotations selected for rejection",
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const updateResult = await Quotation.updateMany(
      { DocEntry: { $in: docEntries } },
      {
        approvalStatus: "rejected",
        rejectedBy: req.user?.id,
        rejectedDate: new Date(),
        rejectionReason: reason,
        UpdateDate: new Date(),
      }
    );

    res.status(200).json({
      success: true,
      message: `${updateResult.modifiedCount} quotations rejected successfully`,
      data: {
        rejectedCount: updateResult.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Error bulk rejecting quotations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to bulk reject quotations",
      error: error.message,
    });
  }
};
// Create new quotation with automatic approval task creation
const createQuotation = async (req, res) => {
  const userId = req.user?._id;
  try {
    const {
      CardCode,
      CardName,
      DocDate,
      DocDueDate,
      Comments,
      DocumentLines,
      DocTotal,
      salesAgent,
    } = req.body;

    // Validate required fields
    if (
      !CardCode ||
      !CardName ||
      !DocumentLines ||
      DocumentLines.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "CardCode, CardName, and DocumentLines are required",
      });
    }

    // Prepare quotation data
    const quotationData = {
      CardCode,
      CardName,
      DocDate,
      DocDueDate,
      Comments,
      DocumentLines,
      DocTotal: DocTotal || 0,
      salesAgent: salesAgent || userId,
      assignedTo: userId,
    };

    // Create quotation with task using our unified service
    const result = await quotationService.createQuotationWithTask(
      quotationData,
      userId
    );

    res.status(201).json({
      success: true,
      message: "Quotation and approval task created successfully",
      data: result.data,
      task: result.task,
    });
  } catch (error) {
    console.error("Error creating quotation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create quotation",
      error: error.message,
    });
  }
};

// Get all quotations with filtering
const getAllQuotations = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    const { status, salesAgent, page = 1, limit = 10 } = req.query;

    // Build filter
    const filter = { IsActive: true };

    // Role-based filtering
    if (userRole === "data_tech_sales_agent") {
      filter.salesAgent = userId; // Sales agents can only see their own quotations
    }

    // Status filtering
    if (status) {
      filter.approvalStatus = status;
    }

    // Sales agent filtering (admin only)
    if (salesAgent && userRole === "data_tech_admin") {
      filter.salesAgent = salesAgent;
    }

    const skip = (page - 1) * limit;
    const quotations = await Quotation.find(filter)
      .populate("salesAgent", "firstName lastName email")
      .populate("approvalTask")
      .populate("approvedBy", "firstName lastName email")
      .populate("rejectedBy", "firstName lastName email")
      .sort({ CreationDate: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))
      .lean();

    const total = await Quotation.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: quotations,
      pagination: {
        current: Number.parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalQuotations: total,
      },
    });
  } catch (error) {
    console.error("Error fetching quotations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch quotations",
      error: error.message,
    });
  }
};

// Get single quotation
const getQuotationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    const userRole = req.user?.role;

    const quotation = await Quotation.findById(id)
      .populate("salesAgent", "firstName lastName email")
      .populate("approvalTask")
      .populate("approvedBy", "firstName lastName email")
      .populate("rejectedBy", "firstName lastName email")
      .lean();

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    // Check permissions
    if (
      userRole === "data_tech_sales_agent" &&
      quotation.salesAgent._id.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.status(200).json({
      success: true,
      data: quotation,
    });
  } catch (error) {
    console.error("Error fetching quotation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch quotation",
      error: error.message,
    });
  }
};

const updateQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      CardCode,
      CardName,
      DocDate,
      DocDueDate,
      Comments,
      DocumentLines,
      DocTotal,
      salesAgent,
      IsActive,
      approvalStatus,
      approvalTask,
    } = req.body;

    const updatedQuotation = await Quotation.findByIdAndUpdate(
      id,
      {
        CardCode,
        CardName,
        DocDate,
        DocDueDate,
        Comments,
        DocumentLines,
        DocTotal,
        salesAgent,
        UpdateDate: new Date(),
        IsActive,
        approvalStatus,
        approvalTask,
      },
      { new: true }
    )
      .populate("salesAgent", "firstName lastName email")
      .populate("approvalTask")
      .lean();

    if (!updatedQuotation) {
      return res
        .status(404)
        .json({ success: false, message: "Quotation not found" });
    }

    res.status(200).json({
      success: true,
      message: "Quotation updated successfully",
      data: updatedQuotation,
    });
  } catch (error) {
    console.error("Error updating quotation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update quotation",
      error: error.message,
    });
  }
};

const deleteQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedQuotation = await Quotation.findByIdAndDelete(id).lean();

    if (!deletedQuotation) {
      return res
        .status(404)
        .json({ success: false, message: "Quotation not found" });
    }

    res.status(200).json({
      success: true,
      message: "Quotation deleted successfully",
      data: deletedQuotation,
    });
  } catch (error) {
    console.error("Error deleting quotation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete quotation",
      error: error.message,
    });
  }
};

// Approve quotation
const approveQuotation = async (req, res) => {
  try {
    const { docEntry } = req.params;
    const { comments } = req.body;
    const userId = req.user?._id;

    const quotation = await Quotation.findOne({ DocEntry: docEntry });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    // Update quotation
    const updatedQuotation = await Quotation.findOneAndUpdate(
      { DocEntry: docEntry },
      {
        approvalStatus: "approved",
        approvedBy: userId,
        approvedDate: new Date(),
        approvalComments: comments,
        UpdateDate: new Date(),
      },
      { new: true }
    )
      .populate("salesAgent", "firstName lastName email")
      .populate("approvedBy", "firstName lastName email")
      .lean();

    // Update associated task if exists
    if (quotation.approvalTask) {
      await Task.findByIdAndUpdate(quotation.approvalTask, {
        status: "approved", // This will automatically become "completed" due to our middleware
        approvedBy: userId,
        approvedDate: new Date(),
        approvalComments: comments,
      });
    }

    res.status(200).json({
      success: true,
      message: "Quotation approved successfully",
      data: updatedQuotation,
    });
  } catch (error) {
    console.error("Error approving quotation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve quotation",
      error: error.message,
    });
  }
};

// Reject quotation
const rejectQuotation = async (req, res) => {
  try {
    const { docEntry } = req.params;
    const { reason } = req.body;
    const userId = req.user?._id;

    const quotation = await Quotation.findOne({ DocEntry: docEntry });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    // Update quotation
    const updatedQuotation = await Quotation.findOneAndUpdate(
      { DocEntry: docEntry },
      {
        approvalStatus: "rejected",
        rejectedBy: userId,
        rejectedDate: new Date(),
        rejectionReason: reason,
        UpdateDate: new Date(),
      },
      { new: true }
    )
      .populate("salesAgent", "firstName lastName email")
      .populate("rejectedBy", "firstName lastName email")
      .lean();

    // Update associated task if exists
    if (quotation.approvalTask) {
      await Task.findByIdAndUpdate(quotation.approvalTask, {
        status: "rejected",
        rejectedBy: userId,
        rejectedDate: new Date(),
        rejectionReason: reason,
        completedDate: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      message: "Quotation rejected successfully",
      data: updatedQuotation,
    });
  } catch (error) {
    console.error("Error rejecting quotation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject quotation",
      error: error.message,
    });
  }
};
module.exports = {
  getAllQuotations,
  getCustomerQuotations,
  getQuotationByDocEntry,
  createQuotation,
  updateQuotation,
  convertToOrder,
  cancelQuotation,
  duplicateQuotation,
  approveQuotation,
  getQuotationStats,
  rejectQuotation,
  sendQuotationByEmail,
  generatePaymentLink,
  getPaymentStatus,
  exportQuotations,
  bulkApproveQuotations,
  bulkRejectQuotations,
};
