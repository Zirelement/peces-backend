// server.js
// =========

require('dotenv').config();
const express    = require('express');
const crypto     = require('crypto');
const path       = require('path');
const fs         = require('fs');
const bcrypt     = require('bcrypt');
const mongoose   = require('mongoose');
const bodyParser = require('body-parser');
const multer     = require('multer');

// — Cloudinary setup (sin cambios) —
const cloudinary            = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
cloudinary.config({
  cloud_name:    process.env.CLOUDINARY_CLOUD_NAME,
  api_key:       process.env.CLOUDINARY_API_KEY,
  api_secret:    process.env.CLOUDINARY_API_SECRET
});
const storage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'peces', allowed_formats: ['jpg','png','jpeg','webp'] }
});
const upload = multer({ storage });

const Species = require('./models/Species');
const User    = require('./models/User');

const app  = express();
const PORT = process.env.PORT || 3000;

// — – –  RSA: clave privada desde ENV — – –
const PRIVATE_KEY = process.env.RSA_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error('❌ RSA_PRIVATE_KEY no definida en ENV');
  process.exit(1);
}

// — – –  RSA: clave pública desde archivo versionado — – –
const PUBLIC_KEY = fs.readFileSync(
  path.join(__dirname, 'keys', 'public.pem'),
  'utf8'
);

// Exponer pública para el front
app.get('/api/publicKey', (req, res) => {
  res.type('text/plain').send(PUBLIC_KEY);
});

// — – –  Conexión a MongoDB Atlas — – –
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Conectado a MongoDB Atlas');
    // Crea admin si no existe
    const admin = await User.findOne({ username: 'admin123' });
    if (!admin) {
      await User.create({ username:'admin123', password:'admin123', role:'admin' });
      console.log('👤 Usuario admin123 creado');
    }
  })
  .catch(err => console.error('❌ Error MongoDB:', err));

// — – –  Middlewares — – –
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Sirve todo lo que esté en /public
app.use(express.static(path.join(__dirname, 'public')));

// — – –  LOGIN (descifrado RSA + validación) — – –
app.post('/login', async (req, res) => {
  try {
    const { username: encUser, password: encPass } = req.body;

    // Base64 → Buffer
    const bufUser = Buffer.from(encUser, 'base64');
    const bufPass = Buffer.from(encPass, 'base64');

    // Descifrado PKCS#1 v1.5
    const username = crypto.privateDecrypt(
      { key: PRIVATE_KEY, padding: crypto.constants.RSA_PKCS1_PADDING },
      bufUser
    ).toString('utf8');

    const password = crypto.privateDecrypt(
      { key: PRIVATE_KEY, padding: crypto.constants.RSA_PKCS1_PADDING },
      bufPass
    ).toString('utf8');

    // Validación en DB
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error:'Usuario no encontrado' });

    const ok = user.password.startsWith('$2')
      ? await bcrypt.compare(password, user.password)
      : password === user.password;
    if (!ok) return res.status(401).json({ error:'Contraseña incorrecta' });

    // Éxito → devolver rol
    return res.json({ rol: user.role });
  } catch (err) {
    console.error('💥 Error /login:', err);
    return res.status(400).json({ error:'Formato de credenciales inválido' });
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

// — – –  RUTA RAÍZ: ahora servimos galerías, no un login aparte — – –
app.get('/', (req, res) => {
  // ← Anteriormente apuntaba a login.html; ahora a peces.html
  res.sendFile(path.join(__dirname, 'public', 'peces.html'));
});

// Levantamos el servidor
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));

