require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { nanoid } = require("nanoid");
const { Redis } = require("@upstash/redis");

const app = express();
app.use(cors());
app.use(express.json());

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function now(req) {
  if (process.env.TEST_MODE === "1" && req.headers["x-test-now-ms"]) {
    return Number(req.headers["x-test-now-ms"]);
  }
  return Date.now();
}

app.get("/api/healthz", async (req, res) => {
  try {
    await redis.ping();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

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

  res.json({
    id,
    url: `${process.env.BASE_URL}/p/${id}`,
  });
});

app.get("/api/pastes/:id", async (req, res) => {
  const data = await redis.hgetall(`paste:${req.params.id}`);
  if (!data.content) return res.status(404).json({ error: "Not found" });

  const current = now(req);

  if (data.expiresAt && current > Number(data.expiresAt)) {
    return res.status(404).json({ error: "Expired" });
  }

  if (data.remainingViews) {
    const views = Number(data.remainingViews);
    if (views <= 0) return res.status(404).json({ error: "Views exceeded" });
    await redis.hset(`paste:${req.params.id}`, { remainingViews: views - 1 });
  }

  res.json({
    content: data.content,
    remaining_views: data.remainingViews ? Number(data.remainingViews) - 1 : null,
    expires_at: data.expiresAt ? new Date(Number(data.expiresAt)).toISOString() : null,
  });
});

app.get("/p/:id", async (req, res) => {
  const data = await redis.hgetall(`paste:${req.params.id}`);
  if (!data.content) return res.status(404).send("Not found");

  res.send(`<pre>${data.content.replace(/</g, "&lt;")}</pre>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on", PORT));
