const express = require('express');
const router = express.Router();
const borrowController = require('../controllers/borrowController');
const auth = require('../middleware/auth');

router.post('/borrow', auth, borrowController.borrowBook);
router.post('/return/:id', auth, borrowController.returnBook);
router.get('/history', auth, borrowController.getBorrowHistory);
router.get('/active', auth, borrowController.getActiveBorrows);
router.get('/borrower-names', auth, borrowController.getBorrowerNames);

module.exports = router; 