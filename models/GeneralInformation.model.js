const mongoose = require("mongoose");

const generalInformationFormSchema = new mongoose.Schema(
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
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    countryOfOrigin: {
      type: String,
      required: true,
      trim: true,
    },
    businessType: {
      type: String,
      required: true,
      trim: true,
    },
    clientLocation: {
      type: String,
      required: true,
      trim: true,
    },
    currentTaxes: {
      type: String,
      required: true,
      trim: true,
    },
    travel: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    monthlyIncomeRange: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);
const GeneralInformationForm = mongoose.model(
  "GeneralInformationForm",
  generalInformationFormSchema
);

module.exports = GeneralInformationForm;
