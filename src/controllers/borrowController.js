const BorrowRecord = require('../models/BorrowRecord');
const Book = require('../models/Book');

exports.borrowBook = async (req, res) => {
  try {
    const { bookId, copyId, borrowerName, expectedReturnDate, comments, company } = req.body;

    // Find the main book first
    const mainBook = await Book.findById(bookId);
    if (!mainBook) {
      return res.status(404).json({ 
        success: false, 
        message: 'Book not found' 
      });
    }

    // Find the specific copy within the book's copies
    const bookCopy = await Book.findById(copyId);
    if (!bookCopy) {
      return res.status(404).json({ 
        success: false, 
        message: 'Book copy not found' 
      });
    }

    // Verify the copy is available
    if (bookCopy.status !== 'available') {
      return res.status(400).json({ 
        success: false, 
        message: 'Book copy is not available' 
      });
    }

    // Create borrow record
    const borrowRecord = new BorrowRecord({
      book: bookId,
      bookCopy: bookCopy.code,
      borrowerName,
      borrowDate: new Date(),
      expectedReturnDate,
      comments,
      company,
      borrowedBy: bookCopy._id
    });

    await borrowRecord.save();

    // Update the copy's status
    bookCopy.status = 'borrowed';
    await bookCopy.save();

    // Populate the borrow record with book details
    const populatedRecord = await BorrowRecord.findById(borrowRecord._id)
      .populate('book', 'title author');

    res.status(201).json({ 
      success: true, 
      borrowRecord: populatedRecord 
    });

  } catch (error) {
    console.error('Error in borrowBook:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error borrowing book'
    });
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
    
    await borrowRecord.save();

    // Populate the record before sending response
    const populatedRecord = await BorrowRecord.findById(borrowRecord._id)
      .populate('book', 'title author');

    res.json({ success: true, borrowRecord: populatedRecord });
  } catch (error) {
    console.error('Error in returnBook:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBorrowHistory = async (req, res) => {
  try {
    const { search, status, startDate, endDate } = req.query;
    let query = {};

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

    // Update overdue status for records and handle null users
    const updatedRecords = await Promise.all(records.map(async record => {
      if (new Date(record.expectedReturnDate) < new Date() && record.status === 'borrowed') {
        record.status = 'overdue';
        await record.save();
      }
      
      // Convert to plain object and handle null references
      const plainRecord = record.toObject();
      return {
        ...plainRecord,
        borrowedBy: plainRecord.borrowedBy || { username: 'Unknown' },
        returnedBy: plainRecord.returnedBy || { username: 'Unknown' }
      };
    }));

    res.json({ success: true, records: updatedRecords });
  } catch (error) {
    console.error('Error in getBorrowHistory:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getActiveBorrows = async (req, res) => {
  try {
    console.log('🔍 Starting getActiveBorrows...');
    
    // Log the query we're about to execute
    const query = {
      status: { $in: ['borrowed', 'overdue'] }
    };
    console.log('📝 Query:', JSON.stringify(query, null, 2));
    
    // First, let's count how many documents match our query
    const count = await BorrowRecord.countDocuments(query);
    console.log(`📊 Found ${count} matching documents before population`);
    
    const records = await BorrowRecord.find(query)
      .populate({
        path: 'book',
        select: 'title author'
      })
      .populate({
        path: 'borrowedBy',
        select: 'username'
      })
      .sort({ borrowDate: -1 });

    console.log('📚 Raw records found:', records.length);
    console.log('📖 First record (if exists):', records[0] ? {
      id: records[0]._id,
      book: records[0].book,
      borrowerName: records[0].borrowerName,
      status: records[0].status
    } : 'No records');

    // Update overdue status for records
    const updatedRecords = await Promise.all(records.map(async (record, index) => {
      const expectedDate = new Date(record.expectedReturnDate);
      const now = new Date();
      const isOverdue = expectedDate < now && record.status === 'borrowed';
      
      console.log(`📅 Record ${index + 1}:`, {
        id: record._id,
        expectedDate,
        now,
        currentStatus: record.status,
        isOverdue
      });

      if (isOverdue) {
        record.status = 'overdue';
        await record.save();
        console.log(`⚠️ Updated record ${record._id} to overdue`);
      }
      return record;
    }));

    // Prepare the response data
    const responseData = updatedRecords.map(record => ({
      _id: record._id,
      borrowerName: record.borrowerName,
      book: {
        _id: record.book?._id,
        title: record.book?.title || 'Unknown Book',
        author: record.book?.author
      },
      bookCopy: record.bookCopy,
      borrowDate: record.borrowDate,
      expectedReturnDate: record.expectedReturnDate,
      status: record.status,
      comments: record.comments
    }));

    console.log('✅ Sending response with records:', responseData.length);
    console.log('📦 Sample response data:', responseData[0] || 'No records');

    res.json({ 
      success: true, 
      records: responseData
    });
  } catch (error) {
    console.error('❌ Error in getActiveBorrows:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error fetching active borrows'
    });
  }
};

exports.getBorrowerNames = async (req, res) => {
  try {
    const records = await BorrowRecord.distinct('borrowerName');
    
    console.log('Found borrower names:', records);
    
    res.json({ 
      success: true, 
      borrowerNames: records || [] 
    });
  } catch (error) {
    console.error('Error in getBorrowerNames:', error);
    res.json({ 
      success: true, 
      borrowerNames: [] 
    });
  }
}; 