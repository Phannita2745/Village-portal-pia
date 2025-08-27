const express = require('express');
const router = express.Router();

// helper ฟอร์แมตวันที่ภาษาไทย
function fmtTH(d) {
  return new Date(d).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

// ----------------- รายการข่าวทั้งหมด -----------------
router.get('/news', (req, res) => {
  const q = (req.query.q || '').trim();
  const sort = (req.query.sort || 'latest').trim(); 
  // latest | oldest | popular

  // WHERE เฉพาะถ้ามีคำค้น
  const where = [];
  const params = [];
  if (q) {
    where.push(`(title LIKE ? OR content LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // ORDER BY ตามตัวเลือก
  let orderSql = `ORDER BY date DESC, news_id DESC`; // เริ่มต้น: ล่าสุด -> เก่าสุด
  if (sort === 'oldest') {
    orderSql = `ORDER BY date ASC, news_id ASC`;
  } else if (sort === 'popular') {
    orderSql = `ORDER BY COALESCE(views, 0) DESC, date DESC, news_id DESC`;
  }

  const sql = `
    SELECT news_id AS id, title, content, date, image, COALESCE(views, 0) AS views
    FROM news
    ${whereSql}
    ${orderSql}
  `;

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).send(err.message);

    const items = (rows || []).map(r => ({
      ...r,
      displayDate: fmtTH(r.date)
    }));

    res.render('pages/news', { 
      title: 'ข่าวประชาสัมพันธ์', 
      items, 
      q, 
      sort 
    });
  });
});

// ----------------- รายละเอียดข่าว + related + prev/next -----------------
router.get('/news/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).send('รหัสข่าวไม่ถูกต้อง');

  const sqlItem = `
    SELECT news_id AS id, title, content, date, image, COALESCE(views,0) AS views
    FROM news
    WHERE news_id = ?
  `;
  db.query(sqlItem, [id], (err, rs) => {
    if (err) return res.status(500).send(err.message);
    if (!rs.length) return res.status(404).send('ไม่พบข่าวที่ต้องการ');

    const item = rs[0];
    item.displayDate = fmtTH(item.date);
    item.body = item.content || '';

    // เพิ่มยอดวิว
    db.query(`UPDATE news SET views = COALESCE(views,0) + 1 WHERE news_id = ?`, [id]);

    // ข่าวที่เกี่ยวข้อง
    const sqlRelated = `
      SELECT news_id AS id, title, content, date, image, COALESCE(views,0) AS views
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

      // prev / next
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

module.exports = router;
