require('dotenv').config();
const express    = require('express');
const path       = require('path');
const fs         = require('fs');
const crypto     = require('crypto');
const bcrypt     = require('bcrypt');
const mongoose   = require('mongoose');
const bodyParser = require('body-parser');
const multer     = require('multer');
const axios      = require('axios');
const qs         = require('querystring');

// Cloudinary setup (igual que antes)
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

// RSA keys
const PRIVATE_KEY = fs.readFileSync(path.join(__dirname,'keys','private.pem'),'utf8');
const PUBLIC_KEY  = fs.readFileSync(path.join(__dirname,'keys','public.pem'),'utf8');

// MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(()=>console.log('✅ MongoDB Atlas conectado'))
  .catch(e=>console.error('❌ MongoDB error:',e));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname,'public')));

// Exponer clave pública
app.get('/api/publicKey',(req,res)=>{
  res.type('text').send(PUBLIC_KEY);
});

// Login + reCAPTCHA v2
app.post('/login', async (req, res) => {
  try {
    const { username: encUser, password: encPass, recaptchaToken } = req.body;
    if (!recaptchaToken) {
      return res.status(400).json({ error: 'reCAPTCHA no verificado' });
    }

    // 1) Verificar con Google (form-urlencoded)
    const payload = qs.stringify({
      secret:   process.env.RECAPTCHA_SECRET_KEY,
      response: recaptchaToken
    });
    const g = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      payload,
      { headers: { 'Content-Type':'application/x-www-form-urlencoded' } }
    );
    if (!g.data.success) {
      console.log('reCAPTCHA response:', g.data);
      return res.status(401).json({ error:'Fallo en verificación reCAPTCHA' });
    }

    // 2) Desencriptar credenciales
    const username = crypto.privateDecrypt(
      { key: PRIVATE_KEY, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash:'sha256' },
      Buffer.from(encUser,'base64')
    ).toString('utf8');
    const password = crypto.privateDecrypt(
      { key: PRIVATE_KEY, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash:'sha256' },
      Buffer.from(encPass,'base64')
    ).toString('utf8');

    // 3) Buscar usuario y validar contraseña
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error:'Usuario no encontrado' });

    const valid = user.password.startsWith('$2')
      ? await bcrypt.compare(password, user.password)
      : password === user.password;
    if (!valid) return res.status(401).json({ error:'Contraseña incorrecta' });

    // 4) OK → devolver rol
    res.json({ rol: user.role });

  } catch (err) {
    console.error('💥 /login error:', err);
    res.status(400).json({ error:'Formato inválido' });
  }
});

// CRUD de especies (igual que antes)
app.get('/especies', async (req,res)=>{
  try { res.json(await Species.find()) }
  catch(e){ console.error(e); res.status(500).json({error:'Error interno'}); }
});
app.post('/especies', upload.single('imagen'), async (req,res)=>{
  try {
    const d = {
      nombre_comun:        req.body.nombre_comun,
      nombre_cientifico:   req.body.nombre_cientifico,
      familia:             req.body.familia,
      alimentacion:        req.body.alimentacion,
      estado_conservacion: req.body.estado_conservacion,
      imagen_url:          req.file.path
    };
    res.status(201).json(await Species.create(d));
  } catch(e){ console.error(e); res.status(500).json({error:'Error interno'}); }
});
app.put('/especies/:id', upload.single('imagen'), async (req,res)=>{
  try {
    const upd = { ...req.body };
    if (req.file) upd.imagen_url = req.file.path;
    await Species.findByIdAndUpdate(req.params.id, upd);
    res.json({ ok:true });
  } catch(e){ console.error(e); res.status(500).json({error:'Error interno'}); }
});
app.delete('/especies/:id', async (req,res)=>{
  try {
    await Species.findByIdAndDelete(req.params.id);
    res.json({ ok:true });
  } catch(e){ console.error(e); res.status(500).json({error:'Error interno'}); }
});

app.get('/', (req,res)=>{
  res.sendFile(path.join(__dirname,'public','index.html'));
});

app.listen(PORT, ()=>console.log(`🚀 Servidor en puerto ${PORT}`));
