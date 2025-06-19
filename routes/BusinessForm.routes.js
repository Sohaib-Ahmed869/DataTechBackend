const express = require("express");
const router = express.Router();
const { submitBusinessForm } = require("../controllers/business.controller");

router.post("/submit-form", submitBusinessForm);

module.exports = router;
