const User = require("../models/user.model");
const Leads = require("../models/Leads.model"); // Adjust path as needed

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Find user by email
    const user = await User.findOne({ email, deactivated: false });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    // Create token
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, {
      expiresIn: "8h",
    });

    // Return user data without password
    const userData = user.toObject();
    delete userData.password;

    res.json({
      message: "Login successful",
      token,
      user: userData,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
exports.registerAdmin = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !password || !role) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided" });
    }

    // Check if email already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role,
    });

    // Save user
    await newUser.save();

    // Return user data without password
    const userData = newUser.toObject();

    res.status(201).json({
      message: "User registered successfully",
      user: userData,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !password || !role) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided" });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role,
      // createdBy: req.user._id,
    });

    // Save user
    await newUser.save();

    // Return user data without password
    const userData = newUser.toObject();
    delete userData.password;

    res.status(201).json({
      message: "User registered successfully",
      user: userData,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, and email are required",
      });
    }

    // Check if user exists
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if email is being changed and if it's already taken by another user
    if (email !== existingUser.email) {
      const emailExists = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: id }, // Exclude current user
      });

      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "Email is already in use by another user",
        });
      }
    }

    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone ? phone.trim() : undefined,
      },
      {
        new: true, // Return updated document
        runValidators: true, // Run schema validations
      }
    ).select("-password"); // Exclude password from response

    // Check if the user's name has changed (firstName or lastName)
    const nameChanged =
      existingUser.firstName !== firstName.trim() ||
      existingUser.lastName !== lastName.trim();

    // If name changed, update assigned_agent_name in leads where this user is assigned
    if (nameChanged) {
      const newAgentName = `${firstName.trim()} ${lastName.trim()}`;

      // Update all leads that have this user as assigned agent
      const leadsUpdateResult = await Leads.updateMany(
        { assigned_agent_id: id }, // Find leads assigned to this user
        { assigned_agent_name: newAgentName }, // Update the agent name
        { runValidators: true }
      );

      // Log the update for debugging (optional)
      console.log(
        `Updated ${leadsUpdateResult.modifiedCount} leads with new agent name: ${newAgentName}`
      );
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    // Handle duplicate key error for email
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email is already in use",
      });
    }

    console.error("Error updating user profile:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
// Controller function to change user password
exports.changeUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    // Validate new password length
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long",
      });
    }

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Check if new password is same as current password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await User.findByIdAndUpdate(id, {
      password: hashedNewPassword,
    });

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
