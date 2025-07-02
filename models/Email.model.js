const mongoose = require("mongoose");

const emailSchema = new mongoose.Schema(
  {
    uid: {
      type: Number,
      required: true,
    },
    account: {
      type: String,
      required: true,
    },
    from: {
      type: String,
      required: true,
    },
    to: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      default: "No Subject",
    },
    body: {
      type: String,
      default: "",
    },
    html: {
      type: String,
      default: "",
    },
    date: {
      type: Date,
      default: Date.now,
    },
    flags: [
      {
        type: String,
      },
    ],
    isRead: {
      type: Boolean,
      default: false,
    },
    isStarred: {
      type: Boolean,
      default: false,
    },
    hasAttachment: {
      type: Boolean,
      default: false,
    },
    attachments: [
      {
        filename: String,
        contentType: String,
        size: Number,
        content: Buffer,
      },
    ],
    folder: {
      type: String,
      default: "INBOX",
    },
  },
  {
    timestamps: true,
  }
);

// Create compound index for efficient queries
emailSchema.index({ account: 1, uid: 1 }, { unique: true });
emailSchema.index({ account: 1, folder: 1, date: -1 });

module.exports = mongoose.model("Email", emailSchema);
