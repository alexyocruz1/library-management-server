const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  invoiceCode: { type: String, required: true }, // Add this line
  code: { type: String, unique: true, required: true },
  title: { type: String, required: true },
  author: { type: String, required: true },
  editorial: { type: String, required: true },
  edition: { type: String, required: true },
  categories: [{ type: String, required: true }], // Changed from 'category' to 'categories'
  coverType: { type: String, required: true },
  location: { type: String, required: true },
  cost: { type: Number, required: true },
  dateAcquired: { type: Date, required: true },
  status: { type: String, default: 'available' },
  observations: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  copiesCount: { type: Number, default: 1 }, // Rename 'copies' to 'copiesCount'
  condition: { type: String, enum: ['good', 'regular', 'bad', 'new'], required: true },
  groupId: { type: String, required: true }, // Add this line
});

module.exports = mongoose.model('Book', bookSchema);