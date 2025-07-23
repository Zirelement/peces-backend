// server.js
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Servir archivos estáticos (front-end y assets)
app.use(express.static(path.join(__dirname, 'public')));

// --- Conexión a MongoDB ---
mongoose.connect(
  process.env.MONGODB_URI || 'mongodb://localhost:27017/pecesPeruanos',
  { useNewUrlParser: true, useUnifiedTopology: true }
)
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.error('❌ Error al conectar a MongoDB:', err));

// --- Configuración de Cloudinary ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- Multer + Cloudinary Storage ---
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'peces',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    public_id: (req, file) => `${Date.now()}_${file.originalname.replace(/\.[^/.]+$/, '')}`
  }
});
const upload = multer({ storage });

// --- Modelos ---
const especieSchema = new mongoose.Schema({
  nombre_comun: String,
  nombre_cientifico: String,
  familia: String,
  alimentacion: String,
  estado_conservacion: String,
  imagen_url: String,
}, { timestamps: true });

const usuarioSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['admin','analista'], default: 'analista' }
});

const Especie = mongoose.model('Especie', especieSchema);
const Usuario = mongoose.model('Usuario', usuarioSchema);

// --- Rutas vistas ---
app.get('/', (_req, res) => res.redirect('/peces.html'));
app.get('/admin', (_req, res) => res.redirect('/admin.html'));
// (admin.html y peces.html quedan en /public)

// --- API: Especies ---
app.get('/especies', async (_req, res) => {
  const lista = await Especie.find().sort({ createdAt: -1 });
  res.json(lista);
});

app.post('/especies', upload.single('imagen'), async (req, res) => {
  try {
    const { body, file } = req;
    const nueva = new Especie({
      ...body,
      imagen_url: file?.path || ''
    });
    await nueva.save();
    res.status(201).json(nueva);
  } catch (err) {
    console.error('Error POST /especies:', err);
    res.status(500).json({ error: 'Error al crear especie' });
  }
});

app.put('/especies/:id', upload.single('imagen'), async (req, res) => {
  try {
    const { id } = req.params;
    const update = { ...req.body };
    if (req.file) update.imagen_url = req.file.path;
    const mod = await Especie.findByIdAndUpdate(id, update, { new: true });
    res.json(mod);
  } catch (err) {
    console.error('Error PUT /especies:', err);
    res.status(500).json({ error: 'Error al actualizar especie' });
  }
});

app.delete('/especies/:id', async (req, res) => {
  try {
    await Especie.findByIdAndDelete(req.params.id);
    res.sendStatus(204);
  } catch (err) {
    console.error('Error DELETE /especies:', err);
    res.status(500).json({ error: 'Error al eliminar especie' });
  }
});

// --- API: Usuarios / Login ---
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await Usuario.findOne({ username, password });
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });
    res.json({ rol: user.role });
  } catch (err) {
    console.error('Error POST /login:', err);
    res.status(500).json({ error: 'Error interno de autenticación' });
  }
});

// --- Catch-all: fallback to front-end ---
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'peces.html'));
});

// --- Iniciar servidor ---
app.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT}`));


