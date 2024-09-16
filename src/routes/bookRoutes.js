const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');

// Define the search route first
router.get('/search', bookController.searchBooks);

// Other routes
router.get('/', bookController.getAllBooks);
router.post('/', bookController.createBook);
router.get('/:id', bookController.getBookById);
router.put('/:id', bookController.updateBook);
router.delete('/:id', bookController.deleteBook);
router.post('/:id/copy', bookController.copyBook);
router.post('/:id/decrease-copy', bookController.decreaseCopy);
router.get('/categories', bookController.getAllCategories);

module.exports = router;