const transporter = require("../config/emailConfig");
const createEmailTemplate = require("../utils/emailTemplate");

const ConsultationForm = require("../models/ConsultationService.model"); // Adjust path as needed
const Leads = require("../models/Leads.model");

const submitConsultantServicesForm = async (req, res) => {
  try {
    const formData = req.body;
    console.log("Received consultation form data:", formData);

    // Map frontend field names to schema field names
    const mappedData = {
      projectType: formData.projectType,
      skillsRequired: formData.skillsRequired,
      projectDuration: formData.projectDuration,
      engagementType: formData.engagementType,
      budget: formData.budget,
      projectDescription: formData.projectDescription,
      urgency: formData.urgency,
      name: formData.contactName, // Frontend: contactName -> Schema: name
      email: formData.contactEmail, // Frontend: contactEmail -> Schema: email
      phone: formData.contactPhone, // Frontend: contactPhone -> Schema: phone
      companyName: formData.companyName,
    };

    // Validate required fields
    const requiredFields = [
      "projectType",
      "skillsRequired",
      "projectDuration",
      "engagementType",
      "budget",
      "projectDescription",
      "urgency",
      "name",
      "email",
      "phone",
      "companyName",
    ];

    const missingFields = requiredFields.filter((field) => !mappedData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Missing required fields",
        missingFields: missingFields,
      });
    }

    // Create new consultation form submission
    const newConsultation = new ConsultationForm(mappedData);
    const savedConsultation = await newConsultation.save();

    console.log("Consultation form saved successfully:", savedConsultation._id);

    // Create corresponding lead
    const leadData = {
      name: mappedData.name,
      email: mappedData.email,
      contact: mappedData.phone,
      lead_type: "ConsultationLead",
      description: `Project Type: ${mappedData.projectType}, Skills Required: ${mappedData.skillsRequired}, Project Duration: ${mappedData.projectDuration}, Engagement Type: ${mappedData.engagementType}, Budget: ${mappedData.budget}, Urgency: ${mappedData.urgency}, Company Name: ${mappedData.companyName}, Project Description: ${mappedData.projectDescription}`,
      service_interested_in: "Consultation Services",
      related_form_id: savedConsultation._id,
      form_model: "ConsultationForm",
    };

    const newLead = new Leads(leadData);
    const savedLead = await newLead.save();

    console.log("Lead created successfully:", savedLead._id);

    res.status(201).json({
      message: "Consultation form submitted and lead created successfully",
      submissionId: savedConsultation._id,
      leadId: savedLead._id,
      projectType: savedConsultation.projectType,
    });

    try {
      await sendConsultationEmail(formData);
    } catch (error) {
      console.error("Consultation form email sending failed:", error);
    }
  } catch (error) {
    console.error("Error submitting consultation form:", error);

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
      error: "Failed to submit consultation form",
      details: error.message,
    });
  }
};
const sendConsultationEmail = async (formData) => {
  try {
    // User email content
    const userContent = `
      <h2>Thank you for your IT Consultant Request!</h2>
      <p>We have received your project information and one of our IT experts will contact you shortly to discuss your requirements in detail.</p>

      <div class="info-box">
        <h3 style="color: #1e40af; margin-bottom: 15px;">Your Project Summary:</h3>
        <div class="info-item">
          <span class="info-label">Project Type:</span>
          <span class="info-value">${formData.projectType}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Skills Required:</span>
          <span class="info-value">${formData.skillsRequired}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Project Duration:</span>
          <span class="info-value">${formData.projectDuration}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Engagement Type:</span>
          <span class="info-value">${formData.engagementType}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Budget Range:</span>
          <span class="info-value">${formData.budget}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Project Description:</span>
          <span class="info-value">${formData.projectDescription}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Project Urgency:</span>
          <span class="info-value">${formData.urgency}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Company Name:</span>
          <span class="info-value">${formData.companyName}</span>
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
      </div>

      <p><strong>What Happens Next?</strong></p>
      <p>Our IT consultants will review your project requirements and contact you within 24 hours to discuss how we can best support your needs.</p>
    `;

    // Admin email content
    const adminContent = `
      <h2>New IT Consultant Request</h2>
      <p>A new IT consultant request has been received. Please review the project details below.</p>

      <div class="info-box">
        <div class="info-item">
          <span class="info-label">Project Type:</span>
          <span class="info-value">${formData.projectType}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Skills Required:</span>
          <span class="info-value">${formData.skillsRequired}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Project Duration:</span>
          <span class="info-value">${formData.projectDuration}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Engagement Type:</span>
          <span class="info-value">${formData.engagementType}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Budget Range:</span>
          <span class="info-value">${formData.budget}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Project Description:</span>
          <span class="info-value">${formData.projectDescription}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Project Urgency:</span>
          <span class="info-value">${formData.urgency}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Company Name:</span>
          <span class="info-value">${formData.companyName}</span>
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
  submitConsultantServicesForm,
};
