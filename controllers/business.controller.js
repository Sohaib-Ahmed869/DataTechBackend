const BusinessGrowthForm = require("../models/BusinessGrowth.model"); // Adjust path as needed
const transporter = require("../config/emailConfig");
const createEmailTemplate = require("../utils/emailTemplate");
const Leads = require("../models/Leads.model");
const NotificationService = require("../utils/notificationService");

// Separate email function
const sendBusinessFormEmails = async (formData) => {
  try {
    // User email content
    const userContent = `
      <h2>Thank you for your AI Services Consultation Request!</h2>
      <p>We have received your information and one of our experts will contact you shortly to discuss how we can help your business grow.</p>
      
      <div class="info-box">
        <h3 style="color: #1e40af; margin-bottom: 15px;">Your Submission Summary:</h3>
        <div class="info-item">
          <span class="info-label">Business Type:</span>
          <span class="info-value">${formData.businessType}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Country of Origin:</span>
          <span class="info-value">${formData.countryOfOrigin}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Number of Employees:</span>
          <span class="info-value">${formData.numberOfEmployees}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Annual Turnover:</span>
          <span class="info-value">${formData.turnoverLevel}</span>
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
      </div>
      
      <p><strong>Next Steps:</strong></p>
      <p>Our business growth specialists will analyze your requirements and reach out to you within 24 hours to discuss tailored AI solutions for your business.</p>
    `;

    // Admin email content
    const adminContent = `
      <h2>New AI Services Consultation Request</h2>
      <p>A new business growth consultation request has been received.</p>
      
      <div class="info-box">
        <div class="info-item">
          <span class="info-label">Business Type:</span>
          <span class="info-value">${formData.businessType}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Country of Origin:</span>
          <span class="info-value">${formData.countryOfOrigin}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Number of Employees:</span>
          <span class="info-value">${formData.numberOfEmployees}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Annual Turnover:</span>
          <span class="info-value">${formData.turnoverLevel}</span>
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

// Main controller function
const submitBusinessForm = async (req, res) => {
  try {
    const formData = req.body;
    console.log("Received business form data:", formData);

    // Map frontend field names to schema field names
    const mappedData = {
      businessType: formData.businessType,
      countryOfOrigin: formData.countryOfOrigin,
      numberOfEmployees: formData.numberOfEmployees,
      turnoverLevel: formData.turnoverLevel,
      website: formData.website,
      name: formData.contactName, // Frontend: contactName -> Schema: name
      email: formData.contactEmail, // Frontend: contactEmail -> Schema: email
      phone: formData.contactPhone, // Frontend: contactPhone -> Schema: phone
    };

    // Validate required fields
    const requiredFields = [
      "businessType",
      "countryOfOrigin",
      "numberOfEmployees",
      "turnoverLevel",
      "name",
      "email",
      "phone",
    ];
    const missingFields = requiredFields.filter((field) => !mappedData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Missing required fields",
        missingFields: missingFields,
      });
    }

    // Create new form submission
    const newSubmission = new BusinessGrowthForm(mappedData);
    const savedSubmission = await newSubmission.save();

    console.log("Business form saved successfully:", savedSubmission._id);

    // Create corresponding lead
    const leadData = {
      name: mappedData.name,
      email: mappedData.email,
      contact: mappedData.phone,
      lead_type: "BusinessGrowthLead",
      description: `Business Type: ${
        mappedData.businessType
      }, Country of Origin: ${
        mappedData.countryOfOrigin
      }, Number of Employees: ${
        mappedData.numberOfEmployees
      }, Turnover Level: ${mappedData.turnoverLevel}${
        mappedData.website ? `, Website: ${mappedData.website}` : ""
      }`,
      service_interested_in: "Business Growth Services",
      related_form_id: savedSubmission._id,
      form_model: "BusinessGrowthForm",
    };

    const newLead = new Leads(leadData);
    const savedLead = await newLead.save();

    console.log("Lead created successfully:", savedLead._id);
    try {
      await NotificationService.createNewLeadNotification(savedLead);
      console.log("Admin notification created for new lead:", savedLead._id);
    } catch (notificationError) {
      console.error("Error creating admin notification:", notificationError);
      // Don't fail the main operation if notification fails
    }
    res.status(201).json({
      message: "Business form submitted and lead created successfully",
      submissionId: savedSubmission._id,
      leadId: savedLead._id,
    });

    try {
      await sendBusinessFormEmails(formData);
    } catch (error) {
      console.error("Error sending business form emails:", error);
    }
  } catch (error) {
    console.error("Error submitting business form:", error);

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
      error: "Failed to submit business form",
      details: error.message,
    });
  }
};
module.exports = {
  submitBusinessForm,
};
