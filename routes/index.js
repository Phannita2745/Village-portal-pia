const express = require('express');
const router = express.Router();

/* ---------- Auth & Pages ---------- */

// Login pages
router.get('/login', (req, res) => res.render('pages/login'));

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.query(
    'SELECT * FROM users WHERE email = ? AND password = ?',
    [email, password],
    (err, results) => {
      if (err) throw err;
      if (results.length > 0) {
        req.session.user = results[0];
        return res.redirect('/client');
      }
      res.send('❌ Login ผิดพลาด');
    }
  );
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Client page (protected)
router.get('/client', (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const sqlNews =
    'SELECT news_id AS id, title, content, date, image FROM news ORDER BY date DESC LIMIT 4';
  const sqlActs =
    'SELECT activity_id AS id, title, date, location, image FROM activity ORDER BY date ASC LIMIT 4';
  const sqlReports =
    'SELECT * FROM report ORDER BY date DESC LIMIT 3';

  db.query(sqlNews, (err, news) => {
    if (err) throw err;
    db.query(sqlActs, (err2, activities) => {
      if (err2) throw err2;
      db.query(sqlReports, (err3, reports) => {
        if (err3) throw err3;
        res.render('pages/homepage-client', {
          user: req.session.user,
          news,        // มีฟิลด์ id แน่นอน
          activities,  // มีฟิลด์ id แน่นอน
          reports
        });
      });
    });
  });
});

/* ---------- Q&A APIs ---------- */

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

/* ---------- Home (with social_qr) ---------- */

router.get('/', (req, res) => {
  db.query(
    'SELECT news_id AS id, title, content, date, image FROM news ORDER BY date DESC LIMIT 4',
    (err, news) => {
      if (err) return res.status(500).send(err.message);

      db.query(
        'SELECT activity_id AS id, title, date, location, image FROM activity ORDER BY date ASC LIMIT 4',
        (err2, activities) => {
          if (err2) return res.status(500).send(err2.message);

          db.query(
            'SELECT id, platform, label, image, link FROM social_qr ORDER BY sort, id',
            (err3, qrs) => {
              if (err3) return res.status(500).send(err3.message);

              console.log('QRs from DB (%d):', (qrs || []).length);
              res.render('pages/home', {
                user: req.session.user || null,
                news,
                activities,
                qrs: qrs || []
              });
            }
          );
        }
      );
    }
  );
});

/* ---------- ข่าวประชาสัมพันธ์ ---------- */

// รายการข่าวทั้งหมด
function fmtTH(d) {
  return new Date(d).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

// รายการข่าวทั้งหมด
router.get('/news', (req, res) => {
  const sql = `
    SELECT news_id AS id, title, content, date, image
    FROM news
    ORDER BY date DESC, news_id DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).send(err.message);

    const items = (rows || []).map(r => ({
      ...r,
      displayDate: fmtTH(r.date)
    }));

    res.render('pages/news', { title: 'ข่าวประชาสัมพันธ์', items });
  });
});

// รายละเอียดข่าว + ข่าวที่เกี่ยวข้อง + ปุ่มก่อนหน้า/ถัดไป
router.get('/news/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).send('รหัสข่าวไม่ถูกต้อง');

  // 1) ข่าวปัจจุบัน
  const sqlItem = `
    SELECT news_id AS id, title, content, date, image
    FROM news
    WHERE news_id = ?
  `;
  db.query(sqlItem, [id], (err, rs) => {
    if (err) return res.status(500).send(err.message);
    if (!rs.length) return res.status(404).send('ไม่พบข่าวที่ต้องการ');

    const item = rs[0];
    item.displayDate = fmtTH(item.date);
    item.body = item.content || '';

    // 2) ข่าวที่เกี่ยวข้อง (ล่าสุด 4 ชิ้น ยกเว้นตัวเอง)
    const sqlRelated = `
      SELECT news_id AS id, title, content, date, image
      FROM news
      WHERE news_id <> ?
      ORDER BY date DESC, news_id DESC
      LIMIT 4
    `;
    db.query(sqlRelated, [id], (e2, relRows) => {
      if (e2) return res.status(500).send(e2.message);

      const related = (relRows || []).map(r => ({
        ...r,
        displayDate: fmtTH(r.date)
      }));

      // 3) ปุ่มก่อนหน้า/ถัดไป
      // ใช้ tie-breaker ด้วย news_id เพื่อกันปัญหาวันเดียวกันหลายข่าว
      const sqlPrev = `
        SELECT news_id AS id, title, date
        FROM news
        WHERE (date < ?)
           OR (date = ? AND news_id < ?)
        ORDER BY date DESC, news_id DESC
        LIMIT 1
      `;
      const sqlNext = `
        SELECT news_id AS id, title, date
        FROM news
        WHERE (date > ?)
           OR (date = ? AND news_id > ?)
        ORDER BY date ASC, news_id ASC
        LIMIT 1
      `;

      db.query(sqlPrev, [item.date, item.date, id], (e3, prevRows) => {
        if (e3) return res.status(500).send(e3.message);

        db.query(sqlNext, [item.date, item.date, id], (e4, nextRows) => {
          if (e4) return res.status(500).send(e4.message);

          const nav = {
            prev: prevRows?.[0]
              ? { ...prevRows[0], displayDate: fmtTH(prevRows[0].date) }
              : null,
            next: nextRows?.[0]
              ? { ...nextRows[0], displayDate: fmtTH(nextRows[0].date) }
              : null
          };

          res.render('pages/news-detail-v2', {
            title: item.title,
            item,
            related: related || [],
            nav: nav || null
          });
        });
      });
    });
  });
});

/* ---------- หน้ารายการกิจกรรม ---------- */
router.get('/activities', (req, res) => {
  const sql = `
    SELECT a.activity_id AS id,
           a.title, a.date, a.time, a.location, a.image,
           COALESCE(COUNT(p.id), 0) AS photo_count
    FROM activity a
    LEFT JOIN activity_photos p ON p.activity_id = a.activity_id
    GROUP BY a.activity_id
    ORDER BY a.date DESC, a.activity_id DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.render('pages/activities', {
      title: 'ภาพกิจกรรม',
      items: rows || []
    });
  });
});

// รายละเอียดกิจกรรม
router.get('/activities/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).send('รหัสกิจกรรมไม่ถูกต้อง');

  const sqlItem = `
    SELECT activity_id AS id, title, description, date, time, location, image
    FROM activity
    WHERE activity_id = ?`;

  const sqlPhotos = `
    SELECT id, image_path
    FROM activity_photos
    WHERE activity_id = ?
    ORDER BY sort, id`;

  db.query(sqlItem, [id], (err, result) => {
    if (err) return res.status(500).send(err.message);
    if (!result.length) return res.status(404).send('ไม่พบกิจกรรม');

    const item = result[0];
    // ฟอร์แมตวันที่เวลาแบบไทย
    item.displayDateTime = `${new Date(item.date).toLocaleDateString('th-TH', {
      year: 'numeric', month: 'long', day: 'numeric'
    })} เวลา ${item.time || ''}`;
    item.viewsPlus = 0; // ตอนนี้คุณยังไม่มี field views

    db.query(sqlPhotos, [id], (err2, photos) => {
      if (err2) return res.status(500).send(err2.message);
      res.render('pages/activity-detail', {
        title: item.title,
        item,
        photos
      });
    });
  });
});

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


/* ---------- export ต้องอยู่ท้ายไฟล์ ---------- */
module.exports = router;
