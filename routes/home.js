const express = require('express');
const router = express.Router();

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
                qrs: qrs || [],
                loginError: null,     // กัน error
                loginNotice: null,    // 👈 ต้องมี comma ตรงนี้
                // default stats
                totalVisits: 0,
                todayVisits: 0,
                siteOpened: '-',
                lastUpdated: '-'
              });
            }
          );
        }
      );
    }
  );
});

module.exports = router;
