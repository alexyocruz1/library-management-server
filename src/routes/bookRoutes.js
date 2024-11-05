const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');

// Define specific routes first
router.get('/search', bookController.searchBooks);
router.get('/categories', bookController.getAllCategories);

// Add this line near the top of the file
router.get('/companies', bookController.getAllCompanies);

// Add this new route
router.get('/group/:groupId', bookController.getBookByGroupId);

// Then define the more general routes
router.get('/', bookController.getAllBooks);
router.post('/', bookController.createBook);
router.get('/:id', bookController.getBookById);
router.put('/:id', bookController.updateBook);
router.delete('/:id', bookController.deleteBook);
router.post('/:id/copy', bookController.copyBook);
router.post('/:id/decrease-copy', bookController.decreaseCopy);

// Add these new routes
router.put('/:groupId/general', bookController.updateGeneralInfo);
router.put('/:id/copy', bookController.updateCopyInfo);

module.exports = router;
