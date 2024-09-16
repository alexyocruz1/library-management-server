const Book = require('../models/Book');
const mongoose = require('mongoose'); // Add this line at the top of the file

const generateUniqueCode = async () => {
  // Implement a function to generate a unique code
  // For example, you could use a combination of timestamp and random string
  return `BOOK-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
};

exports.getAllBooks = async (req, res) => {
  try {
    const books = await Book.find();
    res.json({books});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getBookById = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.json(book);
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
      invoiceCode: req.body.invoiceCode, // Add this line
      imageUrl: req.body.imageUrl || '',
      condition: req.body.condition || 'good',
      categories: req.body.categories || [], // Handle multiple categories
      groupId,
    });
    const newBook = await book.save();
    res.status(201).json(newBook);
  } catch (err) {
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
  try {
    const originalBook = await Book.findById(req.params.id);
    if (!originalBook) {
      return res.status(404).json({ message: 'Book not found' });
    }

    const newBook = new Book({
      title: originalBook.title,
      author: originalBook.author,
      editorial: originalBook.editorial,
      edition: originalBook.edition,
      category: req.body.category || originalBook.category,
      coverType: req.body.coverType || originalBook.coverType,
      location: req.body.location || originalBook.location,
      cost: req.body.cost || originalBook.cost,
      dateAcquired: new Date(),
      status: 'available',
      observations: req.body.observations || '',
      imageUrl: req.body.imageUrl || originalBook.imageUrl,
      condition: req.body.condition || 'new',
      code: await generateUniqueCode(),
      groupId: originalBook.groupId,
    });

    const savedBook = await newBook.save();

    // Update copiesCount for all books in the group
    await Book.updateMany({ groupId: originalBook.groupId }, { $inc: { copiesCount: 1 } });

    res.status(201).json(savedBook);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.searchBooks = async (req, res) => {
  try {
    const { q } = req.query;
    console.log('Search query:', q);

    if (!q || q.trim() === '') {
      return res.json({ books: [] });
    }

    const searchRegex = new RegExp(q.trim(), 'i');

    const books = await Book.aggregate([
      {
        $match: {
          $or: [
            { title: searchRegex },
            { author: searchRegex },
            { code: searchRegex }
          ]
        }
      },
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
      {
        $limit: 10
      }
    ]);

    console.log('Search results:', books);

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

    if (book.copiesCount > 1) {
      // Decrease copiesCount for all books in the group
      await Book.updateMany({ groupId: book.groupId }, { $inc: { copiesCount: -1 } });
      const updatedBook = await Book.findById(req.params.id);
      res.status(200).json(updatedBook);
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