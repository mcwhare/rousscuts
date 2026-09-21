require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');

const publicRoutes = require('./src/routes/public');
const adminRoutes = require('./src/routes/admin');
const pool = require('./src/db');

const sessionStore = new MySQLStore({}, pool);



const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 
    }
}));

app.use(publicRoutes);
app.use(adminRoutes);

app.use((req, res) => {
  res.status(404).render('status', { message: 'Page not found', redirectTo: null });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('status', { message: 'Something went wrong. Please try again.', redirectTo: null });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Rousscuts booking app running on port ${PORT}`);
});
