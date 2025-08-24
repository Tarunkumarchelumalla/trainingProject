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

app.post('/erase-image', async (req, res) => {
  try {
    const formData = new FormData();

    // Convert base64 → Blob
    const imageBlob = await fetch(req.imageBase64).then(res => res.blob());
    const maskBlob = await fetch(req.maskBase64).then(res => res.blob());

    formData.append("image", imageBlob, "image.png");
    formData.append("mask", maskBlob, "mask.png");
    formData.append("prompt", req.prompt);
    formData.append("size", req.size || "1024x1024");
    formData.append("response_format", "b64_json"); 

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, // 👈 your key
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`OpenAI API request failed: ${response.status}`);
    }

    const result = await response.json();

    if (!result.data || result.data.length === 0 ||  !result.data[0].b64_json) {
      throw new Error("Invalid response from OpenAI Image Edits API");
    }

    return `data:image/png;base64,${result.data[0].b64_json}`;
  } catch (error) {
    console.error("OpenAI Image Edits error:", error);
    throw new Error("Failed to edit image. Please try again.");
  }
})

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
