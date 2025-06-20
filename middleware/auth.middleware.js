const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

// Environment variables should be properly set up
const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";

// Verify token middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({
      _id: decoded.userId,
      deactivated: false,
    });

    if (!user) {
      return res.status(401).json({ message: "User not found or deactivated" });
    }

    req.token = token;
    req.user = user;

    //console.log("User authenticated: ", user);
    next();
  } catch (error) {
    res
      .status(401)
      .json({ message: "Authentication failed", error: error.message });
  }
};

module.exports = {
  auth,
};
