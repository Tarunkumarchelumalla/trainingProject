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
    const { imageBase64, productBase64, prompt, size } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "imageBase64 is required" });
    }

    // --- helper to strip base64 prefix and convert to buffer ---
    function base64ToBuffer(base64Str, fallbackMime = "image/png") {
      let mimeType = fallbackMime;
      let rawBase64 = base64Str;

      const match = base64Str.match(/^data:(.+);base64,(.*)$/);
      if (match) {
        mimeType = match[1]; // e.g. image/jpeg, image/png
        rawBase64 = match[2];
      }
      return { buffer: Buffer.from(rawBase64, "base64"), mimeType };
    }

    // Convert main image
    const { buffer: mainBuffer, mimeType: mainMime } = base64ToBuffer(imageBase64);

    // Build multipart form-data
    const formData = new FormData();
    formData.append("model", "gpt-image-1");
    formData.append("image", mainBuffer, `image.${mainMime.split("/")[1]}`);
    formData.append("prompt", prompt || "Edit this image");
    formData.append("size", size || "1024x1792");

    // If productBase64 provided, add it as a mask or secondary image
    if (productBase64) {
      const { buffer: productBuffer, mimeType: productMime } = base64ToBuffer(productBase64);
      formData.append("image", productBuffer, `product.${productMime.split("/")[1]}`);
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

    // Return generated image(s)
    res.json(response.data);
  } catch (err) {
    console.error("Error editing image:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
