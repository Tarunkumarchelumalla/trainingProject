// script.js
import express from "express";
import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json({ limit: "50mb" })); // allow big base64 payloads

app.post("/edit-image", async (req, res) => {
  try {
    const { imageBase64, prompt, size } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "imageBase64 is required" });
    }

    // Extract MIME type if present (e.g. data:image/png;base64,...)
    let mimeType = "image/png";
    let base64Data = imageBase64;

    const match = imageBase64.match(/^data:(.+);base64,(.*)$/);
    if (match) {
      mimeType = match[1]; // e.g. image/jpeg, image/png, image/webp
      base64Data = match[2]; // strip "data:...base64," prefix
    }

    // Convert base64 string to Buffer
    const buffer = Buffer.from(base64Data, "base64");

    // Build multipart form-data
    const formData = new FormData();
    formData.append("model", "gpt-image-1");
    formData.append("image", buffer, `image.${mimeType}`);
    formData.append("prompt", prompt || "Edit this image");
    formData.append("size", size || "1024x1536");

    console.log({formData})
    // return
    // Send to OpenAI API using axios
    const response = await axios.post(
      "https://api.openai.com/v1/images/edits",
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders(),
        },
      }
    );

    // Return generated image(s)
    res.json(response.data);
  } catch (err) {
    console.error("Error editing image:", err.response?.data || err.message);
    res
      .status(500)
      .json({ error: err.response?.data || err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
