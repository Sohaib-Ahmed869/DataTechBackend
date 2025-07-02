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
  return nodemailer.createTransporter({
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
const syncEmailsFromIMAP = async (account, folder = "INBOX", limit = 50) => {
  return new Promise((resolve, reject) => {
    const imap = new Imap(emailAccounts[account]);
    const emails = [];

    imap.once("ready", () => {
      imap.openBox(folder, true, (err, box) => {
        if (err) {
          console.error("Error opening mailbox:", err);
          reject(err);
          return;
        }

        imap.search(["ALL"], (err, results) => {
          if (err) {
            console.error("Error searching emails:", err);
            reject(err);
            return;
          }

          if (results.length === 0) {
            console.log("No emails found");
            resolve([]);
            imap.end();
            return;
          }

          const recentResults = results.slice(-limit);
          console.log(`Fetching ${recentResults.length} emails`);

          const fetch = imap.fetch(recentResults, {
            bodies: "",
            struct: true,
            envelope: true,
          });

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
            });
          });

          fetch.once("end", async () => {
            try {
              console.log(`Processing ${emails.length} emails`);
              const processedEmails = await Promise.all(
                emails.map(async (email) => {
                  try {
                    const parsed = email.parsed;
                    const attrs = email.attrs;

                    if (!parsed || !attrs) {
                      console.log("Skipping email due to missing data");
                      return null;
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
                      folder,
                    };

                    // Upsert email to database
                    const savedEmail = await Email.findOneAndUpdate(
                      { account, uid: attrs.uid },
                      emailDoc,
                      {
                        upsert: true,
                        new: true,
                      }
                    );

                    return savedEmail;
                  } catch (emailError) {
                    console.error(
                      "Error processing individual email:",
                      emailError
                    );
                    return null;
                  }
                })
              );

              // Filter out null results
              const validEmails = processedEmails.filter(
                (email) => email !== null
              );
              console.log(
                `Successfully processed ${validEmails.length} emails`
              );

              resolve(validEmails);
              imap.end();
            } catch (dbError) {
              console.error("Database error:", dbError);
              reject(dbError);
              imap.end();
            }
          });

          fetch.once("error", (err) => {
            console.error("Fetch error:", err);
            reject(err);
          });
        });
      });
    });

    imap.once("error", (err) => {
      console.error("IMAP connection error:", err);
      reject(err);
    });

    imap.connect();
  });
};

const emailController = {
  // Get emails for specific account
  getEmails: async (req, res) => {
    try {
      const { account } = req.params;
      const { folder = "INBOX", limit = 50, sync = false } = req.query;

      console.log(`Getting emails for account: ${account}, sync: ${sync}`);

      if (!emailAccounts[account]) {
        return res.status(400).json({
          success: false,
          message: "Invalid email account",
        });
      }

      // Sync with IMAP if requested
      if (sync === "true") {
        console.log("Syncing emails from IMAP...");
        try {
          await syncEmailsFromIMAP(account, folder, Number.parseInt(limit));
        } catch (syncError) {
          console.error("Sync error:", syncError);
          // Continue to fetch from database even if sync fails
        }
      }

      // Get emails from database
      const emails = await Email.find({ account, folder })
        .sort({ date: -1 })
        .limit(Number.parseInt(limit));

      console.log(`Found ${emails.length} emails in database`);

      res.json({
        success: true,
        data: emails,
        account: emailAccounts[account].user,
        total: emails.length,
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

  // Send email
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

  // Sync emails manually
  syncEmails: async (req, res) => {
    try {
      const { account } = req.params;
      const { folder = "INBOX", limit = 50 } = req.query;

      console.log(`Manual sync requested for account: ${account}`);

      if (!emailAccounts[account]) {
        return res.status(400).json({
          success: false,
          message: "Invalid email account",
        });
      }

      const emails = await syncEmailsFromIMAP(
        account,
        folder,
        Number.parseInt(limit)
      );

      res.json({
        success: true,
        message: "Emails synced successfully",
        data: emails,
        synced: emails.length,
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

      const email = await Email.findOneAndDelete({ _id: id, account });

      if (!email) {
        return res.status(404).json({
          success: false,
          message: "Email not found",
        });
      }

      res.json({
        success: true,
        message: "Email deleted successfully",
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
};

module.exports = emailController;
