const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true },
  title: { type: String, required: true },
  author: { type: String, required: true },
  editorial: { type: String, required: true },
  edition: { type: String, required: true },
  category: { type: String, required: true },
  coverType: { type: String, required: true },
  location: { type: String, required: true },
  cost: { type: Number, required: true },
  dateAcquired: { type: Date, required: true },
  status: { type: String, default: 'available' },
  observations: { type: String, default: '' }
});

module.exports = mongoose.model('Book', bookSchema);