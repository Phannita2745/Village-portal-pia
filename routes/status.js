const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// GET /status
router.get("/", async (req, res) => {
  try {
    const statuses = await prisma.status.findMany({
      select: {
        name: true, // only get "name" field
      },
    });

    res.render("status/index", { statuses });
  } catch (err) {
    console.error("Error fetching status:", err);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
