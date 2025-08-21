const express = require('express');
const session = require('express-session');
const mysql = require('mysql2');
const path = require('path');
require('dotenv').config();

const app = express();
const routes = require('./routes/index');

// ----- DB (global ให้ routes ใช้งานได้) -----
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});
global.db = db;

// ----- Views & static -----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'village-secret',
  resave: false,
  saveUninitialized: true
}));

// ----- หน้าอื่น ๆ แยกไว้ได้ หรือย้ายเข้า routes ก็ได้ -----
app.get('/calendar', (req, res) => res.render('pages/calendar'));

// ***** สำคัญ: ให้ใช้ routes/index.js เป็นตัวจัดการ /, /news, /news/:id ทั้งหมด *****
// (อย่าประกาศ app.get('/news') / app.get('/news/:id') ในไฟล์นี้อีก)
app.use('/', routes);

// (ตัวเลือก) health check เล็ก ๆ
app.get('/api/debug/health', (req, res) => {
  db.query('SELECT DATABASE() AS db', (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, db: rows[0].db });
  });
});

// Start
app.listen(3000, () => {
  console.log('✅ Server started at http://localhost:3000');
});
