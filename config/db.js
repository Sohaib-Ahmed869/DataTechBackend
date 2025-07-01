const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      family: 4, // Force IPv4
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
// const mongoose = require("mongoose");

// const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URL, {
//       // Connection timeout options
//       serverSelectionTimeoutMS: 30000, // 30 seconds (default: 30000)
//       connectTimeoutMS: 30000, // 30 seconds (default: 30000)
//       socketTimeoutMS: 45000, // 45 seconds (default: 0, which means no timeout)

//       // Buffer timeout options
//       bufferCommands: false, // Disable mongoose buffering

//       // Additional reliability options
//       maxPoolSize: 10, // Maximum number of connections in the connection pool
//       minPoolSize: 1, // Minimum number of connections in the connection pool
//       maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity

//       // Heartbeat options
//       heartbeatFrequencyMS: 10000, // Send heartbeat every 10 seconds

//       // Retry options
//       retryWrites: true,
//       retryReads: true,
//     });

//     console.log("MongoDB connected successfully to dataTech database");
//   } catch (error) {
//     console.error("MongoDB connection error:", error);

//     // Optional: Retry connection after delay
//     console.log("Retrying connection in 5 seconds...");
//     setTimeout(() => {
//       connectDB();
//     }, 5000);
//   }
// };

// // MongoDB connection event listeners with better error handling
// const setupConnectionListeners = () => {
//   mongoose.connection.on("connected", () => {
//     console.log("Mongoose connected to MongoDB");
//   });

//   mongoose.connection.on("error", (err) => {
//     console.error("Mongoose connection error:", err);

//     // Handle specific timeout errors
//     if (err.name === "MongoNetworkError" || err.code === "ETIMEDOUT") {
//       console.log("Network timeout detected. This might be due to:");
//       console.log("1. Slow network connection");
//       console.log("2. MongoDB server overload");
//       console.log("3. Firewall/network configuration issues");
//       console.log("4. MongoDB Atlas IP whitelist restrictions");
//     }
//   });

//   mongoose.connection.on("disconnected", () => {
//     console.log("Mongoose disconnected");

//     // Optional: Attempt reconnection
//     console.log("Attempting to reconnect...");
//     setTimeout(() => {
//       connectDB();
//     }, 5000);
//   });

//   // Handle initial connection timeout
//   mongoose.connection.on("timeout", () => {
//     console.log("MongoDB connection timeout");
//   });

//   // Handle reconnection attempts
//   mongoose.connection.on("reconnected", () => {
//     console.log("MongoDB reconnected successfully");
//   });
// };

// // Enhanced graceful shutdown handler
// const setupGracefulShutdown = () => {
//   const gracefulShutdown = async (signal) => {
//     console.log(`Received ${signal}. Graceful shutdown initiated...`);
//     try {
//       await mongoose.connection.close();
//       console.log("MongoDB connection closed gracefully");
//       process.exit(0);
//     } catch (error) {
//       console.error("Error during MongoDB connection close:", error);
//       process.exit(1);
//     }
//   };

//   process.on("SIGINT", () => gracefulShutdown("SIGINT"));
//   process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

//   // Handle uncaught exceptions
//   process.on("uncaughtException", (err) => {
//     console.error("Uncaught Exception:", err);
//     gracefulShutdown("uncaughtException");
//   });

//   process.on("unhandledRejection", (reason, promise) => {
//     console.error("Unhandled Rejection at:", promise, "reason:", reason);
//     gracefulShutdown("unhandledRejection");
//   });
// };

// module.exports = {
//   connectDB,
//   setupConnectionListeners,
//   setupGracefulShutdown,
// };
