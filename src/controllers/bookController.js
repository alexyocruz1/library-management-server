const Book = require('../models/Book');
const mongoose = require('mongoose'); // Add this line at the top of the file

// Helper function to get copiesCount
const getBookCopiesCount = async (groupId) => {
  return await Book.countDocuments({ groupId });
};

const generateUniqueCode = async () => {
  let code;
  let isUnique = false;
  while (!isUnique) {
    const randomPart = Math.random().toString(36).substr(2, 5).toUpperCase();
    code = `${randomPart}-HAYE`;
    const existingBook = await Book.findOne({ code });
    if (!existingBook) {
      isUnique = true;
    }
  }
  return code;
};

exports.getAllBooks = async (req, res) => {
  try {
    const { page = 1, search = '', categories = '', company } = req.query;
    const limit = 12;
    const skip = (page - 1) * limit;

    const searchRegex = new RegExp(search, 'i');
    const categoryArray = categories.split(',').filter(Boolean);

    const matchCriteria = {
      $and: [
        {
          $or: [
            { title: searchRegex },
            { author: searchRegex },
            { code: searchRegex }
          ]
        },
        categoryArray.length > 0 ? { categories: { $in: categoryArray } } : {},
        company ? { company } : {}
      ]
    };

    const books = await Book.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: '$groupId',
          book: { $first: '$$ROOT' },
          copiesCount: { $sum: 1 }
        }
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ['$book', { copiesCount: '$copiesCount' }]
          }
        }
      },
      { $sort: { title: 1 } },
      {
        $facet: {
          metadata: [{ $count: 'total' }, { $addFields: { page: parseInt(page) } }],
          data: [{ $skip: skip }, { $limit: limit }]
        }
      }
    ]);

    const { metadata, data } = books[0];
    const totalBooks = metadata[0]?.total || 0;
    const totalPages = Math.ceil(totalBooks / limit);

    res.json({
      books: data,
      currentPage: parseInt(page),
      totalPages,
      totalBooks
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getBookById = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    
    // Fetch all copies of the book and get the count
    const copies = await Book.find({ groupId: book.groupId });
    const copiesCount = copies.length;
    
    // Combine the book details with its copies and copiesCount
    const bookWithCopies = {
      ...book.toObject(),
      copies: copies.map(copy => ({
        _id: copy._id,
        invoiceCode: copy.invoiceCode,
        code: copy.code,
        location: copy.location,
        cost: copy.cost,
        dateAcquired: copy.dateAcquired,
        status: copy.status,
        condition: copy.condition,
        observations: copy.observations
      })),
      copiesCount: copiesCount
    };
    
    res.json(bookWithCopies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createBook = async (req, res) => {
  try {
    const code = await generateUniqueCode();
    const groupId = new mongoose.Types.ObjectId().toString();
    const book = new Book({
      ...req.body,
      code,
      invoiceCode: req.body.invoiceCode,
      imageUrl: req.body.imageUrl || '',
      condition: req.body.condition || 'good',
      categories: req.body.categories || [], // Ensure categories are included
      coverType: ['hard', 'soft'].includes(req.body.coverType) ? req.body.coverType : 'soft',
      cost: parseFloat(parseFloat(req.body.cost).toFixed(2)),
      groupId,
      company: req.body.company,
      copiesCount: 1
    });
    const newBook = await book.save();
    res.status(201).json(newBook);
  } catch (err) {
    console.error('Error creating book:', err);
    res.status(400).json({ message: err.message });
  }
};

exports.updateBook = async (req, res) => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.json(book);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteBook = async (req, res) => {
  try {
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.json({ message: 'Book deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.copyBook = async (req, res) => {
  console.log('Starting copyBook function');
  try {
    const originalBook = await Book.findById(req.params.id);
    if (!originalBook) {
      console.log('Original book not found');
      return res.status(404).json({ message: 'Book not found' });
    }
    console.log('Original book found:', originalBook);

    const newBook = new Book({
      invoiceCode: req.body.invoiceCode || originalBook.invoiceCode,
      title: originalBook.title,
      author: originalBook.author,
      editorial: originalBook.editorial,
      edition: originalBook.edition,
      categories: req.body.categories || originalBook.categories,
      coverType: ['hard', 'soft'].includes(req.body.coverType) ? req.body.coverType : originalBook.coverType,
      location: req.body.location || originalBook.location,
      cost: parseFloat(parseFloat(req.body.cost || originalBook.cost).toFixed(2)),
      dateAcquired: new Date(),
      status: 'available',
      observations: req.body.observations || '',
      imageUrl: req.body.imageUrl || originalBook.imageUrl,
      condition: req.body.condition || 'good',
      code: await generateUniqueCode(),
      company: req.body.company,
      groupId: originalBook.groupId
    });

    console.log('New book object created:', newBook);

    const savedBook = await newBook.save();
    console.log('New book saved:', savedBook);

    // Get the updated copiesCount
    const updatedCopiesCount = await Book.countDocuments({ groupId: originalBook.groupId });
    console.log('Updated copies count:', updatedCopiesCount);

    // Update copiesCount for all books in the group
    await Book.updateMany(
      { groupId: originalBook.groupId },
      { $set: { copiesCount: updatedCopiesCount } }
    );

    // Include the updated copiesCount in the response
    const responseData = {
      ...savedBook.toObject(),
      copiesCount: updatedCopiesCount
    };
    console.log('Response data:', responseData);

    res.status(201).json(responseData);
  } catch (err) {
    console.error('Error copying book:', err);
    res.status(400).json({ message: err.message });
  }
};

exports.searchBooks = async (req, res) => {
  try {
    const { q, company } = req.query;
    console.log('Search query:', q);
    console.log('Company:', company);

    if (!q || q.trim() === '') {
      return res.json({ books: [] });
    }

    const searchRegex = new RegExp(q.trim(), 'i');

    const matchCriteria = {
      $and: [
        {
          $or: [
            { title: searchRegex },
            { author: searchRegex },
            { code: searchRegex }
          ]
        },
        { company: company }
      ]
    };

    const books = await Book.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: '$groupId',
          book: { $first: '$$ROOT' },
        }
      },
      {
        $lookup: {
          from: 'books',
          let: { groupId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$groupId', '$$groupId'] } } },
            { $count: 'count' }
          ],
          as: 'copiesCount'
        }
      },
      {
        $addFields: {
          copiesCount: { $arrayElemAt: ['$copiesCount.count', 0] }
        }
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ['$book', { copiesCount: '$copiesCount' }]
          }
        }
      },
      {
        $limit: 10
      }
    ]);

    console.log('Search results:', JSON.stringify(books, null, 2));

    res.json({ books });
  } catch (err) {
    console.error('Error in searchBooks:', err);
    res.status(500).json({ message: err.message });
  }
};

exports.decreaseCopy = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    const copiesCount = await Book.countDocuments({ groupId: book.groupId });

    if (copiesCount > 1) {
      // Remove this specific copy
      await Book.findByIdAndDelete(req.params.id);

      // Update copiesCount for remaining books in the group
      const updatedCopiesCount = copiesCount - 1;
      await Book.updateMany({ groupId: book.groupId }, { $set: { copiesCount: updatedCopiesCount } });

      res.status(200).json({ message: 'Copy removed', copiesCount: updatedCopiesCount });
    } else {
      // If it's the last copy, delete all books with the same groupId
      await Book.deleteMany({ groupId: book.groupId });
      res.status(200).json({ message: 'Last copy removed, all related books deleted' });
    }
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Book.distinct('categories');
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add a new function to get all companies
exports.getAllCompanies = async (req, res) => {
  try {
    const companies = await Book.distinct('company');
    res.json({ companies });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};