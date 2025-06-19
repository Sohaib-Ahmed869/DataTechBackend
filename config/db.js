const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected successfully to dataTech database");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

// MongoDB connection event listeners
const setupConnectionListeners = () => {
  mongoose.connection.on("connected", () => {
    console.log("Mongoose connected to MongoDB");
  });

  mongoose.connection.on("error", (err) => {
    console.error("Mongoose connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.log("Mongoose disconnected");
  });
};

// Graceful shutdown handler
const setupGracefulShutdown = () => {
  process.on("SIGINT", async () => {
    try {
      await mongoose.connection.close();
      console.log("MongoDB connection closed gracefully");
      process.exit(0);
    } catch (error) {
      console.error("Error during MongoDB connection close:", error);
      process.exit(1);
    }
  });

  process.on("SIGTERM", async () => {
    try {
      await mongoose.connection.close();
      console.log("MongoDB connection closed gracefully");
      process.exit(0);
    } catch (error) {
      console.error("Error during MongoDB connection close:", error);
      process.exit(1);
    }
  });
};

module.exports = {
  connectDB,
  setupConnectionListeners,
  setupGracefulShutdown,
};
