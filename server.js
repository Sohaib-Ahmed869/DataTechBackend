const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

// Import database connection
const {
  connectDB,
  setupConnectionListeners,
  setupGracefulShutdown,
} = require("./config/db");

const errorHandler = require("./middleware/errorHandler");
const AiServicesFormRoutes = require("./routes/AiServicesForm.routes");
const ConsultantServicesFormRoutes = require("./routes/ConsultantServices.routes");
const BusinessFormRoutes = require("./routes/BusinessForm.routes");
const taxRoutes = require("./routes/TaxServices.routes");
const ContactFormRoutes = require("./routes/contactForm.routes");
const GeneralInformationFormRoutes = require("./routes/GeneralInformationForm.routes");
const AuthRoutes = require("./routes/auth.routes");
const LeadsRoutes = require("./routes/leads.routes");
const UserRoutes = require("./routes/users.routes");
const AdminDashboardRoutes = require("./routes/DashboardStats.routes");
const NotificationRoutes = require("./routes/notification.routes");
const CustomerRoutes = require("./routes/customer.routes");
const QuotationRoutes = require("./routes/quotation.routes");
const TaskRoutes = require("./routes/task.routes");
const SalesOrderRoutes = require("./routes/salesOrder.routes");
const EmailRoutes = require("./routes/email.routes");
const ItemsRoutes = require("./routes/items.routes");
const BlogRoutes = require("./routes/blog.routes");
const app = express();
const port = process.env.PORT || 5001;

// Initialize database connection
const initializeDatabase = async () => {
  await connectDB();
  setupConnectionListeners();
  setupGracefulShutdown();
};

// Connect to MongoDB
initializeDatabase();

// CORS Configuration
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://halalfoodsales.s3-website.eu-north-1.amazonaws.com",
    "https://data-tech.ae",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(bodyParser.json());

// Routes
app.use("/api/AiServices", AiServicesFormRoutes);
app.use("/api/ConsultantServices", ConsultantServicesFormRoutes);
app.use("/api/TaxServices", taxRoutes);
app.use("/api/business", BusinessFormRoutes);
app.use("/api/contact", ContactFormRoutes);
app.use("/api/general", GeneralInformationFormRoutes);
app.use("/datatech/api/auth", AuthRoutes);
app.use("/datatech/api/leads", LeadsRoutes);
app.use("/datatech/api/users", UserRoutes);
app.use("/datatech/api/admin/dashboard", AdminDashboardRoutes);
app.use("/datatech/api/notifications", NotificationRoutes);
app.use("/datatech/api/customers", CustomerRoutes);
app.use("/datatech/api/quotations", QuotationRoutes);
app.use("/datatech/api/tasks", TaskRoutes);
app.use("/datatech/api/sales-orders", SalesOrderRoutes);
app.use("/datatech/api/emails", EmailRoutes);
app.use("/datatech/api/items", ItemsRoutes);
app.use("/datatech/api/blogs", BlogRoutes);

// Error handling middleware
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
