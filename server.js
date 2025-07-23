// server.js
// Carga de variables de entorno (debe estar al inicio)
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

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));  // Archivos estáticos locales

// --- CONEXIÓN A MONGODB ---
mongoose.connect(
  process.env.MONGODB_URI || 'mongodb://localhost:27017/pecesPeruanos', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
)
.then(() => console.log('✅ Conectado a MongoDB'))
.catch(err => console.error('❌ Error al conectar a MongoDB:', err));

// --- MODELOS ---
const especieSchema = new mongoose.Schema({
  nombre_comun: String,
  nombre_cientifico: String,
  familia: String,
  alimentacion: String,
  estado_conservacion: String,
  imagen_url: String,    // URL absoluta (Cloudinary) o ruta local
});
const Especie = mongoose.model('Especie', especieSchema);

const usuarioSchema = new mongoose.Schema({
  username: String,
  password: String,
  role:     String,  // 'admin' | 'analista' | etc.
});
const Usuario = mongoose.model('Usuario', usuarioSchema);

// --- CONFIGURACIÓN DE CLOUDINARY ---
// Soporta dos opciones de env var:
// 1) CLOUDINARY_URL="cloudinary://API_KEY:API_SECRET@CLOUD_NAME"
// 2) CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL, secure: true });
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// --- MULTER + CLOUDINARY ---
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'peces_peruanos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, crop: 'limit' }], // opcional
  },
});
const upload = multer({ storage });

// --- RUTAS DE VISTAS (SPA) ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/peces.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

// --- ENDPOINTS DE API ---
// Obtener todas las especies
app.get('/especies', async (req, res) => {
  try {
    const especies = await Especie.find().sort({ nombre_comun: 1 });
    res.json(especies);
  } catch (err) {
    console.error('Error GET /especies:', err);
    res.status(500).json({ error: 'Error interno al leer especies' });
  }
});

// Agregar nueva especie (imagen a Cloudinary)
app.post('/especies', upload.single('imagen'), async (req, res) => {
  try {
    const nueva = new Especie({
      ...req.body,
      imagen_url: req.file?.path || null,
    });
    await nueva.save();
    res.status(201).json(nueva);
  } catch (err) {
    console.error('Error POST /especies:', err);
    res.status(500).json({ error: 'Error al agregar especie' });
  }
});

// Editar una especie
app.put('/especies/:id', upload.single('imagen'), async (req, res) => {
  try {
    const update = { ...req.body };
    if (req.file) update.imagen_url = req.file.path;
    const editado = await Especie.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(editado);
  } catch (err) {
    console.error('Error PUT /especies/:id:', err);
    res.status(500).json({ error: 'Error al actualizar especie' });
  }
});

// Eliminar una especie
app.delete('/especies/:id', async (req, res) => {
  try {
    await Especie.findByIdAndDelete(req.params.id);
    res.sendStatus(204);
  } catch (err) {
    console.error('Error DELETE /especies/:id:', err);
    res.status(500).json({ error: 'Error al eliminar especie' });
  }
});

// Login básico (usuario y rol en BD)
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

// --- INICIAR SERVIDOR ---
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));

