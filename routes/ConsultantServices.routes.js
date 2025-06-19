const express = require("express");
const router = express.Router();
const {
  submitConsultantServicesForm,
} = require("../controllers/consultant.controller");

router.post("/submit-consultant-form", submitConsultantServicesForm);

module.exports = router;
