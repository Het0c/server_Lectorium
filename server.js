const express = require('express');
const Sequelize = require('sequelize');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const cors = require('cors'); 

const app = express();
app.use(bodyParser.json());

// Configuración de CORS
const corsOptions = {
  origin: ['http://localhost:8100', 'https://server-lectorium.onrender.com', 'capacitor://localhost'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200 // Para algunos navegadores (Chrome) que devuelven 204 para opciones preflight, forzar 200
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


app.use(cors());
app.options('*', cors(corsOptions)); 

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  dialect: 'mysql'
});

sequelize.authenticate()
  .then(() => console.log('Database connected'))
  .catch(err => {
    console.error('Unable to connect to the database:', err);
    process.exit(1); // Terminar el proceso si hay un error de conexión
  });

const User = sequelize.define('user', {
  email: { type: Sequelize.STRING, unique: true },
  password: { type: Sequelize.STRING },
  resetCode: { type: Sequelize.STRING }
}, {
  timestamps: false
});

sequelize.sync()
  .then(() => console.log('Users table created'))
  .catch(err => {
    console.error('Unable to create tables:', err);
    process.exit(1); // Terminar el proceso si hay un error al crear las tablas
  });



app.post('/login', (req, res) => {
  const { email, password } = req.body;
  User.findOne({ where: { email, password } })
    .then(user => {
      if (user) {
        res.json(user);
      } else {
        res.status(400).json({ error: 'Credenciales incorrectas.' });
      }
    })
    .catch(err => {
      console.error('Error en /login:', err);
      res.status(500).json({ error: 'Tiempo de espera agotado. Intente más tarde.' });
    });
});

app.post('/register', (req, res) => {
  const { email, password } = req.body;
  User.create({ email, password })
    .then(user => res.json(user))
    .catch(err => {
      console.error('Error en /register:', err);
      res.status(500).json({ error: 'Tiempo de espera agotado. Intente más tarde.' });
    });
});


app.post('/reset-password', (req, res) => {
  const { email } = req.body;
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  User.update({ resetCode }, { where: { email } })
    .then(result => {
      if (result[0] === 0) {
        res.status(404).json({ error: 'User not found' });
      } else {
        const mailOptions = {
          from: 'RecuperacionLectorium@gmail.com',
          to: email,
          subject: 'Código de verificación reinicio de contraseña',
          text: `Tu código de verificación es: ${resetCode}`
        };
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Error enviando Email:', error);
            res.status(500).json({ error: 'Error enviando Email:' });
          } else {
            console.log('Email enviado:', info.response);
            res.json({ message: 'Email de cambio de contraseña enviado' });
          }
        });
      }    
    })
    .catch(err => {
      console.error('Error en /reset-password:', err);
      res.status(500).json({ error: 'Tiempo de espera agotado. Intente más tarde.' });
    });
});

app.post('/verify-code', (req, res) => {
  const { email, code } = req.body;
  User.findOne({ where: { email, resetCode: code } })
    .then(user => {
      if (user) {
        res.json({ message: 'Código verificado' });
      } else {
        res.status(400).json({ error: 'Código inválido' });
      }
    })
    .catch(err => {
      console.error('Error en /verify-code:', err);
      res.status(500).json({ error: 'Tiempo de espera agotado. Intente más tarde.' });
    });
});

app.post('/update-password', (req, res) => {
  const { email, newPassword } = req.body;
  User.update({ password: newPassword, resetCode: null }, { where: { email } })
    .then(() => res.json({ message: 'Contraseña actualizada' }))
    .catch(err => {
      console.error('Error en /update-password:', err);
      res.status(500).json({ error: 'Tiempo de espera agotado. Intente más tarde.' });
    });
});

app.get('/profile/:id', (req, res) => {
  const userId = req.params.id;
  User.findByPk(userId)
    .then(user => res.json(user))
    .catch(err => {
      console.error('Error en /profile/:id:', err);
      res.status(500).json({ error: 'Error al obtener el perfil del usuario.' });
    });
});


const Author = sequelize.define('author', {
  name: { type: Sequelize.STRING },
  bio: { type: Sequelize.TEXT },
}, {
  timestamps: false
});

const Book = sequelize.define('book', {
  title: { type: Sequelize.STRING },
  author: { type: Sequelize.STRING },
  cover: { type: Sequelize.STRING },
}, {
  timestamps: false
});

const UserBook = sequelize.define('user_book', {
  user_id: { type: Sequelize.INTEGER },
  book_id: { type: Sequelize.INTEGER },
  status: { type: Sequelize.ENUM('reading', 'completed', 'wishlist') }
}, {
  timestamps: false
});

sequelize.sync()
  .then(() => console.log('Tables created'))
  .catch(err => {
    console.error('Unable to create tables:', err);
    process.exit(1); // Terminar el proceso si hay un error al crear las tablas
  });

app.get('/user/:id', (req, res) => {
  const userId = req.params.id;
  User.findByPk(userId)
    .then(user => res.json(user))
    .catch(err => {
      console.error('Error en /user/:id:', err);
      res.status(500).json({ error: 'Tiempo de espera agotado. Intente más tarde.' });
    });
});

app.get('/user/:id/favorite-books', (req, res) => {
  const userId = req.params.id;
  UserBook.findAll({ where: { user_id: userId, status: 'wishlist' }, include: [Book] })
    .then(userBooks => res.json(userBooks.map(ub => ub.book)))
    .catch(err => {
      console.error('Error en /user/:id/favorite-books:', err);
      res.status(500).json({ error: 'Tiempo de espera agotado. Intente más tarde.' });
    });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


// const authenticate = (req, res, next) => {
//   // Lógica para autenticar al usuario y añadir `req.user`
//   // Por ejemplo, usando un token JWT
//   const token = req.headers.authorization.split(' ')[1];
//   jwt.verify(token, 'tu_secreto', (err, decoded) => {
//     if (err) {
//       return res.status(401).json({ error: 'No autorizado' });
//     }
//     req.user = decoded; // Añade el usuario decodificado a la solicitud
//     next();
//   });
// };

// app.use(authenticate); // Usa el middleware de autenticación