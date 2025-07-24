// ==== server.js ====
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
const especieSchema = new mongoose.Schema({
  nombre_comun: String,
  nombre_cientifico: String,
  familia: String,
  alimentacion: String,
  estado_conservacion: String,
  imagen_url: String,
});
const Especie = mongoose.model('Especie', especieSchema);

const usuarioSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,
});
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
app.get('/especies', async (req, res) => {
  try {
    const especies = await Especie.find().sort({ nombre_comun: 1 });
    res.json(especies);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// creación, actualización y eliminación idéntica al código anterior…
// --- LOGIN (plaintext y RSA) ---
const privateKeyPem = Buffer.from(process.env.PRIVATE_KEY, 'base64').toString('utf8');
app.post('/login', async (req, res) => {
  try {
    let username, password;
    // si viene cifrado por RSA
    if (req.body.encryptedUser && req.body.encryptedPass) {
      username = crypto.privateDecrypt(
        { key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
        Buffer.from(req.body.encryptedUser, 'base64')
      ).toString('utf8');
      password = crypto.privateDecrypt(
        { key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
        Buffer.from(req.body.encryptedPass, 'base64')
      ).toString('utf8');
    }
    // si viene en claro desde peces.html
    else if (req.body.username && req.body.password) {
      username = req.body.username;
      password = req.body.password;
    } else {
      return res.status(400).json({ error: 'Faltan username o password' });
    }

    const user = await Usuario.findOne({ username, password });
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
    res.json({ rol: user.role });
  } catch (err) {
    console.error('Error login:', err);
    res.status(500).json({ error: 'Error de autenticación' });
  }
});

// --- SERVIDOR ---
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));


