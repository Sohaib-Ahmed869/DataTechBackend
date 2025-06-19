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
  origin: ["http://localhost:5173"],
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
// Error handling middleware
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
