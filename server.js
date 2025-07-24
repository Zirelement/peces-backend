// ==== server.js ====
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- MONGODB ---
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('❌ MONGODB_URI no está definida.');
  process.exit(1);
}
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error al conectar:', err));

// --- MODELOS ---
// Especies (sin cambios)
const especieSchema = new mongoose.Schema({
  nombre_comun: String,
  nombre_cientifico: String,
  familia: String,
  alimentacion: String,
  estado_conservacion: String,
  imagen_url: String,
});
const Especie = mongoose.model('Especie', especieSchema);

// Usuarios (asegura la colección 'usuarios')
const usuarioSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,
}, { collection: 'usuarios' });
const Usuario = mongoose.model('Usuario', usuarioSchema);

// --- CLOUDINARY ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// --- MULTER ---
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'peces_peruanos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, crop: 'limit' }],
  }
});
const upload = multer({ storage });

// --- RUTAS PRINCIPALES ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/peces.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

// --- CRUD: Especies ---
// ... (misma implementación)

// --- LOGIN (solo texto plano) ---
app.post('/login', async (req, res) => {
  console.log('🔐 Intento de login:', req.body);
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Faltan username o password' });
  }
  try {
    const user = await Usuario.findOne({ username, password });
    console.log('🔍 Usuario encontrado:', user);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    return res.json({ rol: user.role });
  } catch (err) {
    console.error('❌ Error en autenticación:', err);
    return res.status(500).json({ error: 'Error de autenticación' });
  }
});

// --- SERVIDOR ---
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));


