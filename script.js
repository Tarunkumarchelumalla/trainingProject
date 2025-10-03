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

app.post("/erase-image", async (req, res) => {
  try {
    console.log(req.body)
    const { imageBase64, maskBase64, size, prompt } = req.body;

    if (!imageBase64 || !maskBase64) {
      return res.status(400).json({ error: "imageBase64 and maskBase64 are required" });
    }

    const { buffer: imageBuffer, mimeType: imageMime } = parseBase64(imageBase64);
    const { buffer: maskBuffer, mimeType: maskMime } = parseBase64(maskBase64);

    const formData = new FormData();
    formData.append("image", imageBuffer, "image.png");
    formData.append("mask", maskBuffer, "mask.png");
    formData.append("prompt", prompt);
    formData.append("size", size);
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

    const data = await response.json();

    res.json({
      imageBase64: `data:image/png;base64,${data.data[0].b64_json}`,
    });
  } catch (error) {
    console.error("OpenAI Image Edits error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

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



app.post("/adkrity-text-heavy", async (req, res) => {
  try {
    const inputPayload = req.body;
    // Convert product images
    const productImagesBase64 = await Promise.all(
      (inputPayload.productImages || []).map(async (img) => {
        return await urlToBase64(img.url, img.mime);
      })
    );

    // Convert logo
    let logoBase64 = "";
    if (inputPayload.logo_url && inputPayload.logo_mime) {
      logoBase64 = await urlToBase64(
        inputPayload.logo_url,
        inputPayload.logo_mime
      );
    }

    // Build new payload
    const newPayload = {
      category: inputPayload.category,
      phone_number: inputPayload.phone_number || "",
      address: inputPayload.address || "",
      highlight_area: inputPayload.highlight_area || "",
      website: inputPayload.website,
      design_req: inputPayload.design_req,
      logo_url: logoBase64 || "",
      product_images: productImagesBase64 || [],
    };

    // ✅ Send to N8N webhook and wait for full response
    const response = await axios.post(
      "https://n8n.cinqa.space/webhook/7cfd8f0f-2d73-4ca8-8c1d-99cb4812b46b",
      newPayload,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 60000, // 60s timeout to avoid infinite hang
      }
    );

    console.log("📡 N8N Status:", response.status);
    console.log("📡 N8N Headers:", response.headers);
    console.log("✅ N8N Response Data:", response.data);

    res.json({
      status: "success",
      forwardedPayload: newPayload,
      response: response.data,
    });
  } catch (err) {
    console.error(
      "❌ Error in /adkrity-text-heavy:",
      err.response?.data || err.message
    );
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

async function urlToBase64(url, mime) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${mime};base64,${base64}`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
