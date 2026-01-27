const express = require("express");
const cors = require("cors");
const { nanoid } = require("nanoid");

const app = express();
app.use(cors());
app.use(express.json());

/* HOME ROUTE */
app.get("/", (req, res) => {
  res.send("Pastebin Lite API Running 🚀");
});

/* STORAGE */
const pastes = {};

/* CREATE PASTE */
app.post("/pastes", (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  const id = nanoid(6);
  pastes[id] = text;

 res.json({ id, url: `${req.protocol}://${req.get("host")}/pastes/${id}` });
});

/* GET PASTE */
app.get("/pastes/:id", (req, res) => {
  const paste = pastes[req.params.id];

  if (!paste) {
    return res.status(404).json({ error: "Paste not found" });
  }

  res.send(paste);
});

/* START SERVER */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
