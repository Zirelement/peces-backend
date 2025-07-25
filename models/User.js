const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ['admin', 'analista'], default: 'analista' }
}, {
  collection: 'usuarios'  // coincide con tu colección en Atlas
});

module.exports = mongoose.model('User', userSchema);
