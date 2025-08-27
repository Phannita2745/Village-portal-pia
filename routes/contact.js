const express = require('express');
const router = express.Router();

/* ---------- ติดต่อเรา ---------- */
router.get('/contact', (req, res) => {
  res.render('pages/contact', {
    title: 'ติดต่อเรา',
    sent: req.query.sent === '1',
    user: req.session?.user || null
  });
});

router.post('/contact', (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  if (!name || !message) {
    return res.status(400).send('กรอกชื่อและข้อความให้ครบถ้วน');
  }

  const sql = `
    INSERT INTO contact_messages (name, email, phone, subject, message, created_at)
    VALUES (?, ?, ?, ?, ?, NOW())
  `;
  db.query(sql, [name, email, phone, subject, message], (err) => {
    if (err) return res.status(500).send(err.message);
    res.redirect('/contact?sent=1');
  });
});

module.exports = router;
