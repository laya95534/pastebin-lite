require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { redis } = require("./redis");

const app = express();
app.use(cors());
app.use(express.json());

/* ---------------- HEALTH CHECK ---------------- */
app.get("/api/healthz", async (req, res) => {
  try {
    await redis.ping();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

/* ---------------- CREATE PASTE ---------------- */
app.post("/api/pastes", async (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;

  if (!content || typeof content !== "string" || content.trim() === "")
    return res.status(400).json({ error: "content is required" });

  if (ttl_seconds && (!Number.isInteger(ttl_seconds) || ttl_seconds < 1))
    return res.status(400).json({ error: "invalid ttl_seconds" });

  if (max_views && (!Number.isInteger(max_views) || max_views < 1))
    return res.status(400).json({ error: "invalid max_views" });

  const id = crypto.randomBytes(4).toString("hex");
  const now = Date.now();
  const expires_at = ttl_seconds ? now + ttl_seconds * 1000 : null;

  await redis.hset(`paste:${id}`, {
    content,
    remaining_views: max_views || "",
    expires_at: expires_at || ""
  });

  res.json({ id, url: `/p/${id}` });
});

/* ---------------- FETCH PASTE (API) ---------------- */
app.get("/api/pastes/:id", async (req, res) => {
  const id = req.params.id;
  const paste = await redis.hgetall(`paste:${id}`);

  if (!paste.content) return res.status(404).json({ error: "not found" });

  const now = req.headers["x-test-now-ms"]
    ? Number(req.headers["x-test-now-ms"])
    : Date.now();

  if (paste.expires_at && now > Number(paste.expires_at))
    return res.status(404).json({ error: "expired" });

  if (paste.remaining_views) {
    let views = Number(paste.remaining_views);
    if (views <= 0) return res.status(404).json({ error: "view limit reached" });

    await redis.hset(`paste:${id}`, "remaining_views", views - 1);
    paste.remaining_views = views - 1;
  }

  res.json({
    content: paste.content,
    remaining_views: paste.remaining_views || null,
    expires_at: paste.expires_at || null
  });
});

/* ---------------- HTML VIEW ---------------- */
app.get("/p/:id", async (req, res) => {
  const id = req.params.id;
  const paste = await redis.hgetall(`paste:${id}`);

  if (!paste.content) return res.status(404).send("Not found");

  res.send(`<pre>${paste.content}</pre>`);
});

/* ---------------- START SERVER ---------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running", PORT));
