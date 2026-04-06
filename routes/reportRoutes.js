const express = require('express');
const ReportController = require('../controllers/reportController');

const router = express.Router();

router.get('/orders', ReportController.generateOrdersReport);

module.exports = router;

