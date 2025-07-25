// server.js
require('dotenv').config();
const express   = require('express');
const path      = require('path');
const bcrypt    = require('bcrypt');
const mongoose  = require('mongoose');
const bodyParser= require('body-parser');
const multer    = require('multer');
const Species   = require('./models/Species');
const User      = require('./models/User');

const upload = multer({ dest: path.join(__dirname, 'images/') });
const app    = express();
const PORT   = process.env.PORT || 3000;

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log(`🔌 Conectando a MongoDB Atlas con URI: ${process.env.MONGO_URI}`);
    // Seed usuario admin si no existe
    User.findOne({ username: 'admin' })
      .then(u => {
        if (!u) {
          const hash = bcrypt.hashSync('admin123', 10);
          return User.create({ username: 'admin', password: hash, rol: 'admin' });
        }
      })
      .then(u => u && console.log('👤 Usuario admin creado: admin/admin123'))
      .catch(err => console.error('❌ Error seed admin:', err));
  })
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));

// Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/images', express.static(path.join(__dirname, 'images')));

// RUTA: Login
app.post('/login', async (req, res) => {
  console.log('🔐 Intento de login:', req.body);
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      console.log('❌ Usuario no encontrado:', username);
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      console.log('❌ Contraseña incorrecta para:', username);
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    console.log('✅ Login exitoso:', username, 'rol=', user.rol);
    return res.json({ rol: user.rol });
  } catch (err) {
    console.error('💥 Error en /login:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// RUTA: Obtener todas las especies
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

// RUTA: Crear nueva especie (con imagen)
app.post('/especies', upload.single('imagen'), async (req, res) => {
  try {
    const data = {
      nombre_comun: req.body.nombre_comun,
      nombre_cientifico: req.body.nombre_cientifico,
      familia: req.body.familia,
      alimentacion: req.body.alimentacion,
      estado_conservacion: req.body.estado_conservacion,
      imagen_url: req.file.filename
    };
    const especie = await Species.create(data);
    res.status(201).json(especie);
  } catch (err) {
    console.error('❌ Error POST /especies:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// RUTA: Actualizar especie
app.put('/especies/:id', upload.single('imagen'), async (req, res) => {
  try {
    const update = { ...req.body };
    if (req.file) update.imagen_url = req.file.filename;
    await Species.findByIdAndUpdate(req.params.id, update);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error PUT /especies/:id', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// RUTA: Eliminar especie
app.delete('/especies/:id', async (req, res) => {
  try {
    await Species.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error DELETE /especies/:id', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Servir frontend estático
app.use(express.static(path.join(__dirname, 'public')));

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});



