const express = require("express");
const cors = require("cors");
const { nanoid } = require("nanoid");

const app = express();
app.use(cors());
app.use(express.json());
app.get("/", (req, res) => {
  res.send("Pastebin Lite API Running 🚀");
});


const pastes = {};

app.get("/", (req, res) => {
  res.send("Pastebin Lite API is running 🚀");
});

app.post("/pastes", (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  const id = nanoid(6);
  pastes[id] = text;

  res.json({ id, url: `http://localhost:3000/pastes/${id}` });
});

app.get("/pastes/:id", (req, res) => {
  const paste = pastes[req.params.id];

  if (!paste) {
    return res.status(404).json({ error: "Paste not found" });
  }

  res.send(paste);
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

