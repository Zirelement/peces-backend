require('dotenv').config();
const express    = require('express');
const path       = require('path');
const bcrypt     = require('bcrypt');
const mongoose   = require('mongoose');
const bodyParser = require('body-parser');
const multer     = require('multer');

// Cloudinary
const cloudinary           = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'peces',                // Carpeta en tu cuenta de Cloudinary
    allowed_formats: ['jpg','png','jpeg','webp']
  }
});

const upload = multer({ storage });

const Species = require('./models/Species');
const User    = require('./models/User');

const app  = express();
const PORT = process.env.PORT || 3000;

// Conectar a MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Conectado a MongoDB Atlas');
    // Crear admin si no existe
    const admin = await User.findOne({ username: 'admin123' });
    if (!admin) {
      await User.create({
        username: 'admin123',
        password: 'admin123',  // texto plano para coincidir con tu colección
        role:     'admin'
      });
      console.log('👤 Usuario creado: admin123 / admin123');
    }
  })
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));

// Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Sirve tu carpeta public (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// --- LOGIN ---
app.post('/login', async (req, res) => {
  console.log('🔐 Intento de login:', req.body);
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      console.log('❌ Usuario no encontrado:', username);
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }
    let ok = false;
    if (user.password.startsWith('$2')) {
      ok = await bcrypt.compare(password, user.password);
    } else {
      ok = password === user.password;
    }
    if (!ok) {
      console.log('❌ Contraseña incorrecta para:', username);
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    console.log('✅ Login exitoso:', username, 'role=', user.role);
    return res.json({ rol: user.role });
  } catch (err) {
    console.error('💥 Error en /login:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// --- CRUD PECES ---
app.get('/especies', async (req, res) => {
  console.log('🔍 GET /especies');
  try {
    const list = await Species.find();
    console.log('📑 Devueltas', list.length, 'especies');
    res.json(list);
  } catch (err) {
    console.error('❌ Error GET /especies:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/especies', upload.single('imagen'), async (req, res) => {
  try {
    const data = {
      nombre_comun:        req.body.nombre_comun,
      nombre_cientifico:   req.body.nombre_cientifico,
      familia:             req.body.familia,
      alimentacion:        req.body.alimentacion,
      estado_conservacion: req.body.estado_conservacion,
      imagen_url:          req.file.path   // URL de Cloudinary
    };
    const sp = await Species.create(data);
    res.status(201).json(sp);
  } catch (err) {
    console.error('❌ Error POST /especies:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.put('/especies/:id', upload.single('imagen'), async (req, res) => {
  try {
    const update = { ...req.body };
    if (req.file) update.imagen_url = req.file.path;
    await Species.findByIdAndUpdate(req.params.id, update);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error PUT /especies/:id', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.delete('/especies/:id', async (req, res) => {
  try {
    await Species.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error DELETE /especies/:id', err);
    res.status(500).json({ error: 'Error interno' });
  }
});
// Al final, antes de app.listen(...)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'peces.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});


