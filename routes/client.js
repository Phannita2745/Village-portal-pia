const express = require('express');
const router = express.Router();

router.get('/client', (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const sqlNews = 'SELECT news_id AS id, title, content, date, image FROM news ORDER BY date DESC LIMIT 4';
  const sqlActs = 'SELECT activity_id AS id, title, date, location, image FROM activity ORDER BY date ASC LIMIT 4';
  const sqlReports = 'SELECT * FROM report ORDER BY date DESC LIMIT 3';

  db.query(sqlNews, (err, news) => {
    if (err) throw err;
    db.query(sqlActs, (err2, activities) => {
      if (err2) throw err2;
      db.query(sqlReports, (err3, reports) => {
        if (err3) throw err3;
        res.render('pages/homepage-client', {
          user: req.session.user,
          news,
          activities,
          reports
        });
      });
    });
  });
});

module.exports = router;
