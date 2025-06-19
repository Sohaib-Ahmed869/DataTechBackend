const createEmailTemplate = (title, content, isUserEmail = true) => {
  const headerColor = isUserEmail ? '#0f172a' : '#0f172a';
  const accentColor = isUserEmail ? '#0891b2' : '#0891b2';
  const lightAccent = '#06b6d4';
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f8fafc;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          padding: 0;
          text-align: center;
          overflow: hidden;
        }
        .header-image {
          width: 100%;
          height: auto;
          display: block;
          margin: 0;
        }
        .content {
          padding: 30px;
        }
        .content h2 {
          color: ${headerColor};
          font-size: 24px;
          margin-bottom: 20px;
          border-bottom: 3px solid ${lightAccent};
          padding-bottom: 10px;
          position: relative;
        }
        .content h2::after {
          content: '';
          position: absolute;
          bottom: -3px;
          left: 0;
          width: 50px;
          height: 3px;
          background: ${accentColor};
        }
        .content p {
          margin-bottom: 15px;
          font-size: 16px;
          color: #475569;
        }
        .info-box {
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
          border-left: 4px solid ${accentColor};
          padding: 20px;
          margin: 20px 0;
          border-radius: 0 8px 8px 0;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        .info-item {
          display: flex;
          margin-bottom: 12px;
          align-items: flex-start;
        }
        .info-item:last-child {
          margin-bottom: 0;
        }
        .info-label {
          font-weight: 600;
          color: ${headerColor};
          min-width: 140px;
          margin-right: 10px;
        }
        .info-value {
          color: #64748b;
          flex: 1;
        }
        .footer {
          background: linear-gradient(135deg, ${headerColor} 0%, #1e293b 100%);
          color: white;
          padding: 30px 20px;
          text-align: left;
        }
        .footer-content {
          margin-bottom: 20px;
        }
        .footer h3 {
          color: ${lightAccent};
          font-size: 24px;
          margin-bottom: 15px;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          text-align: center;
        }
        .contact-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          color: #e2e8f0;
          margin-bottom: 8px;
        }
        .contact-item .info-label {
          font-weight: 600;
          min-width: 70px;
          color: ${lightAccent};
        }
        .contact-item .info-value {
          color: #cbd5e1;
        }
        .contact-icon {
          width: 16px;
          height: 16px;
          fill: ${accentColor};
        }
        .footer-links {
          margin-bottom: 20px;
          text-align: center;
        }
        .footer-links a {
          color: ${lightAccent};
          text-decoration: none;
          margin: 0 10px;
          padding: 8px 16px;
          border: 1px solid ${accentColor};
          border-radius: 4px;
          transition: all 0.3s ease;
        }
        .footer-links a:hover {
          background-color: ${accentColor};
          color: white;
          text-decoration: none;
        }
        .copyright {
          font-size: 14px;
          color: #94a3b8;
          border-top: 1px solid #334155;
          padding-top: 20px;
          text-align: center;
        }
        @media (max-width: 600px) {
          .container {
            margin: 0;
            box-shadow: none;
          }
          .header {
            padding: 0;
          }
          .header-image {
            width: 100%;
          }
          .content {
            padding: 20px 15px;
          }
          .contact-item {
            flex-direction: column;
            gap: 4px;
          }
          .contact-item .info-label {
            min-width: auto;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://maryamhasabucket.s3.ap-southeast-2.amazonaws.com/header.png" alt="DataTech Logo" class="header-image">
        </div>
        
        <div class="content">
          ${content}
        </div>
        
        <div class="footer">
          <div class="footer-content">
            <h3>DataTech</h3>
            <div class="contact-info">
              <div class="contact-item">
                <span class="info-label">Phone:</span>
                <span class="info-value">+971 58 5114267</span>
              </div>
              <div class="contact-item">
                <span class="info-label">Email:</span>
                <span class="info-value">info@data-tech.ae</span>
              </div>
              <div class="contact-item">
                <span class="info-label">Location:</span>
                <span class="info-value">Dubai, UAE</span>
              </div>
            </div>
            <div class="footer-links">
              <a href="https://data-tech.ae/">Visit Our Website</a>
            </div>
          </div>
          <div class="copyright">
            Copyright © 2025 DataTech. All rights reserved.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = createEmailTemplate; 