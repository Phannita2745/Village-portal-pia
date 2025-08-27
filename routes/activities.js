const express = require('express');
const router = express.Router();

// หน้ารายการกิจกรรม
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
    item.displayDateTime = `${new Date(item.date).toLocaleDateString('th-TH', {
      year: 'numeric', month: 'long', day: 'numeric'
    })} เวลา ${item.time || ''}`;
    item.viewsPlus = 0; // (ไม่มี field views ในฐานข้อมูลเดิม)

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

module.exports = router;
