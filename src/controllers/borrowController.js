const BorrowRecord = require('../models/BorrowRecord');
const Book = require('../models/Book');

exports.borrowBook = async (req, res) => {
  try {
    const { bookId, copyId, borrowerName, expectedReturnDate, comments } = req.body;

    // Find the specific copy and verify it's available
    const bookCopy = await Book.findById(copyId);
    if (!bookCopy) {
      return res.status(404).json({ success: false, message: 'Book copy not found' });
    }
    if (bookCopy.status !== 'available') {
      return res.status(400).json({ success: false, message: 'Book copy is not available' });
    }

    // Create borrow record
    const borrowRecord = new BorrowRecord({
      book: bookId,
      bookCopy: bookCopy.code,
      borrowerName,
      borrowDate: new Date(),
      expectedReturnDate,
      comments,
      company: req.user.company,
      borrowedBy: req.user._id
    });

    await borrowRecord.save();

    // Update specific copy status
    bookCopy.status = 'borrowed';
    await bookCopy.save();

    res.status(201).json({ success: true, borrowRecord });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.returnBook = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    const borrowRecord = await BorrowRecord.findById(id);
    if (!borrowRecord) {
      return res.status(404).json({ success: false, message: 'Borrow record not found' });
    }

    // Find the book copy and update its status
    const bookCopy = await Book.findOne({ code: borrowRecord.bookCopy });
    if (bookCopy) {
      bookCopy.status = 'available';
      await bookCopy.save();
    }

    // Update borrow record
    borrowRecord.returnDate = new Date();
    borrowRecord.status = 'returned';
    borrowRecord.comments = comments || borrowRecord.comments;
    borrowRecord.returnedBy = req.user._id;
    
    await borrowRecord.save();

    res.json({ success: true, borrowRecord });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBorrowHistory = async (req, res) => {
  try {
    const { search, status, startDate, endDate } = req.query;
    let query = { company: req.user.company };

    if (search) {
      query.$or = [
        { borrowerName: new RegExp(search, 'i') },
        { bookCopy: new RegExp(search, 'i') }
      ];
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (startDate && endDate) {
      query.borrowDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const records = await BorrowRecord.find(query)
      .populate('book', 'title author')
      .populate('borrowedBy', 'username')
      .populate('returnedBy', 'username')
      .sort({ borrowDate: -1 });

    // Update overdue status for records
    const updatedRecords = await Promise.all(records.map(async record => {
      if (new Date(record.expectedReturnDate) < new Date() && record.status === 'borrowed') {
        record.status = 'overdue';
        await record.save();
      }
      return record;
    }));

    res.json({ success: true, records: updatedRecords });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getActiveBorrows = async (req, res) => {
  try {
    const records = await BorrowRecord.find({
      company: req.user.company,
      status: 'borrowed'
    })
      .populate('book', 'title author')
      .populate('borrowedBy', 'username')
      .sort({ borrowDate: -1 });

    // Update overdue status for records
    const updatedRecords = await Promise.all(records.map(async record => {
      if (new Date(record.expectedReturnDate) < new Date() && record.status === 'borrowed') {
        record.status = 'overdue';
        await record.save();
      }
      return record;
    }));

    res.json({ success: true, records: updatedRecords });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBorrowerNames = async (req, res) => {
  try {
    const records = await BorrowRecord.find({ 
      company: req.user.company 
    }).distinct('borrowerName');
    
    res.json({ 
      success: true, 
      borrowerNames: records 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}; 