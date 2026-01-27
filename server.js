const express = require("express");
const cors = require("cors");
const { nanoid } = require("nanoid");

const app = express();
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ type: '*/*' }));
app.use(express.urlencoded({ extended: true }));

// Home route
app.get("/", (req, res) => {
  res.send("Pastebin Lite API Running 🚀");
});

const pastes = {};

// Create paste
app.post("/pastes", (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  const id = nanoid(6);
  pastes[id] = text;

  res.json({
    id,
    url: `https://pastebin-lite-txi.onrender.com/pastes/${id}`
  });
});

// View paste
app.get("/pastes/:id", (req, res) => {
  const paste = pastes[req.params.id];

  if (!paste) {
    return res.status(404).json({ error: "Paste not found" });
  }

  res.send(paste);
});

module.exports = app;

