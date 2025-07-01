const transporter = require("../config/emailConfig");
const createEmailTemplate = require("../utils/emailTemplate");
const GeneralInformationForm = require("../models/GeneralInformation.model");
const Leads = require("../models/Leads.model");
const NotificationService = require("../utils/notificationService");
const { createLeadTask } = require("./task.controller");
const submitGeneralInformationForm = async (req, res) => {
  try {
    const formData = req.body;
    console.log("Received general information form data:", formData);

    // Map frontend field names to schema field names
    const mappedData = {
      businessType: formData.businessType, // Maps from natureOfServices
      countryOfOrigin: formData.countryOfOrigin, // Maps from countryOfResidence
      name: formData.contactName, // Maps from firstName + lastName
      email: formData.contactEmail, // Maps from email
      phone: formData.contactPhone, // Maps from phone
      clientLocation: formData.clientLocation,
      currentTaxes: formData.currentTaxes,
      travel: formData.travel,
      monthlyIncomeRange: formData.monthlyIncomeRange,
    };

    // Validate required fields
    const requiredFields = [
      "name",
      "email",
      "phone",
      "countryOfOrigin",
      "businessType",
      "clientLocation",
      "currentTaxes",
      "travel",
      "monthlyIncomeRange",
    ];

    const missingFields = requiredFields.filter(
      (field) => !mappedData[field] || mappedData[field].trim() === ""
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Missing required fields",
        missingFields: missingFields,
      });
    }

    // Create new form submission
    const newSubmission = new GeneralInformationForm(mappedData);
    const savedSubmission = await newSubmission.save();

    console.log(
      "General information form saved successfully:",
      savedSubmission._id
    );

    // Create corresponding lead
    const leadData = {
      name: mappedData.name,
      email: mappedData.email,
      contact: mappedData.phone,
      lead_type: "GeneralLead",
      description: `Business Type: ${mappedData.businessType}, Country of Origin: ${mappedData.countryOfOrigin}, Client Location: ${mappedData.clientLocation}, Current Taxes: ${mappedData.currentTaxes}, Travel: ${mappedData.travel}, Monthly Income Range: ${mappedData.monthlyIncomeRange}`,
      service_interested_in: "General Information Services",
      related_form_id: savedSubmission._id,
      form_model: "GeneralInformationForm",
    };

    const newLead = new Leads(leadData);
    const savedLead = await newLead.save();
    await createLeadTask(savedLead);

    console.log("Lead created successfully:", savedLead._id);
    try {
      await NotificationService.createNewLeadNotification(savedLead);
      console.log("Admin notification created for new lead:", savedLead._id);
    } catch (notificationError) {
      console.error("Error creating admin notification:", notificationError);
      // Don't fail the main operation if notification fails
    }
    res.status(201).json({
      message:
        "General information form submitted and lead created successfully",
      submissionId: savedSubmission._id,
      leadId: savedLead._id,
    });

    try {
      await sendConfirmationEmail(formData);
    } catch (error) {
      console.error("Error sending confirmation email:", error);
    }
  } catch (error) {
    console.error("Error submitting general information form:", error);

    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.status(400).json({
        error: "Validation failed",
        details: validationErrors,
      });
    }

    res.status(500).json({
      error: "Failed to submit general information form",
      details: error.message,
    });
  }
};
const sendConfirmationEmail = async (formData) => {
  try {
    // User email content
    const userContent = `
  <h2>Thank you for contacting DataTech!</h2>
  <p>We have received your message and one of our team members will contact you shortly to discuss your requirements.</p>

  <div class="info-box">
    <h3 style="color: #1e40af; margin-bottom: 15px;">Your Information:</h3>
    <div class="info-item">
      <span class="info-label">Name:</span>
      <span class="info-value">${formData.contactName}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Email:</span>
      <span class="info-value">${formData.contactEmail}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Phone:</span>
      <span class="info-value">${formData.contactPhone}</span>
    </div>
  <div class="info-item">
      <span class="info-label">Location of Clients:</span>
      <span class="info-value">${formData.clientLocation}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Current Taxes:</span>
      <span class="info-value">${formData.currentTaxes}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Traveling Information:</span>
      <span class="info-value">${formData.travel}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Monthly Income Range:</span>
      <span class="info-value">${formData.monthlyIncomeRange}</span>
    </div>
  </div>

  <p><strong>Ready to Get Started?</strong></p>
  <p>Our experts are excited to work with you and will reach out within 24 hours to discuss how we can help achieve your goals.</p>
`;

    // Admin email content
    const adminContent = `
  <h2>Let's Build A Future Together Submission</h2>
  <p>A Let's Build A Future Together submission has been received from the website.</p>

  <div class="info-box">
    <div class="info-item">
      <span class="info-label">Name:</span>
      <span class="info-value">${formData.contactName}/span>
    </div>
    <div class="info-item">
      <span class="info-label">Email:</span>
      <span class="info-value">${formData.contactEmail}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Phone:</span>
      <span class="info-value">${formData.contactPhone}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Location of Clients:</span>
      <span class="info-value">${formData.clientLocation}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Current Taxes:</span>
      <span class="info-value">${formData.currentTaxes}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Traveling Information:</span>
      <span class="info-value">${formData.travel}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Monthly Income Range:</span>
      <span class="info-value">${formData.monthlyIncomeRange}</span>
    </div>
  </div>
`;
    // Send user email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: formData.contactEmail,
      subject: "Thank you for your AI Services Consultation Request - DataTech",
      html: createEmailTemplate(
        "Thank you for your AI Services Consultation Request",
        userContent,
        true
      ),
    });

    // Send admin email
    // await transporter.sendMail({
    //   from: process.env.EMAIL_USER,
    //   to: "sales@data-tech.ae",
    //   subject: "New AI Services Consultation Request - DataTech",
    //   html: createEmailTemplate(
    //     "New AI Services Consultation Request",
    //     adminContent,
    //     false
    //   ),
    // });

    console.log("Business form emails sent successfully");
    return { success: true, message: "Emails sent successfully" };
  } catch (error) {
    console.error("Error sending business form emails:", error);
    throw new Error("Failed to send emails");
  }
};
module.exports = {
  submitGeneralInformationForm,
};
