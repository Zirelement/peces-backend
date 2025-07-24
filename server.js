// ==== server.js ====
require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
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
mongoose.connect(uri)
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

// --- CLOUDINARY CONFIG ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

// --- MULTER + CLOUDINARY STORAGE ---
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'peces_peruanos',
    allowed_formats: ['jpg','jpeg','png','webp'],
    transformation: [{ width: 800, crop: 'limit' }],
  }
});
const upload = multer({ storage });

// --- RUTAS PRINCIPALES ---
app.get('/',    (req, res) => res.sendFile(path.join(__dirname, 'public/peces.html')));
app.get('/admin',(req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

// --- CRUD: Especies ---
app.get('/especies', async (req, res) => {
  try {
    const especies = await Especie.find().sort({ nombre_comun: 1 });
    res.json(especies);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/especies', upload.single('imagen'), async (req, res) => {
  try {
    const nueva = new Especie({
      nombre_comun:       req.body.nombre_comun,
      nombre_cientifico:  req.body.nombre_cientifico,
      familia:            req.body.familia,
      alimentacion:       req.body.alimentacion || 'No especificada',
      estado_conservacion:req.body.estado_conservacion || 'No especificado',
      imagen_url:         req.file?.path || ''
    });
    await nueva.save();

    // Genera ficha HTML
    const tpl = path.join(__dirname, 'templates', 'fichaTemplate.html');
    if (fs.existsSync(tpl)) {
      const outDir = path.join(__dirname, 'public', 'peces');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      let html = fs.readFileSync(tpl, 'utf8');
      html = html
        .replace(/{{NOMBRE_COMUN}}/g, nueva.nombre_comun)
        .replace(/{{NOMBRE_CIENTIFICO}}/g, nueva.nombre_cientifico)
        .replace(/{{FAMILIA}}/g, nueva.familia)
        .replace(/{{ALIMENTACION}}/g, nueva.alimentacion)
        .replace(/{{ESTADO_CONSERVACION}}/g, nueva.estado_conservacion)
        .replace(/{{IMAGEN_URL}}/g, nueva.imagen_url);

      const fileName = nueva.nombre_comun.toLowerCase().replace(/\s+/g, '-') + '.html';
      fs.writeFileSync(path.join(outDir, fileName), html);
    }

    res.status(201).json(nueva);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo agregar especie' });
  }
});

app.put('/especies/:id', upload.single('imagen'), async (req, res) => {
  try {
    const updateData = {
      nombre_comun:       req.body.nombre_comun,
      nombre_cientifico:  req.body.nombre_cientifico,
      familia:            req.body.familia,
      alimentacion:       req.body.alimentacion,
      estado_conservacion:req.body.estado_conservacion
    };
    if (req.file) updateData.imagen_url = req.file.path;
    await Especie.findByIdAndUpdate(req.params.id, updateData);
    res.json({ message: 'Especie actualizada' });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo actualizar la especie' });
  }
});

app.delete('/especies/:id', async (req, res) => {
  try {
    const especie = await Especie.findByIdAndDelete(req.params.id);
    if (!especie) return res.status(404).json({ error: 'No encontrada' });

    const htmlPath = path.join(
      __dirname, 'public', 'peces',
      especie.nombre_comun.toLowerCase().replace(/\s+/g, '-') + '.html'
    );
    if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar la especie' });
  }
});

// --- LOGIN CON DESENCRIPTADO RSA ---
// Leemos PRIVATE_KEY en base64 desde env y lo decodificamos a UTF8
const privateKey = Buffer.from(process.env.PRIVATE_KEY, 'base64').toString('utf8');

app.post('/login', async (req, res) => {
  try {
    const { encryptedUser, encryptedPass } = req.body;
    if (!encryptedUser || !encryptedPass) {
      return res.status(400).json({ error: 'Faltan datos cifrados' });
    }

    const username = crypto.privateDecrypt(
      { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(encryptedUser, 'base64')
    ).toString('utf8');

    const password = crypto.privateDecrypt(
      { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(encryptedPass, 'base64')
    ).toString('utf8');

    const user = await Usuario.findOne({ username, password });
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    res.json({ rol: user.role });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error de autenticación' });
  }
});

// --- INICIAR SERVIDOR ---
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));

