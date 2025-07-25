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
// Explicita carpeta de imágenes
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
// La colección en Atlas se llama "usuarios"
const Usuario = mongoose.model('Usuario', usuarioSchema, 'usuarios');

// --- CLOUDINARY & MULTER (igual que antes) ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'peces_peruanos',
    allowed_formats: ['jpg','jpeg','png','webp'],
    transformation: [{ width:800, crop:'limit' }],
  }
});
const upload = multer({ storage });

// --- RUTAS PRINCIPALES Y CRUD de especies (igual que antes) ---
app.get('/',    (req,res) => res.sendFile(path.join(__dirname,'public/peces.html')));
app.get('/admin',(req,res) => res.sendFile(path.join(__dirname,'public/admin.html')));
// ... (GET/POST/PUT/DELETE de /especies quedan idénticos)

// --- LOGIN MEJORADO ---
app.post('/login', async (req, res) => {
  console.log('🔐 Intento de login:', req.body);
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Faltan username o password' });
  }
  try {
    // 1) Busca solo por username
    const user = await Usuario.findOne({ username });
    console.log('🔍 Usuario (por username):', user);
    if (!user) {
      return res.status(401).json({ error: 'Usuario no existe' });
    }
    // 2) Compara la contraseña
    if (user.password !== password) {
      console.log('❌ Password mismatch — enviado:', password, 'en DB:', user.password);
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    // 3) Éxito
    return res.json({ rol: user.role });
  } catch (err) {
    console.error('❌ Error en autenticación:', err);
    return res.status(500).json({ error: 'Error de autenticación' });
  }
});

// --- INICIA SERVIDOR ---
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));


