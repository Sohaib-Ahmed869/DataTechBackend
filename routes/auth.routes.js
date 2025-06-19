const express = require("express");
const {
  login,
  register,
  registerAdmin,
  changeUserPassword,
  updateUserProfile,
} = require("../controllers/auth.controller");
const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.post("/registerAdmin", registerAdmin);
router.put("/updateProfile/:id", updateUserProfile);
router.put("/changePassword/:id", changeUserPassword);
module.exports = router;
