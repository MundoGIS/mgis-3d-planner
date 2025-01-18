/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

const express = require('express');
require('dotenv').config();

const session = require('express-session');
const path = require('path');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcrypt');
const flash = require('connect-flash');
const cesium = require('./routes/3d');
const Geodata = require('./routes/geodata');
const aboutUS = require('./routes/om-gism')
const fs = require('fs');
const usersFilePath = path.join(__dirname, './auth/users.json');
const bodyParser = require('body-parser');
const axios = require('axios');



const cookieParser = require('cookie-parser');
const app = express();



app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('views', ['views', 'auth']);

app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Configura como true si estás usando HTTPS
}));

function isAuthenticated(req, res, next) {
  if (req.session.user) {
    res.locals.isAuthenticated = true;
    next();
  } else {
    req.flash('error', 'Unauthorized access, please log in first!');
    res.redirect('/login');
  }
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(flash());
app.use(cors({
  origin: '*', // O especifica el dominio que necesita acceso
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true
}));


app.use(express.static('data'));

// Configuración de rutas estáticas
app.use('/public/', express.static(path.join(__dirname, 'public')));
/* app.use('/node_modules', express.static(path.join(__dirname, 'node_modules'))) */;
app.use('/Cesium',  isAuthenticated, express.static(path.join(__dirname, 'node_modules', 'cesium', 'Build', 'Cesium')));
app.use('/CesiumIkons',  isAuthenticated, express.static(path.join(__dirname, 'node_modules', 'cesium', 'Build', 'Cesium', 'Assets')));

app.use('/Tiles/', isAuthenticated, express.static(path.join(__dirname, 'data', 'uploaded', '3d', '3dtiles')));
app.use('/3d/', isAuthenticated, express.static(path.join(__dirname, 'data', 'uploaded', '3d')));
app.use('/2d/', isAuthenticated, express.static(path.join(__dirname, 'data', 'uploaded', '2d')));
app.use('/dxf-geojson/', isAuthenticated, express.static(path.join(__dirname, 'data', 'uploaded', '3d', 'dxf-geojson')));
app.use('/terrain', isAuthenticated, express.static(path.join(__dirname, 'data', 'uploaded', '3d', 'terrain')));

// Ruta protegida para servir archivos de la carpeta terrain
app.get('/terrain/*', isAuthenticated, (req, res) => {
  const filePath = path.join(__dirname, 'data', 'uploaded', '3d', 'terrain', req.path);
  
  // Verifica si el archivo solicitado existe
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      // Si no existe el archivo, responde con 404
      return res.status(404).send('File not found');
    }
    
    // Si existe, envía el archivo
    res.sendFile(filePath);
  });
});


// Rutas
app.use('/data', isAuthenticated, checkRole('user', 'admin'), Geodata);
app.use('/3d', isAuthenticated, checkRole('user', 'admin'), cesium);
app.use('/about', isAuthenticated, checkRole('user', 'admin'), aboutUS);

// Autenticación básica para GeoServer
const auth = 'Basic ' + Buffer.from(`${process.env.WFS_USERNAME}:${process.env.WFS_PASSWORD}`).toString('base64');

// No-cache headers
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Función para hashear la contraseña
const hashPassword = async (password) => {
  const saltRounds = 14; // Número de rondas de hashing
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  return hashedPassword;
};

// Función para verificar si la contraseña ya está hasheada
const isPasswordHashed = (password) => {
  return password.startsWith('$2b$') || password.startsWith('$2a$') || password.startsWith('$2y$');
};

// Modifica la función hashPasswords para verificar primero si ya están hasheadas
const hashPasswords = async (users) => {
  for (const user of users) {
    if (!isPasswordHashed(user.password)) {
      user.password = await hashPassword(user.password);
    }
  }
};

// Antes de guardar los usuarios en el archivo JSON, hashea las contraseñas
fs.readFile(usersFilePath, 'utf8', async (err, data) => {
  if (err) {
    console.error('Error al leer el archivo de usuarios:', err);
    return;
  }

  let users = JSON.parse(data);

  // Hashear las contraseñas
  await hashPasswords(users);

  // Guardar los usuarios en el archivo JSON
  fs.writeFile(usersFilePath, JSON.stringify(users), (err) => {
    if (err) {
      console.error('Error al guardar los usuarios en el archivo:', err);
      return;
    }
    console.log('Contraseñas hasheadas y usuarios guardados en el archivo.');
  });
});

// Middleware para verificar roles

function checkRole(...roles) {
  return function (req, res, next) {
    if (req.session.user && roles.includes(req.session.user.role)) {
      next();
    } else {
      req.flash('error', 'Access denied. You do not have permission to view this page.');
      res.redirect('/'); // Redirigir a la página de inicio o a otra página que desees
    }
  };
}

app.use((req, res, next) => {
  res.locals.isAuthenticated = !!req.session.user;
  res.locals.userRole = req.session.user ? req.session.user.role : null;
  next();
});



// Ruta para la página de inicio
app.get('/', (req, res) => {
  res.render('index');
});



// Ruta para la página de inicio de sesión
/* app.get('/login', (req, res) => {
  res.render('login');
}); */

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  fs.readFile(usersFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo de usuarios:', err);
      res.status(500).send('Error interno del servidor');
      return;
    }

    const users = JSON.parse(data);
    const user = users.find(user => user.username === username);

    if (!user) {
      req.flash('error', 'Wrong credentials, please try again!');
      return res.redirect('/login');
    }

    bcrypt.compare(password, user.password, (err, result) => {
      if (err) {
        console.error('Error al comparar contraseñas:', err);
        res.status(500).send('Error interno del servidor');
        return;
      }
      if (result) {
        req.session.user = { username: user.username, role: user.role };
        res.redirect('/');
      } else {
        req.flash('error', 'Wrong credentials, please try again!');
        res.redirect('/login');
      }
    });
  });
});


app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error al cerrar la sesión:', err);
    }
    res.redirect('/'); // Redirecciona a la página principal después de hacer logout
  });
});

//hantera users 
// Ruta para la página de gestión de usuarios (sólo accesible para admin)
app.get('/admin/users', isAuthenticated, checkRole('admin'), (req, res) => {
  fs.readFile(usersFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error al leer el archivo de usuarios:', err);
      res.status(500).send('Error interno del servidor');
      return;
    }

    const users = JSON.parse(data);
    res.render('manage-users', { users });
  });
});

// Ruta para añadir un nuevo usuario
app.post('/admin/users/add', isAuthenticated, checkRole('admin'), async (req, res) => {
  const { username, password } = req.body;

  try {
    const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));

    if (users.find(user => user.username === username)) {
      req.flash('error', 'Username already exists!');
      return res.redirect('/admin/users');
    }

    const hashedPassword = await hashPassword(password);
    users.push({ username, password: hashedPassword, role: 'user' });

    fs.writeFileSync(usersFilePath, JSON.stringify(users));
    req.flash('success', 'User added successfully!');
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Error adding user:', err);
    res.status(500).send('Error interno del servidor');
  }
});

// Ruta para cambiar la contraseña de un usuario existente
app.post('/admin/users/edit', isAuthenticated, async (req, res) => {
  const { username, password } = req.body;

  try {
    const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));

    const user = users.find(user => user.username === username);
    if (user) {
      user.password = await hashPassword(password);
      fs.writeFileSync(usersFilePath, JSON.stringify(users));
      req.flash('success', 'Password updated successfully!');
    } else {
      req.flash('error', 'User not found!');
    }

    // Si el usuario actualizó su propia contraseña, actualizar la sesión
    if (req.session.user.username === username) {
      req.session.user.password = user.password;
    }

    res.redirect('/admin/users');
  } catch (err) {
    console.error('Error updating password:', err);
    res.status(500).send('Error interno del servidor');
  }
});


// Ruta para eliminar un usuario (excepto admin)
app.post('/admin/users/delete', isAuthenticated, checkRole('admin'), (req, res) => {
  const { username } = req.body;

  if (username === 'admin') {
    req.flash('error', 'Admin user cannot be deleted!');
    return res.redirect('/admin/users');
  }

  try {
    let users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));

    users = users.filter(user => user.username !== username);

    fs.writeFileSync(usersFilePath, JSON.stringify(users));
    req.flash('success', 'User deleted successfully!');
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).send('Error interno del servidor');
  }
});



// Página de error
app.use((req, res, next) => {
  res.status(404).render('404');
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
