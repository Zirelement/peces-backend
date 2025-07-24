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
// Ajusta el tercer parámetro al nombre real de tu colección de usuarios en MongoDB Atlas
const Usuario = mongoose.model('Usuario', usuarioSchema, 'usuario');

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

app.post('/especies', upload.single('imagen'), async (req, res) => {
  try {
    const nueva = new Especie({
      nombre_comun: req.body.nombre_comun,
      nombre_cientifico: req.body.nombre_cientifico,
      familia: req.body.familia,
      alimentacion: req.body.alimentacion || 'No especificada',
      estado_conservacion: req.body.estado_conservacion || 'No especificado',
      imagen_url: req.file?.path || ''
    });
    await nueva.save();

    // Genera la ficha HTML si existe la plantilla
    const templatePath = path.join(__dirname, 'templates', 'fichaTemplate.html');
    if (fs.existsSync(templatePath)) {
      const pecesDir = path.join(__dirname, 'public', 'peces');
      if (!fs.existsSync(pecesDir)) fs.mkdirSync(pecesDir, { recursive: true });

      let plantilla = fs.readFileSync(templatePath, 'utf8');
      plantilla = plantilla
        .replace(/{{NOMBRE_COMUN}}/g, nueva.nombre_comun)
        .replace(/{{NOMBRE_CIENTIFICO}}/g, nueva.nombre_cientifico)
        .replace(/{{FAMILIA}}/g, nueva.familia)
        .replace(/{{ALIMENTACION}}/g, nueva.alimentacion)
        .replace(/{{ESTADO_CONSERVACION}}/g, nueva.estado_conservacion)
        .replace(/{{IMAGEN_URL}}/g, nueva.imagen_url);

      const nombreArchivo = nueva.nombre_comun.toLowerCase().replace(/\s+/g, '-') + '.html';
      fs.writeFileSync(path.join(pecesDir, nombreArchivo), plantilla);
    }

    res.status(201).json(nueva);
  } catch (err) {
    res.status(500).json({ error: 'No se pudo agregar especie' });
  }
});

app.put('/especies/:id', upload.single('imagen'), async (req, res) => {
  try {
    const updateData = {
      nombre_comun: req.body.nombre_comun,
      nombre_cientifico: req.body.nombre_cientifico,
      familia: req.body.familia,
      alimentacion: req.body.alimentacion,
      estado_conservacion: req.body.estado_conservacion
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
    const rutaHTML = path.join(__dirname, 'public', 'peces', especie.nombre_comun.toLowerCase().replace(/\s+/g, '-') + '.html');
    if (fs.existsSync(rutaHTML)) fs.unlinkSync(rutaHTML);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'No se pudo eliminar la especie' });
  }
});

// --- LOGIN (texto plano) ---
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
    res.json({ rol: user.role });
  } catch (err) {
    console.error('❌ Error en autenticación:', err);
    res.status(500).json({ error: 'Error de autenticación' });
  }
});

// --- SERVIDOR ---
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));




