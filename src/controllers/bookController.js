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
    
    // Require company parameter
    if (!company) {
      return res.status(400).json({ message: 'Company parameter is required' });
    }

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
        { company } // Always include company filter
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
    console.error('Error in getAllBooks:', err);
    res.status(500).json({ message: err.message });
  }
};

exports.getBookById = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Get all copies of the book using groupId
    const copies = await Book.find({ groupId: book.groupId }).lean();
    
    // Get the total count
    const copiesCount = copies.length;

    // Create the response object with all necessary fields
    const bookResponse = {
      _id: book._id,
      title: book.title,
      author: book.author,
      editorial: book.editorial,
      edition: book.edition,
      categories: book.categories,
      coverType: book.coverType,
      imageUrl: book.imageUrl,
      status: book.status,
      condition: book.condition,
      location: book.location,
      company: book.company,
      code: book.code,
      cost: book.cost,
      dateAcquired: book.dateAcquired,
      observations: book.observations,
      description: book.description,
      invoiceCode: book.invoiceCode,
      groupId: book.groupId,
      copies: copies,
      copiesCount: copiesCount
    };

    res.json(bookResponse);
  } catch (err) {
    console.error('Error in getBookById:', err);
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
      company: req.body.company, // Ensure this line is present
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
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });

    // Delete all copies of the book
    await Book.deleteMany({ groupId: book.groupId });

    res.json({ message: 'Book and all its copies deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.copyBook = async (req, res) => {
  try {
    const originalBook = await Book.findById(req.params.id);
    if (!originalBook) {
      return res.status(404).json({ message: 'Book not found' });
    }

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

    const savedBook = await newBook.save();

    // Get the updated copiesCount
    const updatedCopiesCount = await Book.countDocuments({ groupId: originalBook.groupId });

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

    res.status(201).json(responseData);
  } catch (err) {
    console.error('Error copying book:', err);
    res.status(400).json({ message: err.message });
  }
};

exports.searchBooks = async (req, res) => {
  try {
    const { q, company } = req.query;

    if (!q || q.trim() === '') {
      return res.json({ books: [] });
    }

    const searchRegex = new RegExp(q.trim(), 'i');

    const books = await Book.aggregate([
      {
        $match: {
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
        }
      },
      {
        $group: {
          _id: '$groupId',
          book: { $first: '$$ROOT' },
          availableCopies: {
            $push: {
              $cond: [
                { $eq: ['$status', 'available'] },
                {
                  _id: '$_id',
                  code: '$code',
                  condition: '$condition'
                },
                null
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: '$book._id',
          title: '$book.title',
          author: '$book.author',
          editorial: '$book.editorial',
          edition: '$book.edition',
          categories: '$book.categories',
          coverType: '$book.coverType',
          imageUrl: '$book.imageUrl',
          status: '$book.status',
          condition: '$book.condition',
          location: '$book.location',
          company: '$book.company',
          code: '$book.code',
          groupId: '$book.groupId',
          availableCopies: {
            $filter: {
              input: '$availableCopies',
              as: 'copy',
              cond: { $ne: ['$$copy', null] }
            }
          }
        }
      }
    ]);

    res.json({ books });
  } catch (err) {
    console.error('Error in searchBooks:', err);
    res.status(500).json({ message: err.message });
  }
};

exports.decreaseCopy = async (req, res) => {
  try {
    const { id } = req.params;
    const { copyId } = req.body;

    // First find the book to get the groupId
    const book = await Book.findById(id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    const groupId = book.groupId;

    // Get total copies before deletion
    const totalCopies = await Book.countDocuments({ groupId });

    if (totalCopies === 1) {
      // If this is the last copy, delete the entire group
      await Book.deleteMany({ groupId });
      return res.status(200).json({ 
        message: 'Last copy removed, all related books deleted',
        copiesCount: 0
      });
    }

    // Delete the specific copy
    const deletedCopy = await Book.findByIdAndDelete(copyId);
    if (!deletedCopy) {
      return res.status(404).json({ message: 'Copy not found' });
    }

    // Get remaining copies
    const remainingCopies = await Book.find({ groupId }).lean();
    const updatedCopiesCount = remainingCopies.length;

    // Update copiesCount for all remaining copies
    await Book.updateMany(
      { groupId },
      { $set: { copiesCount: updatedCopiesCount } }
    );

    // Get the first remaining copy as the main book
    const mainBook = remainingCopies[0];
    if (!mainBook) {
      return res.status(404).json({ message: 'No remaining copies found' });
    }

    // Return the updated book data
    return res.status(200).json({
      message: 'Copy removed successfully',
      book: {
        ...mainBook,
        copies: remainingCopies,
        copiesCount: updatedCopiesCount
      }
    });
  } catch (err) {
    console.error('Error in decreaseCopy:', err);
    return res.status(500).json({ message: err.message });
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

exports.getBookByGroupId = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    // Get all copies with this groupId
    const copies = await Book.find({ groupId }).lean();
    
    if (!copies || copies.length === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Use the first copy as the main book data
    const mainBook = copies[0];
    const copiesCount = copies.length;

    // Create the response object
    const bookResponse = {
      _id: mainBook._id,
      title: mainBook.title,
      author: mainBook.author,
      editorial: mainBook.editorial,
      edition: mainBook.edition,
      categories: mainBook.categories,
      coverType: mainBook.coverType,
      imageUrl: mainBook.imageUrl,
      status: mainBook.status,
      condition: mainBook.condition,
      location: mainBook.location,
      company: mainBook.company,
      code: mainBook.code,
      cost: mainBook.cost,
      dateAcquired: mainBook.dateAcquired,
      observations: mainBook.observations,
      description: mainBook.description,
      invoiceCode: mainBook.invoiceCode,
      groupId: mainBook.groupId,
      copies: copies,
      copiesCount: copiesCount
    };

    res.json(bookResponse);
  } catch (err) {
    console.error('Error in getBookByGroupId:', err);
    res.status(500).json({ message: err.message });
  }
};

// Update general book information
exports.updateGeneralInfo = async (req, res) => {
  try {
    const { groupId } = req.params;
    const updateData = req.body;

    // Update all books with the same groupId
    const updatedBooks = await Book.updateMany(
      { groupId },
      { $set: updateData }
    );

    // Get the updated book data
    const updatedBook = await Book.findOne({ groupId });
    
    res.json(updatedBook);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update specific copy information
exports.updateCopyInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updatedBook = await Book.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    res.json(updatedBook);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
