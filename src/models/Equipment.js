const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true },
  description: { type: String, required: true },
  status: { type: String, default: 'available' },
  observations: { type: String, default: '' }
});

module.exports = mongoose.model('Equipment', equipmentSchema);