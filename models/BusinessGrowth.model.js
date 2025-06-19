const mongoose = require("mongoose");

const businessGrowthFormSchema = new mongoose.Schema(
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
    numberOfEmployees: {
      type: String,
      required: true,
      trim: true,
    },
    turnoverLevel: {
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
const BusinessGrowthForm = mongoose.model(
  "BusinessGrowthForm",
  businessGrowthFormSchema
);

module.exports = BusinessGrowthForm;
