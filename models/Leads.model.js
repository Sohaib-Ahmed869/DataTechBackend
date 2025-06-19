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
    lead_status: {
      type: String,
      enum: ["New", "In Progress", "Closed"],
      default: "New",
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
  },
  {
    timestamps: true,
  }
);

const Leads = mongoose.model("Leads", LeadsSchema);

module.exports = Leads;
