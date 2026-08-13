// ============================================================
// /api/check-video.js  — Vercel Serverless Function
// Polling do status de renderização JSON2Video
// Compatível com AfiliadoAI PRO
// ============================================================

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const J2V_KEY = process.env.JSON2VIDEO_API_KEY;
  if (!J2V_KEY) return res.status(500).json({ error: "JSON2VIDEO_API_KEY não configurada" });

  const { project_id } = req.query;
  if (!project_id) return res.status(400).json({ error: "project_id obrigatório" });

  try {
    const j2vRes = await fetch(
      `https://api.json2video.com/v2/movies?project=${project_id}`,
      { headers: { "x-api-key": J2V_KEY } }
    );
    const data = await j2vRes.json();

    // JSON2Video retorna movie com status: "done" | "rendering" | "error"
    const movie = data.movie || {};
    return res.status(200).json({
      status: movie.status || "rendering",
      url: movie.url || null,
      thumbnail: movie.thumbnail || null,
      duration: movie.duration || null,
      project_id,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
