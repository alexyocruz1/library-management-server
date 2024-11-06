const express = require('express');
const router = express.Router();
const borrowController = require('../controllers/borrowController');
const BorrowRecord = require('../models/BorrowRecord');

router.get('/test', async (req, res) => {
  try {
    const count = await BorrowRecord.countDocuments({});
    res.json({ 
      success: true, 
      message: 'Borrow routes working', 
      totalRecords: count 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

router.post('/borrow', borrowController.borrowBook);
router.post('/return/:id', borrowController.returnBook);
router.get('/history', borrowController.getBorrowHistory);
router.get('/active', borrowController.getActiveBorrows);
router.get('/borrower-names', borrowController.getBorrowerNames);

module.exports = router; 