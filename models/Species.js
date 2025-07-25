const mongoose = require('mongoose');

const speciesSchema = new mongoose.Schema({
  nombre_comun:        { type: String, required: true },
  nombre_cientifico:   { type: String, required: true },
  familia:             { type: String, required: true },
  alimentacion:        { type: String },
  estado_conservacion: { type: String },
  imagen_url:          { type: String },
  enabled:             { type: Boolean, default: true }
}, {
  collection: 'especies'  // coincide con tu colección en MongoDB Atlas
});

module.exports = mongoose.model('Species', speciesSchema);
