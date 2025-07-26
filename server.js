// server.js
require('dotenv').config();
const express    = require('express');
const path       = require('path');
const fs         = require('fs');
const crypto     = require('crypto');
const bcrypt     = require('bcrypt');
const mongoose   = require('mongoose');
const bodyParser = require('body-parser');
const multer     = require('multer');

// Cloudinary
const cloudinary            = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'peces',
    allowed_formats: ['jpg','png','jpeg','webp']
  }
});
const upload = multer({ storage });

// Modelos
const Species = require('./models/Species');
const User    = require('./models/User');

const app  = express();
const PORT = process.env.PORT || 3000;

// Carga de claves RSA (PEM) desde /keys
const PRIVATE_KEY = fs.readFileSync(path.join(__dirname, 'keys', 'private.pem'), 'utf8');
const PUBLIC_KEY  = fs.readFileSync(path.join(__dirname, 'keys',  'public.pem'),  'utf8');

// Conectar a MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB Atlas conectado');
    // Crear admin si no existe
    const admin = await User.findOne({ username: 'admin123' });
    if (!admin) {
      await User.create({
        username: 'admin123',
        password: 'admin123',
        role:     'admin'
      });
      console.log('👤 Usuario admin123 / admin123 creado');
    }
  })
  .catch(err => console.error('❌ Error MongoDB:', err));

// Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// —————————————————————————
//  Endpoint para entregar la clave pública al frontend
// —————————————————————————
app.get('/api/publicKey', (req, res) => {
  res.type('text').send(PUBLIC_KEY);
});

//  LOGIN: descifrado con RSA‑OAEP/SHA‑256
// —————————————————————————
app.post('/login', async (req, res) => {
  try {
    const { username: encUser, password: encPass } = req.body;

    // 1) Descifrar usuario
    const username = crypto.privateDecrypt(
      {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      Buffer.from(encUser, 'base64')
    ).toString('utf8');

    // 2) Descifrar contraseña
    const password = crypto.privateDecrypt(
      {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      Buffer.from(encPass, 'base64')
    ).toString('utf8');

    // 3) Verificar en BD
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    let ok;
    if (user.password.startsWith('$2')) {
      ok = await bcrypt.compare(password, user.password);
    } else {
      ok = password === user.password;
    }
    if (!ok) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    // 4) Devolver rol para que el front redirija correctamente
    return res.json({ rol: user.role });

  } catch (err) {
    console.error('💥 Error en /login:', err);
    return res.status(400).json({ error: 'Formato de credenciales inválido' });
  }
});


// —————————————————————————
//  CRUD de especies
// —————————————————————————
app.get('/especies', async (req, res) => {
  try {
    const list = await Species.find();
    res.json(list);
  } catch (err) {
    console.error('❌ GET /especies error:', err);
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
      imagen_url:          req.file.path
    };
    const sp = await Species.create(data);
    res.status(201).json(sp);
  } catch (err) {
    console.error('❌ POST /especies error:', err);
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
    console.error('❌ PUT /especies/:id error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.delete('/especies/:id', async (req, res) => {
  try {
    await Species.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ DELETE /especies/:id error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Sirve la página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'peces.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});

