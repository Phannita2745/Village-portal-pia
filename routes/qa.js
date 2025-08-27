const express = require('express');
const router = express.Router();

/* ---------- Q&A Pages & APIs ---------- */

router.get('/qa', (req, res) => {
  res.render('pages/qa', { user: req.session.user || null });
});

router.get('/api/qa', (req, res) => {
  const s = `%${(req.query.search || '').trim()}%`;
  const sql = `
    SELECT id,title,body,status,author,created_at
    FROM questions
    WHERE title LIKE ? OR body LIKE ?
    ORDER BY id DESC LIMIT 100`;
  db.query(sql, [s, s], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/api/qa', (req, res) => {
  const { title, body } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const author = req?.session?.user?.name || 'guest';
  db.query(
    `INSERT INTO questions (title, body, author) VALUES (?,?,?)`,
    [title, body || '', author],
    (err, r) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: r.insertId });
    }
  );
});

router.get('/api/qa/:id', (req, res) => {
  const id = req.params.id;
  db.query(`SELECT * FROM questions WHERE id=?`, [id], (e, q) => {
    if (e) return res.status(500).json({ error: e.message });
    if (!q.length) return res.status(404).json({ error: 'not found' });
    db.query(`SELECT * FROM answers WHERE question_id=? ORDER BY id`, [id], (e2, a) => {
      if (e2) return res.status(500).json({ error: e2.message });
      res.json({ question: q[0], answers: a });
    });
  });
});

router.post('/api/qa/:id/answers', (req, res) => {
  const id = req.params.id;
  const body = (req.body.body || '').trim();
  if (!body) return res.status(400).json({ error: 'body is required' });
  const author = req?.session?.user?.name || 'admin';
  db.query(
    `INSERT INTO answers (question_id, body, author) VALUES (?,?,?)`,
    [id, body, author],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.query(`UPDATE questions SET status='answered' WHERE id=?`, [id], () =>
        res.status(201).json({ ok: true })
      );
    }
  );
});

module.exports = router;
