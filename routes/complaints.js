const express = require('express');
const router = express.Router();

// --- ร้องเรียน (หัวข้อร้องเรียน) ---
router.get('/complaints', (req, res) => {
  res.render('pages/complaints', {
    title: 'หัวข้อร้องเรียน',
    sent: req.query.sent === '1',
    user: req.session.user || null
  });
});

router.post('/complaints', (req, res) => {
  const { name, email, phone, details } = req.body;

  if (!name || !details) {
    return res.status(400).send('กรอกชื่อและรายละเอียดให้ครบถ้วน');
  }

  const sql = `
    INSERT INTO complaints (name, email, phone, details, date)
    VALUES (?, ?, ?, ?, NOW())
  `;
  db.query(sql, [name, email, phone, details], (err) => {
    if (err) return res.status(500).send(err.message);
    res.redirect('/complaints?sent=1');
  });
});

module.exports = router;
