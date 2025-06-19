const express = require("express");
const { submitTaxServicesForm } = require("../controllers/tax.Controller");
const router = express.Router();

router.post("/submit-tax-form", submitTaxServicesForm);

module.exports = router;
