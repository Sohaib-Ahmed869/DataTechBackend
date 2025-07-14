const Imap = require("imap");
const { simpleParser } = require("mailparser");
const nodemailer = require("nodemailer");
const Email = require("../models/Email.model");

// Email configuration
const emailAccounts = {
  info: {
    user: "info@data-tech.ae",
    password: "V1RkL]zM(iK.",
    host: "mail.data-tech.ae",
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  },
  sales: {
    user: "sales@data-tech.ae",
    password: "1hG&;9_=%7]R",
    host: "mail.data-tech.ae",
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  },
  idris: {
    user: "idris.muhammad@data-tech.ae",
    password: "&441LTr36d=A",
    host: "mail.data-tech.ae",
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  },
};

// Create SMTP transporter
const createSMTPTransporter = (account) => {
  return nodemailer.createTransport({
    host: "mail.data-tech.ae",
    port: 465,
    secure: true,
    auth: {
      user: emailAccounts[account].user,
      pass: emailAccounts[account].password,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

// Fetch emails from IMAP and sync with database
const syncEmailsFromIMAP = async (account, folder = "INBOX", limit = null) => {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      ...emailAccounts[account],
      keepalive: {
        interval: 10000,
        idleInterval: 300000,
        forceNoop: true,
      },
    });

    const emails = [];

    imap.once("ready", () => {
      console.log(`IMAP connection ready for ${account}`);

      imap.openBox("INBOX", false, (err, box) => {
        if (err) {
          console.error(`Error opening INBOX for ${account}:`, err);
          reject(err);
          return;
        }

        console.log(
          `Opened INBOX for ${account}, total messages: ${box.messages.total}`
        );

        // Search for ALL emails, including recent ones
        imap.search(["ALL"], (err, results) => {
          if (err) {
            console.error("Error searching emails:", err);
            reject(err);
            return;
          }

          if (results.length === 0) {
            console.log(`No emails found in INBOX for ${account}`);
            resolve([]);
            imap.end();
            return;
          }

          // Get the most recent emails first (last 100 or all if less)
          const recentResults = results.slice(-100).reverse();
          console.log(`Fetching ${recentResults.length} emails for ${account}`);

          const fetch = imap.fetch(recentResults, {
            bodies: "",
            struct: true,
            envelope: true,
          });

          let processedCount = 0;
          const totalToProcess = recentResults.length;

          fetch.on("message", (msg, seqno) => {
            const emailData = { seqno };

            msg.on("body", (stream, info) => {
              let buffer = "";
              stream.on("data", (chunk) => {
                buffer += chunk.toString("utf8");
              });

              stream.once("end", () => {
                simpleParser(buffer, (err, parsed) => {
                  if (!err) {
                    emailData.parsed = parsed;
                  } else {
                    console.error("Error parsing email:", err);
                  }
                });
              });
            });

            msg.once("attributes", (attrs) => {
              emailData.attrs = attrs;
            });

            msg.once("end", () => {
              emails.push(emailData);
              processedCount++;

              if (processedCount === totalToProcess) {
                processEmails();
              }
            });
          });

          fetch.once("error", (err) => {
            console.error("Fetch error:", err);
            reject(err);
          });

          async function processEmails() {
            try {
              console.log(`Processing ${emails.length} emails for ${account}`);

              const processedEmails = [];

              for (const email of emails) {
                try {
                  const parsed = email.parsed;
                  const attrs = email.attrs;

                  if (!parsed || !attrs) {
                    console.log("Skipping email due to missing data");
                    continue;
                  }

                  const emailDoc = {
                    uid: attrs.uid,
                    account,
                    from: parsed?.from?.text || "Unknown",
                    to: parsed?.to?.text || emailAccounts[account].user,
                    subject: parsed?.subject || "No Subject",
                    body: parsed?.text || parsed?.html || "No content",
                    html: parsed?.html || "",
                    date: parsed?.date || attrs.date || new Date(),
                    flags: attrs.flags || [],
                    isRead: attrs.flags
                      ? attrs.flags.includes("\\Seen")
                      : false,
                    isStarred: attrs.flags
                      ? attrs.flags.includes("\\Flagged")
                      : false,
                    hasAttachment: parsed?.attachments
                      ? parsed.attachments.length > 0
                      : false,
                    attachments:
                      parsed?.attachments?.map((att) => ({
                        filename: att.filename,
                        contentType: att.contentType,
                        size: att.size,
                        content: att.content,
                      })) || [],
                    folder: "INBOX",
                  };

                  // Check if email already exists
                  const existingEmail = await Email.findOne({
                    account,
                    uid: attrs.uid,
                  });

                  let savedEmail;
                  if (existingEmail) {
                    // Update existing email
                    savedEmail = await Email.findOneAndUpdate(
                      { account, uid: attrs.uid },
                      emailDoc,
                      { new: true }
                    );
                  } else {
                    // Create new email
                    savedEmail = await Email.create(emailDoc);
                  }

                  processedEmails.push(savedEmail);
                } catch (emailError) {
                  console.error(
                    "Error processing individual email:",
                    emailError
                  );
                }
              }

              console.log(
                `Successfully processed ${processedEmails.length} emails for ${account}`
              );
              resolve(processedEmails);
              imap.end();
            } catch (dbError) {
              console.error("Database error:", dbError);
              reject(dbError);
              imap.end();
            }
          }
        });
      });
    });

    imap.once("error", (err) => {
      console.error(`IMAP connection error for ${account}:`, err);
      reject(err);
    });

    imap.once("end", () => {
      console.log(`IMAP connection ended for ${account}`);
    });

    console.log(`Connecting to IMAP for ${account}...`);
    imap.connect();
  });
};

const emailController = {
  // Get emails for specific account and folder
  getEmails: async (req, res) => {
    try {
      const { account } = req.params;
      const { folder = "INBOX", sync = "true" } = req.query;

      console.log(`Getting emails for account: ${account}, folder: ${folder}`);

      if (!emailAccounts[account]) {
        return res.status(400).json({
          success: false,
          message: "Invalid email account",
        });
      }

      // Always sync INBOX to get latest emails
      if (folder === "INBOX") {
        console.log(`Force syncing INBOX for ${account}`);
        try {
          await syncEmailsFromIMAP(account, folder);
        } catch (syncError) {
          console.error("Sync error:", syncError);
          // Continue to fetch from database even if sync fails
        }
      }

      // Get emails from database
      const query = { account };

      if (folder === "STARRED") {
        query.isStarred = true;
      } else if (folder !== "INBOX") {
        query.folder = folder;
      } else {
        query.folder = "INBOX";
      }

      const emails = await Email.find(query).sort({ date: -1 });

      console.log(
        `Found ${emails.length} emails in database for ${account}/${folder}`
      );

      res.json({
        success: true,
        data: emails,
        account: emailAccounts[account].user,
        total: emails.length,
        folder: folder,
      });
    } catch (error) {
      console.error("Error fetching emails:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch emails",
        error: error.message,
      });
    }
  },

  // Send email and save to sent folder
  sendEmail: async (req, res) => {
    try {
      const { account } = req.params;
      const { to, subject, body, html } = req.body;

      console.log(`Sending email from account: ${account}`);

      if (!emailAccounts[account]) {
        return res.status(400).json({
          success: false,
          message: "Invalid email account",
        });
      }

      if (!to || !subject) {
        return res.status(400).json({
          success: false,
          message: "To and subject fields are required",
        });
      }

      const transporter = createSMTPTransporter(account);

      const mailOptions = {
        from: emailAccounts[account].user,
        to,
        subject,
        text: body,
        html: html || body,
      };

      const result = await transporter.sendMail(mailOptions);

      // Save sent email to database
      const sentEmail = new Email({
        uid: Date.now(), // Use timestamp as UID for sent emails
        account,
        from: emailAccounts[account].user,
        to,
        subject,
        body: body || "",
        html: html || body || "",
        date: new Date(),
        flags: ["\\Seen"],
        isRead: true,
        isStarred: false,
        hasAttachment: false,
        attachments: [],
        folder: "SENT",
      });

      await sentEmail.save();

      console.log("Email sent successfully:", result.messageId);

      res.json({
        success: true,
        message: "Email sent successfully",
        messageId: result.messageId,
      });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send email",
        error: error.message,
      });
    }
  },

  // Get available email accounts
  getAccounts: (req, res) => {
    try {
      const accounts = Object.keys(emailAccounts).map((key) => ({
        key,
        email: emailAccounts[key].user,
        name: key.charAt(0).toUpperCase() + key.slice(1),
      }));

      res.json({
        success: true,
        data: accounts,
      });
    } catch (error) {
      console.error("Error getting accounts:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get accounts",
        error: error.message,
      });
    }
  },

  // Mark email as read/unread
  markAsRead: async (req, res) => {
    try {
      const { account, id } = req.params;
      const { isRead = true } = req.body;

      const email = await Email.findOneAndUpdate(
        { _id: id, account },
        { isRead },
        { new: true }
      );

      if (!email) {
        return res.status(404).json({
          success: false,
          message: "Email not found",
        });
      }

      res.json({
        success: true,
        message: `Email marked as ${isRead ? "read" : "unread"}`,
        data: email,
      });
    } catch (error) {
      console.error("Error marking email as read:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update email status",
        error: error.message,
      });
    }
  },

  // Star/unstar email
  toggleStar: async (req, res) => {
    try {
      const { account, id } = req.params;

      const email = await Email.findOne({ _id: id, account });

      if (!email) {
        return res.status(404).json({
          success: false,
          message: "Email not found",
        });
      }

      email.isStarred = !email.isStarred;
      await email.save();

      res.json({
        success: true,
        message: `Email ${email.isStarred ? "starred" : "unstarred"}`,
        data: email,
      });
    } catch (error) {
      console.error("Error toggling star:", error);
      res.status(500).json({
        success: false,
        message: "Failed to toggle star",
        error: error.message,
      });
    }
  },

  // Move email to folder
  moveToFolder: async (req, res) => {
    try {
      const { account, id } = req.params;
      const { folder } = req.body;

      const email = await Email.findOneAndUpdate(
        { _id: id, account },
        { folder },
        { new: true }
      );

      if (!email) {
        return res.status(404).json({
          success: false,
          message: "Email not found",
        });
      }

      res.json({
        success: true,
        message: `Email moved to ${folder}`,
        data: email,
      });
    } catch (error) {
      console.error("Error moving email:", error);
      res.status(500).json({
        success: false,
        message: "Failed to move email",
        error: error.message,
      });
    }
  },

  // Sync emails manually
  syncEmails: async (req, res) => {
    try {
      const { account } = req.params;
      const { folder = "INBOX" } = req.query;

      console.log(
        `Manual sync requested for account: ${account}, folder: ${folder}`
      );

      if (!emailAccounts[account]) {
        return res.status(400).json({
          success: false,
          message: "Invalid email account",
        });
      }

      // Force sync from IMAP
      const emails = await syncEmailsFromIMAP(account, folder);

      // Get updated emails from database
      const updatedEmails = await Email.find({
        account,
        folder: folder === "STARRED" ? { $exists: true } : folder,
      }).sort({ date: -1 });

      res.json({
        success: true,
        message: "Emails synced successfully",
        data: updatedEmails,
        synced: emails.length,
        total: updatedEmails.length,
      });
    } catch (error) {
      console.error("Error syncing emails:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync emails",
        error: error.message,
      });
    }
  },

  // Delete email
  deleteEmail: async (req, res) => {
    try {
      const { account, id } = req.params;

      const email = await Email.findOneAndUpdate(
        { _id: id, account },
        { folder: "TRASH" },
        { new: true }
      );

      if (!email) {
        return res.status(404).json({
          success: false,
          message: "Email not found",
        });
      }

      res.json({
        success: true,
        message: "Email moved to trash",
        data: email,
      });
    } catch (error) {
      console.error("Error deleting email:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete email",
        error: error.message,
      });
    }
  },

  // Permanently delete email
  permanentDelete: async (req, res) => {
    try {
      const { account, id } = req.params;

      const email = await Email.findOneAndDelete({ _id: id, account });

      if (!email) {
        return res.status(404).json({
          success: false,
          message: "Email not found",
        });
      }

      res.json({
        success: true,
        message: "Email permanently deleted",
      });
    } catch (error) {
      console.error("Error permanently deleting email:", error);
      res.status(500).json({
        success: false,
        message: "Failed to permanently delete email",
        error: error.message,
      });
    }
  },

  // Search emails
  searchEmails: async (req, res) => {
    try {
      const { account } = req.params;
      const { q, limit = 50 } = req.query;

      if (!q) {
        return res.status(400).json({
          success: false,
          message: "Search query is required",
        });
      }

      const emails = await Email.find({
        account,
        $or: [
          { subject: { $regex: q, $options: "i" } },
          { from: { $regex: q, $options: "i" } },
          { body: { $regex: q, $options: "i" } },
        ],
      })
        .sort({ date: -1 })
        .limit(Number.parseInt(limit));

      res.json({
        success: true,
        data: emails,
        total: emails.length,
      });
    } catch (error) {
      console.error("Error searching emails:", error);
      res.status(500).json({
        success: false,
        message: "Failed to search emails",
        error: error.message,
      });
    }
  },

  // Get folder counts
  getFolderCounts: async (req, res) => {
    try {
      const { account } = req.params;

      if (!emailAccounts[account]) {
        return res.status(400).json({
          success: false,
          message: "Invalid email account",
        });
      }

      const counts = await Promise.all([
        Email.countDocuments({ account, folder: "INBOX", isRead: false }),
        Email.countDocuments({ account, folder: "SENT" }),
        Email.countDocuments({ account, folder: "DRAFTS" }),
        Email.countDocuments({ account, isStarred: true }),
        Email.countDocuments({ account, folder: "SPAM" }),
        Email.countDocuments({ account, folder: "ARCHIVE" }),
        Email.countDocuments({ account, folder: "TRASH" }),
      ]);

      const folderCounts = {
        inbox: counts[0],
        sent: counts[1],
        drafts: counts[2],
        starred: counts[3],
        spam: counts[4],
        archive: counts[5],
        trash: counts[6],
      };

      res.json({
        success: true,
        data: folderCounts,
      });
    } catch (error) {
      console.error("Error getting folder counts:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get folder counts",
        error: error.message,
      });
    }
  },
};

module.exports = emailController;
