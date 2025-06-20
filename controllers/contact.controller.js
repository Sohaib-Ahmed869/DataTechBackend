const transporter = require("../config/emailConfig");
const createEmailTemplate = require("../utils/emailTemplate");

const ContactForm = require("../models/Contact.model"); // Adjust path as needed
const Leads = require("../models/Leads.model");
const NotificationService = require("../utils/notificationService");
const submitContactForm = async (req, res) => {
  try {
    const formData = req.body;
    console.log("Received contact form data:", formData);

    // The field names match directly between frontend and schema, so no mapping needed
    const contactData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      service: formData.service,
      privacyPolicy: formData.privacyPolicy,
    };

    // Validate required fields
    const requiredFields = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "service",
    ];
    const missingFields = requiredFields.filter(
      (field) =>
        !contactData[field] || contactData[field].toString().trim() === ""
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Missing required fields",
        missingFields: missingFields,
      });
    }

    // Validate privacy policy acceptance
    if (!contactData.privacyPolicy) {
      return res.status(400).json({
        error: "Privacy policy must be accepted",
        details: "Please accept the privacy policy to continue",
      });
    }

    // Create new form submission
    const newSubmission = new ContactForm(contactData);
    const savedSubmission = await newSubmission.save();

    console.log("Contact form saved successfully:", savedSubmission._id);

    // Create corresponding lead
    const leadData = {
      name: `${contactData.firstName} ${contactData.lastName}`,
      email: contactData.email,
      contact: contactData.phone,
      lead_type: "ContactUsLead",
      description: `Service Interested In: ${contactData.service}, Privacy Policy Accepted: ${contactData.privacyPolicy}`,
      related_form_id: savedSubmission._id,
      form_model: "ContactUsForm",
    };

    const newLead = new Leads(leadData);
    const savedLead = await newLead.save();
    try {
      await NotificationService.createNewLeadNotification(savedLead);
      console.log("Admin notification created for new lead:", savedLead._id);
    } catch (notificationError) {
      console.error("Error creating admin notification:", notificationError);
      // Don't fail the main operation if notification fails
    }
    console.log("Lead created successfully:", savedLead._id);

    res.status(201).json({
      message: "Contact form submitted and lead created successfully",
      submissionId: savedSubmission._id,
      leadId: savedLead._id,
    });

    try {
      sendContactFormEmail(formData);
    } catch (error) {
      console.error("Error sending contact form email:", error);
    }
  } catch (error) {
    console.error("Error submitting contact form:", error);

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
      error: "Failed to submit contact form",
      details: error.message,
    });
  }
};
const sendContactFormEmail = async (formData) => {
  try {
    // User email content
    const userContent = `
      <h2>Thank you for contacting DataTech!</h2>
      <p>We have received your message and one of our team members will contact you shortly to discuss your requirements.</p>
      
      <div class="info-box">
        <h3 style="color: #1e40af; margin-bottom: 15px;">Your Contact Information:</h3>
        <div class="info-item">
          <span class="info-label">Name:</span>
          <span class="info-value">${formData.firstName} ${formData.lastName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Email:</span>
          <span class="info-value">${formData.email}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Phone:</span>
          <span class="info-value">${formData.phone}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Service Interested In:</span>
          <span class="info-value">${formData.service}</span>
        </div>
  
      </div>
      
      <p><strong>We're Here to Help!</strong></p>
      <p>Our team will review your inquiry and get back to you within 24 hours with personalized solutions for your needs.</p>
    `;

    // Admin email content
    const adminContent = `
      <h2>New Contact Form Submission</h2>
      <p>A new contact form submission has been received from the website.</p>
      
      <div class="info-box">
        <div class="info-item">
          <span class="info-label">Name:</span>
          <span class="info-value">${formData.firstName} ${formData.lastName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Email:</span>
          <span class="info-value">${formData.email}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Phone:</span>
          <span class="info-value">${formData.phone}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Service Interested In:</span>
          <span class="info-value">${formData.service}</span>
        </div>
   
      </div>
    `;
    // Send user email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: formData.email,
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
  submitContactForm,
};
