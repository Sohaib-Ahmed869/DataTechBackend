const mongoose = require("mongoose");

const ContactFormSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
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
    service: {
      type: String,
      required: true,
      trim: true,
    },
    privacyPolicy: {
      type: Boolean,
      required: true,
      default: false,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);
const ContactForm = mongoose.model("ContactUsForm", ContactFormSchema);

module.exports = ContactForm;
