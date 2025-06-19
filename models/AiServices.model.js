const mongoose = require("mongoose");
const aiServicesFormSchema = new mongoose.Schema(
  {
    businessType: {
      type: String,
      required: true,
      trim: true,
    },
    companySize: {
      type: String,
      required: true,
      trim: true,
    },
    currentChallenges: {
      type: String,
      required: true,
      trim: true,
    },
    automationGoals: {
      type: String,
      required: true,
      trim: true,
    },
    website: {
      type: String,
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
    preferredTime: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create models
const AiServicesForm = mongoose.model("AiServicesForm", aiServicesFormSchema);

module.exports = {
  AiServicesForm,
};
