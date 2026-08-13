// ══════════════════════════════════════════════════════
// AUTO-POST — Processa fila e posta automaticamente
// Chamado pelo cron do Vercel a cada 1 hora
// ══════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TG_CHAT  = process.env.TELEGRAM_CHAT_ID;

  try {
    const { items } = req.body || {};
    if (!items?.length) {
      return res.status(200).json({ ok: true, posted: 0, message: "Fila vazia" });
    }

    const now = new Date();
    const results = [];

    for (const item of items) {
      // Check if it's time to post
      const due = new Date(item.scheduledAt);
      const diffMin = (now - due) / 1000 / 60;

      // Post if due within last 90 minutes
      if (diffMin < 0 || diffMin > 90) {
        results.push({ id: item.id, status: "skipped", reason: `not due yet (${Math.round(diffMin)}min)` });
        continue;
      }

      // Auto-post to Telegram if configured
      if (item.platform === "telegram" && TG_TOKEN && TG_CHAT) {
        try {
          const tgUrl = item.thumb
            ? `https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`
            : `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;

          const tgBody = item.thumb
            ? { chat_id: TG_CHAT, photo: item.thumb, caption: item.text, parse_mode: "Markdown" }
            : { chat_id: TG_CHAT, text: item.text, parse_mode: "Markdown" };

          const tgRes = await fetch(tgUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tgBody),
          });
          const tgData = await tgRes.json();
          results.push({
            id: item.id,
            status: tgData.ok ? "posted" : "error",
            platform: "telegram",
            message_id: tgData.result?.message_id,
            error: tgData.description,
          });
        } catch (e) {
          results.push({ id: item.id, status: "error", platform: "telegram", error: e.message });
        }
      } else {
        // For other platforms — mark as "ready" (user will post manually with 1 tap)
        results.push({ id: item.id, status: "ready", platform: item.platform });
      }
    }

    const posted = results.filter(r => r.status === "posted").length;
    const ready  = results.filter(r => r.status === "ready").length;

    return res.status(200).json({
      ok: true,
      posted,
      ready,
      total: items.length,
      results,
      timestamp: now.toISOString(),
    });

  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
