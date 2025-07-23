// server.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- CONEXIÓN A MONGODB ---
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ MONGODB_URI no está definida. Asegúrate de configurar la variable en Heroku.');
  process.exit(1);
}

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Conectado a MongoDB Atlas'))
.catch(err => console.error('❌ Error al conectar a MongoDB:', err));

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
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// --- MULTER + CLOUDINARY STORAGE ---
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

// --- API: Especies ---
app.get('/especies', async (req, res) => {
  try {
    const especies = await Especie.find().sort({ nombre_comun: 1 });
    res.json(especies);
  } catch (err) {
    console.error('GET /especies error:', err);
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

    // --- GENERAR FICHA HTML DESDE PLANTILLA ---
    const templatePath = path.join(__dirname, 'templates', 'fichaTemplate.html');
    if (!fs.existsSync(templatePath)) {
      console.warn('⚠️ Plantilla fichaTemplate.html no encontrada.');
    } else {
      const pecesDir = path.join(__dirname, 'public', 'peces');
      if (!fs.existsSync(pecesDir)) {
        fs.mkdirSync(pecesDir, { recursive: true });
      }

      let plantilla = fs.readFileSync(templatePath, 'utf8');

      plantilla = plantilla
        .replace(/{{NOMBRE_COMUN}}/g, nueva.nombre_comun || 'No especificado')
        .replace(/{{NOMBRE_CIENTIFICO}}/g, nueva.nombre_cientifico || 'No especificado')
        .replace(/{{FAMILIA}}/g, nueva.familia || 'No especificada')
        .replace(/{{ALIMENTACION}}/g, nueva.alimentacion || 'No especificada')
        .replace(/{{ESTADO_CONSERVACION}}/g, nueva.estado_conservacion || 'No especificado')
        .replace(/{{IMAGEN_URL}}/g, nueva.imagen_url || '');

      const nombreArchivo = nueva.nombre_comun.toLowerCase().replace(/\s+/g, '-') + '.html';
      const outputPath = path.join(pecesDir, nombreArchivo);
      fs.writeFileSync(outputPath, plantilla);
      console.log(`✅ Ficha creada: /peces/${nombreArchivo}`);
    }

    res.status(201).json(nueva);
  } catch (err) {
    console.error('POST /especies error:', err);
    res.status(500).json({ error: 'No se pudo agregar especie' });
  }
});

// --- API: Login ---
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await Usuario.findOne({ username, password });
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
    res.json({ rol: user.role });
  } catch (err) {
    console.error('POST /login error:', err);
    res.status(500).json({ error: 'Error de autenticación' });
  }
});

// --- INICIAR SERVIDOR ---
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));


