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
    const { imageBase64, maskBase64, prompt, size } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "imageBase64 is required" });
    }

    // --- Helper function to parse base64 ---
    const parseBase64 = (b64, defaultMime = "image/png") => {
      let mimeType = defaultMime;
      let base64Data = b64;

      const match = b64.match(/^data:(.+);base64,(.*)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
      return { buffer: Buffer.from(base64Data, "base64"), mimeType };
    };

    // Convert main image
    const { buffer: imageBuffer, mimeType: imageMime } = parseBase64(imageBase64);

    // Build multipart form-data
    const formData = new FormData();
    formData.append("model", "gpt-image-1");
    formData.append("image", imageBuffer, `image.${imageMime.split("/")[1]}`);
    formData.append("prompt", prompt || "Edit this image");
    formData.append("size", size || "1024x1024");

    // If mask is provided, attach it
    if (maskBase64) {
      const { buffer: maskBuffer, mimeType: maskMime } = parseBase64(maskBase64);
      formData.append("mask", maskBuffer, `mask.${maskMime.split("/")[1]}`);
    }

    // Send to OpenAI API
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

    res.json(response.data);
  } catch (err) {
    console.error("Error editing image:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
