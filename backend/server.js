const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post("/analyze", async (req, res) => {
  const userPrompt = req.body.prompt;

  // Replace with your actual AI provider call
  const aiResponse = `Structured breakdown for: ${userPrompt}`;

  res.json({ result: aiResponse });
});

app.listen(5000, () => console.log("Server running on port 5000"));
