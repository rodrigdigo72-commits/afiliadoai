// ============================================================
// /api/create-video.js — Vercel Serverless Function
// Criação de vídeo via JSON2Video
// Compatível com AfiliadoAI PRO
// ============================================================
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Usa env var do Vercel — mais seguro que passar do frontend
  const J2V_KEY = process.env.JSON2VIDEO_API_KEY || req.body?.apiKey;
  if (!J2V_KEY) return res.status(500).json({ error: "JSON2VIDEO_API_KEY não configurada no Vercel" });

  try {
    const { payload } = req.body;
    if (!payload) return res.status(400).json({ error: "payload obrigatório" });

    const j2vRes = await fetch("https://api.json2video.com/v2/movies", {
      method: "POST",
      headers: {
        "x-api-key": J2V_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await j2vRes.json();
    if (data.error) return res.status(400).json({ error: data.error });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
