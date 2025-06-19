const express = require("express");
const router = express.Router();
const {
  submitGeneralInformationForm,
} = require("../controllers/GeneralInformationForm.controller");

router.post("/submit", submitGeneralInformationForm);

module.exports = router;
