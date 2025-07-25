// server.js
require('dotenv').config();
const express   = require('express');
const path      = require('path');
const mongoose  = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARES ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sirve la carpeta /public (HTML, JS, CSS, imágenes)
app.use(express.static(path.join(__dirname, 'public')));

// --- MODELOS ---
const usuarioSchema = new mongoose.Schema({
  username: String,
  password: String,
  role:     String
}, { collection: 'usuarios' });

const especieSchema = new mongoose.Schema({
  nombre_comun:        String,
  nombre_cientifico:   String,
  familia:             String,
  alimentacion:        String,
  estado_conservacion: String,
  imagen_url:          String,
  enabled:             Boolean
}, { collection: 'especies' });

const Usuario = mongoose.model('Usuario', usuarioSchema);
const Especie = mongoose.model('Especie', especieSchema);

// --- CONEXIÓN A MONGO ---
console.log('🔌 Conectando a MongoDB Atlas con URI:', process.env.MONGODB_URI);
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser:    true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => console.error('❌ Error al conectar a MongoDB Atlas:', err));

// --- RUTAS ---
// Login
app.post('/login', async (req, res) => {
  console.log('🔐 Intento de login:', req.body);
  try {
    const { username, password } = req.body;
    const user = await Usuario.findOne({ username }).exec();
    console.log('🔍 Usuario encontrado en DB:', user);

    if (!user) {
      console.log('🚫 Usuario no existe:', username);
      return res.status(401).send('Usuario no encontrado');
    }

    if (user.password !== password) {
      console.log(`🚫 Contraseña incorrecta para ${username}`);
      return res.status(401).send('Contraseña incorrecta');
    }

    console.log(`✅ Autenticación correcta para ${username}, rol=${user.role}`);
    return res.json({ rol: user.role });

  } catch (err) {
    console.error('❌ Error en POST /login:', err);
    return res.status(500).send('Error interno de servidor');
  }
});

// Listar especies
app.get('/especies', async (req, res) => {
  console.log('🔍 GET /especies');
  try {
    const lista = await Especie.find().exec();
    console.log(`📑 Devueltas ${lista.length} especies`);
    return res.json(lista);
  } catch (err) {
    console.error('❌ Error en GET /especies:', err);
    return res.status(500).json({ error: 'Error al cargar especies' });
  }
});

// (Aquí van POST /especies, PUT /especies/:id, DELETE /especies/:id, etc. 
//  con logs similares en cada handler.)

// --- INICIO DEL SERVIDOR ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});


