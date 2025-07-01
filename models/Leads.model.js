const mongoose = require("mongoose");

const LeadsSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    contact: {
      type: String,
      required: true,
      trim: true,
    },
    lead_type: {
      type: String,
      enum: [
        "BusinessGrowthLead",
        "GeneralLead",
        "ConsultationLead",
        "AiServicesLead",
        "TaxServicesLead",
        "ContactUsLead",
      ],
      required: true,
    },
    // Updated status enum to match task system
    lead_status: {
      type: String,
      enum: ["pending", "awaiting_approval", "approved", "rejected"],
      default: "pending",
    },
    lead_remarks: {
      type: String,
      enum: ["Successful", "Unsuccessful"],
    },
    description: {
      type: String,
      trim: true,
    },
    service_interested_in: {
      type: String,
      trim: true,
    },
    assigned_agent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    assigned_agent_name: {
      type: String,
      required: false,
      default: "unassigned",
    },
    related_form_id: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "form_model",
    },
    form_model: {
      type: String,
      enum: [
        "AiServicesForm",
        "BusinessGrowthForm",
        "ConsultationForm",
        "ContactUsForm",
        "GeneralInformationForm",
        "TaxServicesForm",
      ],
    },
    customer_created: {
      type: Boolean,
      default: false,
    },
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

const Leads = mongoose.model("Leads", LeadsSchema);

module.exports = Leads;
