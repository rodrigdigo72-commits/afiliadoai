// ══════════════════════════════════════════════════════
// ANALYTICS — Relatório de cliques por produto/plataforma
// ══════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SB_URL || !SB_KEY) {
    return res.status(200).json({ ok: false, error: "Supabase não configurado", data: null });
  }

  try {
    const { link_id, days = 30 } = req.body || req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let url = `${SB_URL}/rest/v1/clicks?clicked_at=gte.${since}&order=clicked_at.desc&limit=500`;
    if (link_id) url += `&link_id=eq.${link_id}`;

    const r = await fetch(url, {
      headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` },
    });
    const clicks = await r.json();

    if (!Array.isArray(clicks)) return res.status(200).json({ ok: false, error: "No data", data: [] });

    // Aggregate
    const byPlatform = {};
    const byDevice   = {};
    const byDay      = {};
    const byLink     = {};

    clicks.forEach(c => {
      byPlatform[c.platform] = (byPlatform[c.platform] || 0) + 1;
      byDevice[c.device]     = (byDevice[c.device] || 0) + 1;
      const day = c.clicked_at?.slice(0, 10);
      if (day) byDay[day]   = (byDay[day] || 0) + 1;
      byLink[c.link_id]     = (byLink[c.link_id] || 0) + 1;
    });

    return res.status(200).json({
      ok: true,
      total: clicks.length,
      byPlatform,
      byDevice,
      byDay,
      byLink,
      raw: clicks.slice(0, 50),
    });

  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
