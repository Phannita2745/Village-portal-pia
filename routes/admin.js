const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// ตั้งค่าความยาวขั้นต่ำของรหัสผ่าน (ปรับเป็น 6 ได้ถ้าต้องการ)
const MIN_PASS = 8;

/** มิดเดิลแวร์ตรวจสิทธิ์แอดมิน */
function ensureAdmin(req, res, next) {
  const u = req.session && req.session.user;
  if (u && (u.role === "admin" || u.isAdmin === true || u.privilege_id === 1)) {
    return next();
  }
  return res.redirect("/admin/login");
}

/** GET /admin/login – หน้าเข้าสู่ระบบผู้ดูแล */
router.get("/login", (req, res) => {
  return res.render("pages/admin-login", {
    title: "เข้าสู่ระบบผู้ดูแลระบบ",
    error: null,
  });
});

/** POST /admin/login – ตรวจสอบข้อมูลเข้าสู่ระบบผู้ดูแล */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.member.findFirst({
      where: { email },
      select: {
        id: true,
        username: true,
        password: true,
        privilege_id: true,
        status_id: true,
        tel: true,
        email: true,
      },
    });

    if (!user) {
      return res.status(401).render("pages/admin-login", {
        title: "เข้าสู่ระบบผู้ดูแลระบบ",
        error: "ไม่พบบัญชีผู้ใช้",
      });
    }

    const isAdmin = user.privilege_id === 1;
    if (!isAdmin) {
      return res.status(403).render("pages/admin-login", {
        title: "เข้าสู่ระบบผู้ดูแลระบบ",
        error: "บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ",
      });
    }

    let passOK = false;
    try {
      passOK = await bcrypt.compare(password, user.password);
    } catch {
      passOK = password === user.password;
    }

    if (!passOK) {
      return res.status(401).render("pages/admin-login", {
        title: "เข้าสู่ระบบผู้ดูแลระบบ",
        error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
      });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      privilege_id: user.privilege_id,
      role: "admin",
      isAdmin: true,
    };

    return res.redirect("/admin");
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).render("pages/admin-login", {
      title: "เข้าสู่ระบบผู้ดูแลระบบ",
      error: "เกิดข้อผิดพลาดภายในระบบ",
    });
  }
});

/** GET /admin/logout – ออกจากระบบผู้ดูแล */
router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

/** GET /admin/register – ฟอร์มสมัครผู้ดูแลระบบ */
router.get("/register", (req, res) => {
  res.render("pages/admin-register", {
    title: "สมัครผู้ดูแลระบบ",
    error: null,
    success: null,
    values: {},
  });
});

/** POST /admin/register – บันทึกผู้ดูแลระบบใหม่ */
router.post("/register", async (req, res) => {
  const { firstName, lastName, tel, email, password, confirm, invite } = req.body;

  const needInvite =
    process.env.ADMIN_INVITE_CODE && process.env.ADMIN_INVITE_CODE.trim().length > 0;
  const invitedOK = !needInvite || invite === process.env.ADMIN_INVITE_CODE;

  // ตรวจข้อมูลบังคับ
  if (!firstName || !lastName || !tel || !email || !password || !confirm) {
    return res.status(400).render("pages/admin-register", {
      title: "สมัครผู้ดูแลระบบ",
      error:
        "กรอกข้อมูลให้ครบถ้วน (ชื่อ-นามสกุล, เบอร์โทร, อีเมล, รหัสผ่าน และยืนยันรหัสผ่าน)",
      success: null,
      values: { firstName, lastName, tel, email, invite },
    });
  }

  if (password.length < MIN_PASS) {
    return res.status(400).render("pages/admin-register", {
      title: "สมัครผู้ดูแลระบบ",
      error: `รหัสผ่านอย่างน้อย ${MIN_PASS} ตัวอักษร`,
      success: null,
      values: { firstName, lastName, tel, email, invite },
    });
  }

  if (password !== confirm) {
    return res.status(400).render("pages/admin-register", {
      title: "สมัครผู้ดูแลระบบ",
      error: "รหัสผ่านยืนยันไม่ตรงกัน",
      success: null,
      values: { firstName, lastName, tel, email, invite },
    });
  }

  if (!invitedOK) {
    return res.status(403).render("pages/admin-register", {
      title: "สมัครผู้ดูแลระบบ",
      error: "โค้ดเชิญไม่ถูกต้อง",
      success: null,
      values: { firstName, lastName, tel, email, invite: "" },
    });
  }

  try {
    // กันอีเมลซ้ำ
    const existed = await prisma.member.findFirst({ where: { email } });
    if (existed) {
      return res.status(409).render("pages/admin-register", {
        title: "สมัครผู้ดูแลระบบ",
        error: "อีเมลนี้ถูกใช้งานแล้ว",
        success: null,
        values: { firstName, lastName, tel, email: "", invite },
      });
    }

    // รวมชื่อ-นามสกุลเก็บที่ฟิลด์ username
    const username = `${firstName.trim()} ${lastName.trim()}`;
    const hash = await bcrypt.hash(password, 10);

    await prisma.member.create({
      data: {
        username,
        tel,
        email,
        password: hash,
        privilege_id: 1, // admin
        status_id: 1, // ปรับตามระบบของคุณ (1 = active)
      },
    });

    return res.status(201).render("pages/admin-register", {
      title: "สมัครผู้ดูแลระบบ",
      error: null,
      success: "สมัครสำเร็จ! เข้าสู่ระบบได้เลย",
      values: {},
    });
  } catch (err) {
    console.error("Admin register error:", err);
    return res.status(500).render("pages/admin-register", {
      title: "สมัครผู้ดูแลระบบ",
      error: "เกิดข้อผิดพลาดภายในระบบ",
      success: null,
      values: { firstName, lastName, tel, email, invite },
    });
  }
});

/** GET /admin – ต้องเป็นแอดมินเท่านั้น (ตัวอย่าง: รายการสมาชิก) */
router.get("/", ensureAdmin, async (req, res) => {
  try {
    const members = await prisma.member.findMany({
      select: {
        id: true,
        username: true,
        password: true,
        privilege_id: true,
        status_id: true,
        tel: true,
        email: true,
      },
    });

    res.render("member/list", { members });
  } catch (err) {
    console.error("Error fetching members:", err);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
