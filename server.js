const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// 1) CORS y JSON
app.use(cors());
// Servir el contenido estático de public/
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());
// --- NUEVA LÍNEA: sirve los archivos de public/ ---
app.use(express.static(path.join(__dirname, 'public')));
// sirve las imágenes subidas
app.use('/images', express.static(path.join(__dirname, 'images')));

// 2) Servir estáticos (tu front) desde /public
app.use(express.static(path.join(__dirname, 'public')));

// 3) Conexión a MongoDB
mongoose.connect('mongodb://localhost:27017/pecesPeruanos', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// 4) Modelo
const especieSchema = new mongoose.Schema({
  nombre_comun: String,
  nombre_cientifico: String,
  familia: String,
  longitud_promedio_cm: Number,
  habitat: String,
  alimentacion: String,
  estado_conservacion: String,
  imagen_url: String
});
const Especie = mongoose.model('Especie', especieSchema);

// 5) Multer para uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'public/images');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const name = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, name);
  }
});
const upload = multer({ storage });

// 6) Rutas de API
// GET all
app.get('/especies', async (req, res) => {
  const especies = await Especie.find();
  res.json(especies);
});

// POST (sin imagen) — lo dejamos si lo necesitas
app.post('/especies', async (req, res) => {
  try {
    const e = new Especie(req.body);
    await e.save();
    res.status(201).json({ mensaje: 'Pez agregado correctamente' });
  } catch(err) {
    res.status(400).json({ error: 'No se pudo agregar la especie' });
  }
});

// POST con imagen
app.post('/especies-con-imagen', upload.single('imagen'), async (req, res) => {
  try {
    const { nombre_comun, nombre_cientifico, familia, alimentacion, estado_conservacion } = req.body;
    const e = new Especie({
      nombre_comun, nombre_cientifico, familia,
      alimentacion, estado_conservacion,
      imagen_url: req.file.filename
    });
    await e.save();
    res.status(201).json({ mensaje: 'Especie agregada con imagen correctamente' });
  } catch(err) {
    res.status(500).json({ error: 'Error al guardar la especie', detalles: err });
  }
});

// PUT (editar)
app.put('/especies/:id', async (req, res) => {
  try {
    await Especie.findByIdAndUpdate(req.params.id, req.body);
    res.json({ mensaje: 'Pez actualizado correctamente' });
  } catch(err) {
    res.status(500).json({ error: 'No se pudo actualizar la especie' });
  }
});

// DELETE
app.delete('/especies/:id', async (req, res) => {
  try {
    await Especie.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Pez eliminado correctamente' });
  } catch(err) {
    res.status(500).json({ error: 'No se pudo eliminar la especie' });
  }
});

// 7) Todos los demás GET/* los servimos con el front
//    (es decir, si el usuario abre /admin.html o /peces.html está en public)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'peces.html'));
});

// 8) Levantar servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
