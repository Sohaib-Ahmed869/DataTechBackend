const mongoose = require("mongoose");
const taxServicesFormSchema = new mongoose.Schema(
  {
    businessType: {
      type: String,
      required: true,
      trim: true,
    },
    countryOfOrigin: {
      type: String,
      required: true,
      trim: true,
    },
    annualIncome: {
      type: String,
      required: true,
      trim: true,
    },
    currentTaxRate: {
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
  },
  {
    timestamps: true,
  }
);
const TaxServicesForm = mongoose.model(
  "TaxServicesForm",
  taxServicesFormSchema
);

module.exports = TaxServicesForm;
