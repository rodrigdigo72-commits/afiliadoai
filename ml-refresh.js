// ══════════════════════════════════════════════════════
// MERCADO LIVRE — Refresh Token automático
// Renova o access token antes de expirar (6h)
// ══════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const CLIENT_ID     = process.env.ML_CLIENT_ID;
  const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
  const REDIRECT_URI  = process.env.ML_REDIRECT_URI;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(400).json({
      error: "Configure ML_CLIENT_ID e ML_CLIENT_SECRET no Vercel"
    });
  }

  const { refresh_token, code } = req.body;

  try {
    let body;

    if (code) {
      // Troca code por access_token + refresh_token (primeiro login OAuth)
      body = new URLSearchParams({
        grant_type:   "authorization_code",
        client_id:    CLIENT_ID,
        client_secret:CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI || "",
      });
    } else if (refresh_token) {
      // Renova access_token usando refresh_token
      body = new URLSearchParams({
        grant_type:    "refresh_token",
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token,
      });
    } else {
      return res.status(400).json({ error: "Envie code ou refresh_token" });
    }

    const r = await fetch("https://api.mercadolibre.com/oauth/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body:    body.toString(),
    });

    const data = await r.json();

    if (data.error) {
      return res.status(400).json({ error: data.error_description || data.error });
    }

    // Retorna novos tokens + expiração
    return res.status(200).json({
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_in:    data.expires_in,       // segundos (21600 = 6h)
      expires_at:    Date.now() + (data.expires_in * 1000),
      token_type:    data.token_type,
      user_id:       data.user_id,
    });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
