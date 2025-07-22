const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pecesPeruanos', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.error('❌ Error al conectar a MongoDB:', err));

// Modelos
const Especie = mongoose.model('Especie', new mongoose.Schema({
  nombre_comun: String,
  nombre_cientifico: String,
  familia: String,
  alimentacion: String,
  estado_conservacion: String,
  imagen_url: String
}));

const Usuario = mongoose.model('Usuario', new mongoose.Schema({
  username: String,
  password: String,
  role: String
}));

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configurar multer-storage-cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'peces',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
  }
});
const upload = multer({ storage });

// Vistas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/peces.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

// Endpoints
app.get('/especies', async (req, res) => {
  const especies = await Especie.find();
  res.json(especies);
});

app.post('/especies', upload.single('imagen'), async (req, res) => {
  const nuevaEspecie = new Especie({
    ...req.body,
    imagen_url: req.file?.path || null
  });
  await nuevaEspecie.save();
  res.json(nuevaEspecie);
});

app.put('/especies/:id', upload.single('imagen'), async (req, res) => {
  const { id } = req.params;
  const update = { ...req.body };
  if (req.file) {
    update.imagen_url = req.file.path;
  }
  const editado = await Especie.findByIdAndUpdate(id, update, { new: true });
  res.json(editado);
});

app.delete('/especies/:id', async (req, res) => {
  await Especie.findByIdAndDelete(req.params.id);
  res.sendStatus(204);
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await Usuario.findOne({ username, password });
    if (user) {
      res.json({ rol: user.role });
    } else {
      res.status(401).json({ error: 'Credenciales incorrectas' });
    }
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});

