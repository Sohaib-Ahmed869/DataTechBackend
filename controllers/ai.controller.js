const transporter = require("../config/emailConfig");
const createEmailTemplate = require("../utils/emailTemplate");
const { createLeadTask } = require("./task.controller");
const { AiServicesForm } = require("../models/AiServices.model"); // Adjust path as needed
const Leads = require("../models/Leads.model");
const NotificationService = require("../utils/notificationService");
const submitAIServicesForm = async (req, res) => {
  try {
    const formData = req.body;
    console.log("Received form data:", formData);

    // Map frontend field names to schema field names
    const mappedData = {
      businessType: formData.businessType,
      companySize: formData.companySize,
      currentChallenges: formData.currentChallenges,
      automationGoals: formData.automationGoals,
      website: formData.website,
      name: formData.contactName, // Frontend: contactName -> Schema: name
      email: formData.contactEmail, // Frontend: contactEmail -> Schema: email
      phone: formData.contactPhone, // Frontend: contactPhone -> Schema: phone
      preferredTime: formData.preferredTime,
    };

    // Validate required fields
    const requiredFields = [
      "businessType",
      "companySize",
      "currentChallenges",
      "automationGoals",
      "name",
      "email",
      "phone",
      "preferredTime",
    ];
    const missingFields = requiredFields.filter((field) => !mappedData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Missing required fields",
        missingFields: missingFields,
      });
    }

    // Create new form submission
    const newSubmission = new AiServicesForm(mappedData);
    const savedSubmission = await newSubmission.save();

    console.log("Form saved successfully:", savedSubmission._id);

    // Create corresponding lead
    const leadData = {
      name: mappedData.name,
      email: mappedData.email,
      contact: mappedData.phone,
      lead_type: "AiServicesLead",
      description: `Business Type: ${mappedData.businessType}, Company Size: ${mappedData.companySize}, Current Challenges: ${mappedData.currentChallenges} , Automation Goals: ${mappedData.automationGoals}, Website: ${mappedData.website}, Preferred Time: ${mappedData.preferredTime}`,
      service_interested_in: "AI Services & Automation",
      related_form_id: savedSubmission._id,
      form_model: "AiServicesForm",
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
    }
    res.status(201).json({
      message: "Form submitted and lead created successfully",
      submissionId: savedSubmission._id,
      leadId: savedLead._id,
    });

    try {
      await sendAiServicesEmail(formData);
    } catch (error) {
      console.log("Ai Services Email not sent", error);
    }
  } catch (error) {
    console.error("Error submitting form:", error);

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
      error: "Failed to submit form",
      details: error.message,
    });
  }
};
const sendAiServicesEmail = async (formData) => {
  try {
    // User email content
    const userContent = `
  <h2>Thank you for your AI Services Consultation Request!</h2>
  <p>We have received your information and one of our AI experts will contact you shortly to discuss how we can help transform your business operations.</p>

  <div class="info-box">
    <h3 style="color: #1e40af; margin-bottom: 15px;">Your Submission Summary:</h3>
    <div class="info-item">
      <span class="info-label">Business Type:</span>
      <span class="info-value">${formData.businessType}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Company Size:</span>
      <span class="info-value">${formData.companySize}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Current Challenges:</span>
      <span class="info-value">${formData.currentChallenges}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Automation Goals:</span>
      <span class="info-value">${formData.automationGoals}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Website:</span>
      <span class="info-value">${formData.website || "Not provided"}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Contact Name:</span>
      <span class="info-value">${formData.contactName}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Contact Email:</span>
      <span class="info-value">${formData.contactEmail}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Contact Phone:</span>
      <span class="info-value">${formData.contactPhone}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Preferred Call Time:</span>
      <span class="info-value">${formData.preferredTime}</span>
    </div>
  </div>

  <p><strong>What's Next?</strong></p>
  <p>Our AI solutions team will review your requirements and contact you within 24 hours to schedule a personalized consultation.</p>
`;

    // Admin email content
    const adminContent = `
  <h2>New AI Services Consultation Request</h2>
  <p>A new AI services consultation request has been received. Please review the details below and follow up with the client.</p>

  <div class="info-box">
    <div class="info-item">
      <span class="info-label">Business Type:</span>
      <span class="info-value">${formData.businessType}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Company Size:</span>
      <span class="info-value">${formData.companySize}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Current Challenges:</span>
      <span class="info-value">${formData.currentChallenges}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Automation Goals:</span>
      <span class="info-value">${formData.automationGoals}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Website:</span>
      <span class="info-value">${formData.website || "Not provided"}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Contact Name:</span>
      <span class="info-value">${formData.contactName}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Contact Email:</span>
      <span class="info-value">${formData.contactEmail}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Contact Phone:</span>
      <span class="info-value">${formData.contactPhone}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Preferred Call Time:</span>
      <span class="info-value">${formData.preferredTime}</span>
    </div>
  </div>`;
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
  submitAIServicesForm,
};
