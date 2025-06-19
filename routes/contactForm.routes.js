const express = require("express");
const router = express.Router();
const { submitContactForm } = require("../controllers/contact.controller");

router.post("/submit", submitContactForm);

module.exports = router;
