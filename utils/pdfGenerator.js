const puppeteer = require("puppeteer");
const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");

// Load the HTML template for quotations
const templateSource = fs.readFileSync(
  path.join(__dirname, "./quotation-pdf-template.html"),
  "utf8"
);
const template = handlebars.compile(templateSource);

/**
 * Generate a PDF for a quotation
 * @param {Object} quotation - Quotation data
 * @param {Object} customer - Customer data (optional)
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateQuotationPDF(quotation, customer = null) {
  let browser = null;

  try {
    console.log("Starting PDF generation process...");

    // Format data for the template
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return `${date.getDate().toString().padStart(2, "0")}-${(
        date.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}-${date.getFullYear()}`;
    };

    // Calculate totals
    const subtotal = quotation.DocTotal || 0;
    const vat = subtotal * 0.21; // 21% VAT (adjust as needed)
    const totalTTC = subtotal + vat;

    console.log("Processing quotation data:", {
      DocEntry: quotation.DocEntry,
      DocNum: quotation.DocNum,
      CardName: quotation.CardName,
      DocTotal: quotation.DocTotal,
      hasDocumentLines: !!quotation.DocumentLines,
      linesCount: quotation.DocumentLines ? quotation.DocumentLines.length : 0,
    });

    // Prepare the data for the template
    const data = {
      quotation: {
        ...(quotation.toObject ? quotation.toObject() : quotation),
        formattedDocDate: formatDate(quotation.DocDate),
        formattedDocDueDate: formatDate(quotation.DocDueDate),
        subtotal: subtotal.toFixed(2),
        vat: vat.toFixed(2),
        totalTTC: totalTTC.toFixed(2),
        // Ensure DocumentLines is properly formatted
        DocumentLines: Array.isArray(quotation.DocumentLines)
          ? quotation.DocumentLines.map((line) => ({
              ...(line.toObject ? line.toObject() : line),
              Price: line.Price ? line.Price.toFixed(2) : "0.00",
              LineTotal: line.LineTotal ? line.LineTotal.toFixed(2) : "0.00",
            }))
          : [],
      },
      customer: customer || {
        CardName: quotation.CardName || "Valued Customer",
        street: "",
        city: "",
        zipCode: "",
        Country: "",
        Phone: "",
      },
      companyInfo: {
        name: "DataTech Solutions",
        address: "123 Business Avenue",
        city: "Tech City",
        zipCode: "12345",
        country: "Ireland",
        phone: "+353 1 234 5678",
        email: "info@datatech.ie",
        website: "www.datatech.ie",
        vatNumber: "IE1234567T",
        bankName: "Bank of Ireland",
        iban: "IE29 AIBK 9311 5212 3456 78",
        swift: "BOFIIE2D",
      },
      logoUrl:
        "https://bexbucket.s3.eu-north-1.amazonaws.com/datatechImage/DataTechFinal-06.png", // Blue placeholder logo
    };

    // Generate HTML from template
    let html = template(data);

    // For debugging - save the generated HTML to a file
    const debugHtmlPath = path.join(__dirname, "../temp-quotation.html");
    fs.writeFileSync(debugHtmlPath, html);
    console.log(`Generated HTML saved to ${debugHtmlPath}`);

    // Launch Puppeteer
    browser = await puppeteer.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
      headless: true,
    });

    const page = await browser.newPage();
    console.log("Browser launched successfully");

    // Set content with better error handling
    try {
      await page.setContent(html, {
        waitUntil: ["load", "domcontentloaded", "networkidle0"],
        timeout: 30000,
      });
      console.log("Content set successfully");
    } catch (contentError) {
      console.error("Error setting page content:", contentError);
      // throw new Error(`Failed to set page content: ${contentError.message}`);
    }

    // Wait for rendering
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("Waited for rendering completion");

    // Generate PDF with explicit settings
    console.log("Generating PDF...");
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "1cm",
        right: "1cm",
        bottom: "1cm",
        left: "1cm",
      },
      timeout: 30000,
    });

    console.log(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);

    // Validate the PDF buffer
    if (!pdfBuffer || pdfBuffer.length < 1000) {
      throw new Error("Generated PDF is too small or empty");
    }

    // Validate that it starts with PDF header
    const pdfHeader = pdfBuffer.slice(0, 4).toString();
    if (pdfHeader !== "%PDF") {
      console.warn("Warning: Generated buffer doesn't start with %PDF header!");
    }

    // Save a copy of the PDF for debugging
    const debugPdfPath = path.join(__dirname, "../temp-quotation.pdf");
    fs.writeFileSync(debugPdfPath, pdfBuffer);
    console.log(`PDF saved to ${debugPdfPath} for debugging`);

    if (browser) {
      await browser.close();
      console.log("Browser closed successfully");
    }

    return pdfBuffer;
  } catch (error) {
    console.error("Error during PDF generation:", error);

    // Ensure browser is closed even if an error occurs
    if (browser) {
      try {
        await browser.close();
        console.log("Browser closed after error");
      } catch (closeError) {
        console.error("Error closing browser:", closeError);
      }
    }

    throw new Error(`Failed to generate quotation PDF: ${error.message}`);
  }
}

module.exports = {
  generateQuotationPDF,
};
