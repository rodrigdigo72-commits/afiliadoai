// ══════════════════════════════════════════════════════
// TELEGRAM BOT — Posta automaticamente no canal
// ══════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { token, chat_id, text, photo, parse_mode } = req.body;
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || token;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID   || chat_id;

  if (!BOT_TOKEN) return res.status(400).json({ error: "Configure TELEGRAM_BOT_TOKEN no Vercel" });
  if (!CHAT_ID)   return res.status(400).json({ error: "Configure TELEGRAM_CHAT_ID no Vercel" });

  try {
    let url, body;

    if (photo) {
      // Posta foto + legenda
      url  = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
      body = { chat_id: CHAT_ID, photo, caption: text, parse_mode: parse_mode || "Markdown" };
    } else {
      // Posta só texto
      url  = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      body = { chat_id: CHAT_ID, text, parse_mode: parse_mode || "Markdown" };
    }

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();

    if (!data.ok) return res.status(400).json({ error: data.description || "Erro Telegram" });
    return res.status(200).json({ success: true, message_id: data.result?.message_id });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
