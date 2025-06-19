const express = require("express");
const router = express.Router();
const { submitAIServicesForm } = require("../controllers/ai.controller");

router.post("/submit-ai-form", submitAIServicesForm);

module.exports = router;
