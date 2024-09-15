const Book = require('../models/Book');

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
    const book = new Book({
      ...req.body,
      code,
      imageUrl: req.body.imageUrl || '',
      copies: 1 // Set initial copies count
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
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Increment the copies count
    book.copies += 1;
    await book.save();

    res.status(200).json(book);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.searchBooks = async (req, res) => {
  try {
    const { q } = req.query;
    console.log('Search query:', q); // Log the search query

    if (!q || q.trim() === '') {
      return res.json({ books: [] });
    }

    const searchRegex = new RegExp(q.trim(), 'i');

    const books = await Book.find({ 
      $or: [
        { title: searchRegex },
        { author: searchRegex },
        { code: searchRegex }
      ]
    }).limit(10);

    console.log('Search results:', books); // Log the search results

    res.json({ books });
  } catch (err) {
    console.error('Error in searchBooks:', err); // Log any errors
    res.status(500).json({ message: err.message });
  }
};

exports.decreaseCopy = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    if (book.copies > 1) {
      book.copies -= 1;
      await book.save();
      res.status(200).json(book);
    } else {
      // If it's the last copy, you might want to delete the book entirely
      await Book.findByIdAndDelete(req.params.id);
      res.status(200).json({ message: 'Last copy removed, book deleted' });
    }
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};