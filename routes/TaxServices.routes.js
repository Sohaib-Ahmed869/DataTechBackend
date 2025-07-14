const express = require("express");
const { submitTaxServicesForm } = require("../controllers/tax.controller");
const router = express.Router();

// console.log("TaxServices.routes.js");

router.post("/submit-tax-form", submitTaxServicesForm);

module.exports = router;
