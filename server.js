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
// sirve archivos estáticos de 'public' y de 'public/images'
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

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
const Usuario = mongoose.model('Usuario', usuarioSchema, 'usuarios');

// --- CLOUDINARY ---
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
    transformation: [{ width:800, crop:'limit' }],
  }
});
const upload = multer({ storage });

// --- RUTAS PRINCIPALES ---
app.get('/',    (req, res) => res.sendFile(path.join(__dirname, 'public/peces.html')));
app.get('/admin',(req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

// --- CRUD especies ---
app.get('/especies', async (req, res) => {
  try {
    const especies = await Especie.find().sort({ nombre_comun: 1 });
    res.json(especies);
  } catch (err) {
    res.status(500).json({ error: 'Error interno al listar especies' });
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

    // Generar ficha HTML dinámica
    const tpl = path.join(__dirname, 'templates', 'fichaTemplate.html');
    if (fs.existsSync(tpl)) {
      let html = fs.readFileSync(tpl, 'utf8')
        .replace(/{{NOMBRE_COMUN}}/g, nueva.nombre_comun)
        .replace(/{{NOMBRE_CIENTIFICO}}/g, nueva.nombre_cientifico)
        .replace(/{{FAMILIA}}/g, nueva.familia)
        .replace(/{{ALIMENTACION}}/g, nueva.alimentacion)
        .replace(/{{ESTADO_CONSERVACION}}/g, nueva.estado_conservacion)
        .replace(/{{IMAGEN_URL}}/g, nueva.imagen_url);
      const pecesDir = path.join(__dirname, 'public', 'peces');
      if (!fs.existsSync(pecesDir)) fs.mkdirSync(pecesDir, { recursive: true });
      const fileName = nueva.nombre_comun.toLowerCase().replace(/\s+/g,'-') + '.html';
      fs.writeFileSync(path.join(pecesDir, fileName), html);
    }

    res.status(201).json(nueva);
  } catch (err) {
    console.error('❌ POST /especies', err);
    res.status(500).json({ error: 'No se pudo agregar la especie' });
  }
});

app.put('/especies/:id', upload.single('imagen'), async (req, res) => {
  try {
    const data = {
      nombre_comun:       req.body.nombre_comun,
      nombre_cientifico:  req.body.nombre_cientifico,
      familia:            req.body.familia,
      alimentacion:       req.body.alimentacion,
      estado_conservacion:req.body.estado_conservacion
    };
    if (req.file) data.imagen_url = req.file.path;
    await Especie.findByIdAndUpdate(req.params.id, data);
    res.json({ message: 'Especie actualizada' });
  } catch (err) {
    console.error('❌ PUT /especies', err);
    res.status(500).json({ error: 'No se pudo actualizar la especie' });
  }
});

app.delete('/especies/:id', async (req, res) => {
  try {
    const sp = await Especie.findByIdAndDelete(req.params.id);
    if (!sp) return res.status(404).json({ error: 'Especie no encontrada' });
    // eliminar HTML
    const htmlFile = sp.nombre_comun.toLowerCase().replace(/\s+/g,'-') + '.html';
    const fullPath = path.join(__dirname, 'public', 'peces', htmlFile);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    res.status(204).send();
  } catch (err) {
    console.error('❌ DELETE /especies', err);
    res.status(500).json({ error: 'No se pudo eliminar la especie' });
  }
});

// --- LOGIN ---
app.post('/login', async (req, res) => {
  console.log('🔐 Intento de login:', req.body);
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Faltan usuario o contraseña' });
  }
  try {
    const user = await Usuario.findOne({ username });
    console.log('🔍 Usuario (por username):', user);
    if (!user) return res.status(401).json({ error: 'Usuario no existe' });
    if (user.password !== password) {
      console.log('❌ Contraseña incorrecta');
      return res.status(401).json({ error: 'Contraseña inválida' });
    }
    res.json({ rol: user.role });
  } catch (err) {
    console.error('❌ Error autenticación:', err);
    res.status(500).json({ error: 'Error de servidor al autenticar' });
  }
});

// --- INICIAR SERVIDOR ---
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));


