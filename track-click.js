// ══════════════════════════════════════════════════════
// TRACK CLICK — Encurtador com rastreamento real de cliques
// Redireciona e salva: plataforma, device, hora, IP hash
// ══════════════════════════════════════════════════════
export default async function handler(req, res) {
  const { id, url, platform } = req.query;

  if (!url) return res.status(400).json({ error: "url required" });

  // Build click data
  const ua = req.headers["user-agent"] || "";
  const device = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";
  const browser = /chrome/i.test(ua) ? "chrome" : /safari/i.test(ua) ? "safari" : /firefox/i.test(ua) ? "firefox" : "other";
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "";
  // Hash IP for privacy
  const ipHash = ip.split(".").slice(0,3).join(".") + ".x";

  const click = {
    link_id: id || "unknown",
    platform: platform || "direct",
    device,
    browser,
    ip_hash: ipHash,
    clicked_at: new Date().toISOString(),
    referrer: req.headers.referer || "direct",
  };

  // Save to Supabase if configured
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_ANON_KEY;

  if (SB_URL && SB_KEY) {
    try {
      await fetch(`${SB_URL}/rest/v1/clicks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SB_KEY,
          "Authorization": `Bearer ${SB_KEY}`,
        },
        body: JSON.stringify(click),
      });
    } catch(e) { /* non-blocking */ }
  }

  // Redirect to actual URL
  const target = decodeURIComponent(url);
  res.setHeader("Location", target);
  res.setHeader("Cache-Control", "no-store");
  return res.status(302).end();
}
