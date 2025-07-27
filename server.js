require('dotenv').config();
const express    = require('express');
const path       = require('path');
const fs         = require('fs');
const crypto     = require('crypto');
const bcrypt     = require('bcrypt');
const mongoose   = require('mongoose');
const bodyParser = require('body-parser');
const multer     = require('multer');
const fetch      = require('node-fetch');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Config Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
const storage = new CloudinaryStorage({
  cloudinary,
  params:{ folder:'peces', allowed_formats:['jpg','png','jpeg','webp'] }
});
const upload = multer({ storage });

// Modelos
const Species = require('./models/Species');
const User    = require('./models/User');

const app  = express();
const PORT = process.env.PORT || 3000;

// Claves RSA
const PRIVATE_KEY = fs.readFileSync(path.join(__dirname,'keys','private.pem'),'utf8');
const PUBLIC_KEY  = fs.readFileSync(path.join(__dirname,'keys','public.pem'),'utf8');

// MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(()=>console.log('✅ MongoDB Atlas conectado'))
  .catch(err=>console.error('❌ Error MongoDB:',err));

// Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended:true }));
app.use(express.static(path.join(__dirname,'public')));

// Public key para el frontend
app.get('/api/publicKey',(req,res)=>{
  res.type('text').send(PUBLIC_KEY);
});

// Login + reCAPTCHA
app.post('/login', async (req,res)=>{
  try {
    const { username:encUser, password:encPass, recaptchaToken } = req.body;
    if (!recaptchaToken) {
      return res.status(400).json({ error:'reCAPTCHA no verificado' });
    }
    // Verificar token con Google
    const url = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`;
    const rec = await fetch(url,{ method:'POST' }).then(r=>r.json());
    console.log('reCAPTCHA response:', rec);
    if (!rec.success) {
      return res.status(401).json({ error:'Fallo en verificación reCAPTCHA' });
    }
    // Decrypt username & password
    const username = crypto.privateDecrypt({
      key:PRIVATE_KEY,
      padding:crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash:'sha256'
    }, Buffer.from(encUser,'base64')).toString('utf8');

    const password = crypto.privateDecrypt({
      key:PRIVATE_KEY,
      padding:crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash:'sha256'
    }, Buffer.from(encPass,'base64')).toString('utf8');

    // Validar user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error:'Usuario no encontrado' });
    }
    const ok = user.password.startsWith('$2')
      ? await bcrypt.compare(password,user.password)
      : password === user.password;
    if (!ok) {
      return res.status(401).json({ error:'Contraseña incorrecta' });
    }
    // Éxito
    res.json({ rol: user.role });
  } catch (err) {
    console.error('💥 Error en /login:', err);
    res.status(400).json({ error:'Formato de credenciales inválido' });
  }
});

// CRUD especies
app.get('/especies', async (req,res)=>{
  try {
    const list = await Species.find();
    res.json(list);
  } catch (err) {
    console.error('❌ GET /especies error:',err);
    res.status(500).json({ error:'Error interno' });
  }
});
app.post('/especies', upload.single('imagen'), async (req,res)=>{
  try {
    const data = {
      nombre_comun:        req.body.nombre_comun,
      nombre_cientifico:   req.body.nombre_cientifico,
      familia:             req.body.familia,
      alimentacion:        req.body.alimentacion,
      estado_conservacion: req.body.estado_conservacion,
      imagen_url:          req.file.path
    };
    const nuevo = await Species.create(data);
    res.status(201).json(nuevo);
  } catch (err) {
    console.error('❌ POST /especies error:',err);
    res.status(500).json({ error:'Error interno' });
  }
});
app.put('/especies/:id', upload.single('imagen'), async (req,res)=>{
  try {
	const { nombre, ...otrosCampos } = req.body;
	
	    // Validación de negocio: el nombre no puede contener dígitos
	    if (nombre && /\d/.test(nombre)) {
	      return res.status(422).json({
	        code: 'INVALID_NAME',
	        message: 'El nombre no puede contener números.'
	      });
	    }
	
	    const update = { nombre, ...otrosCampos };
    if (req.file) update.imagen_url = req.file.path;
    await Species.findByIdAndUpdate(req.params.id, update);
    res.json({ ok:true });
  } catch (err) {
    console.error('❌ PUT /especies/:id error:',err);
    res.status(500).json({ error:'Error interno' });
  }
});
app.delete('/especies/:id', async (req,res)=>{
  try {
    await Species.findByIdAndDelete(req.params.id);
    res.json({ ok:true });
  } catch (err) {
    console.error('❌ DELETE /especies/:id error:',err);
    res.status(500).json({ error:'Error interno' });
  }
});

// Servir peces.html en la raíz
app.get('/', (req,res)=>{
  res.sendFile(path.join(__dirname,'public','peces.html'));
});

app.listen(PORT,()=>{
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});
