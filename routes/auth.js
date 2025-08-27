const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const util = require('util');

// ใช้ db จาก global (ประกาศใน app.js)
const query = util.promisify(global.db.query).bind(global.db);

// ---------------------- LOGIN (สมาชิก) ----------------------
// GET: หน้าเข้าสู่ระบบสมาชิก
router.get('/login', (req, res) => {
  res.render('pages/login', { error: null });
});

// POST: เข้าสู่ระบบด้วย "เบอร์โทร + รหัสผ่าน"
router.post('/login', async (req, res) => {
  const { tel, password } = req.body;

  try {
    // หา user ด้วยเบอร์โทร
    const rows = await query('SELECT * FROM users WHERE tel = ? LIMIT 1', [tel]);
    const user = rows && rows[0];

    if (!user) {
      return res.status(401).render('pages/login', { error: 'ไม่พบบัญชีผู้ใช้จากเบอร์นี้' });
    }

    // ตรวจรหัสผ่าน (รองรับทั้ง hash และ plaintext เพื่อความเข้ากันได้)
    let ok = false;
    try {
      ok = await bcrypt.compare(password, user.password);
    } catch {
      ok = password === user.password;
    }
    if (!ok) {
      return res.status(401).render('pages/login', { error: 'รหัสผ่านไม่ถูกต้อง' });
    }

    // สำเร็จ -> เก็บ session แล้วพาไปหน้า member/home (ปรับ path ตามโปรเจ็กต์คุณ)
    req.session.user = user;
    return res.redirect('/client'); // หรือ '/' ถ้าต้องการ
  } catch (err) {
    console.error('member login error:', err);
    return res.status(500).render('pages/login', { error: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
});

// ออกจากระบบ
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ---------------------- REGISTER (สมาชิก) ----------------------
const MIN_PASS = 8; // เปลี่ยนเป็น 6 ได้ถ้าต้องการ

// GET: หน้า สมัครสมาชิก
router.get('/register', (req, res) => {
  res.render('pages/register', {
    title: 'สมัครสมาชิก',
    error: null,
    success: null,
    values: {}
  });
});

// POST: สมัครสมาชิกใหม่
router.post('/register', async (req, res) => {
  const { firstName, lastName, tel, email, password, confirm } = req.body;

  // ตรวจข้อมูลบังคับ
  if (!firstName || !lastName || !tel || !password || !confirm) {
    return res.status(400).render('pages/register', {
      title: 'สมัครสมาชิก',
      error: 'กรอกข้อมูลให้ครบถ้วน (ชื่อ-นามสกุล, เบอร์โทร, รหัสผ่าน, ยืนยันรหัสผ่าน)',
      success: null,
      values: { firstName, lastName, tel, email }
    });
  }
  if (password.length < MIN_PASS) {
    return res.status(400).render('pages/register', {
      title: 'สมัครสมาชิก',
      error: `รหัสผ่านอย่างน้อย ${MIN_PASS} ตัวอักษร`,
      success: null,
      values: { firstName, lastName, tel, email }
    });
  }
  if (password !== confirm) {
    return res.status(400).render('pages/register', {
      title: 'สมัครสมาชิก',
      error: 'รหัสผ่านยืนยันไม่ตรงกัน',
      success: null,
      values: { firstName, lastName, tel, email }
    });
  }

  try {
    // กันเบอร์ซ้ำ
    const existedTel = await query('SELECT id FROM users WHERE tel = ? LIMIT 1', [tel]);
    if (existedTel.length) {
      return res.status(409).render('pages/register', {
        title: 'สมัครสมาชิก',
        error: 'เบอร์โทรนี้ถูกใช้งานแล้ว',
        success: null,
        values: { firstName, lastName, tel: '', email }
      });
    }
    // กันอีเมลซ้ำ (ถ้ามีกรอก)
    if (email) {
      const existedEmail = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      if (existedEmail.length) {
        return res.status(409).render('pages/register', {
          title: 'สมัครสมาชิก',
          error: 'อีเมลนี้ถูกใช้งานแล้ว',
          success: null,
          values: { firstName, lastName, tel, email: '' }
        });
      }
    }

    const username = `${firstName.trim()} ${lastName.trim()}`;
    const hash = await bcrypt.hash(password, 10);

    // NOTE: ตาราง users ควรมีคอลัมน์: id, username, tel, email, password (อย่างน้อย)
    await query(
      'INSERT INTO users (username, tel, email, password) VALUES (?, ?, ?, ?)',
      [username, tel, email || null, hash]
    );

    return res.status(201).render('pages/register', {
      title: 'สมัครสมาชิก',
      error: null,
      success: 'สมัครสำเร็จ! เข้าสู่ระบบได้เลย',
      values: {}
    });
  } catch (err) {
    console.error('member register error:', err);
    return res.status(500).render('pages/register', {
      title: 'สมัครสมาชิก',
      error: 'เกิดข้อผิดพลาดภายในระบบ',
      success: null,
      values: { firstName, lastName, tel, email }
    });
  }
});

module.exports = router;
