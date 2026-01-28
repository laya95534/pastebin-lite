require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { nanoid } = require("nanoid");
const { Redis } = require("@upstash/redis");

const app = express();
app.use(cors());
app.use(express.json());

/* ---------------- REDIS ---------------- */
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL.trim(),
  token: process.env.UPSTASH_REDIS_REST_TOKEN.trim(),
});

/* ---------------- TIME HELPER ---------------- */
function now(req) {
  if (process.env.TEST_MODE === "1" && req.headers["x-test-now-ms"]) {
    return Number(req.headers["x-test-now-ms"]);
  }
  return Date.now();
}

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

  if (!content || typeof content !== "string") {
    return res.status(400).json({ error: "content required" });
  }
  if (ttl_seconds && (!Number.isInteger(ttl_seconds) || ttl_seconds < 1)) {
    return res.status(400).json({ error: "invalid ttl_seconds" });
  }
  if (max_views && (!Number.isInteger(max_views) || max_views < 1)) {
    return res.status(400).json({ error: "invalid max_views" });
  }

  const id = nanoid(6);
  const expiresAt = ttl_seconds ? now(req) + ttl_seconds * 1000 : null;

  await redis.hset(`paste:${id}`, {
    content,
    expiresAt: expiresAt || "",
    remainingViews: max_views || "",
  });

  const base = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;

  res.json({
    id,
    url: `${base}/p/${id}`,
  });
});

/* ---------------- FETCH PASTE (API) ---------------- */
app.get("/api/pastes/:id", async (req, res) => {
  const key = `paste:${req.params.id}`;
  const data = await redis.hgetall(key);

  if (!data.content) return res.status(404).json({ error: "Not found" });

  const current = now(req);

  // TTL check
  if (data.expiresAt && current > Number(data.expiresAt)) {
    return res.status(404).json({ error: "Expired" });
  }

  let remaining = null;

  // View limit check
  if (data.remainingViews) {
    const views = Number(data.remainingViews);
    if (views <= 0) return res.status(404).json({ error: "Views exceeded" });

    remaining = views - 1;
    await redis.hset(key, { remainingViews: remaining });
  }

  res.json({
    content: data.content,
    remaining_views: remaining,
    expires_at: data.expiresAt
      ? new Date(Number(data.expiresAt)).toISOString()
      : null,
  });
});

/* ---------------- VIEW PASTE (HTML) ---------------- */
app.get("/p/:id", async (req, res) => {
  const key = `paste:${req.params.id}`;
  const data = await redis.hgetall(key);

  if (!data.content) return res.status(404).send("Not found");

  const current = now(req);

  if (data.expiresAt && current > Number(data.expiresAt)) {
    return res.status(404).send("Expired");
  }

  if (data.remainingViews) {
    const views = Number(data.remainingViews);
    if (views <= 0) return res.status(404).send("Views exceeded");

    await redis.hset(key, { remainingViews: views - 1 });
  }

  // Safe render (no script execution)
  res.send(`<pre>${data.content.replace(/</g, "&lt;")}</pre>`);
});

/* ---------------- SERVER START ---------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on", PORT));
