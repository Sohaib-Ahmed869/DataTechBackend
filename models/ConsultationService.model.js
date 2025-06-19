const mongoose = require("mongoose");

const consultationFormSchema = new mongoose.Schema(
  {
    projectType: {
      type: String,
      required: true,
      trim: true,
    },
    skillsRequired: {
      type: String,
      required: true,
      trim: true,
    },
    projectDuration: {
      type: String,
      required: true,
      trim: true,
    },
    engagementType: {
      type: String,
      required: true,
      trim: true,
    },
    budget: {
      type: String,
      required: true,
      trim: true,
    },
    projectDescription: {
      type: String,
      required: true,
      trim: true,
    },
    urgency: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);
const ConsultationForm = mongoose.model(
  "ConsultationForm",
  consultationFormSchema
);

module.exports = ConsultationForm;
