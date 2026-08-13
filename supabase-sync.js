// ══════════════════════════════════════════════════════
// SUPABASE SYNC — Banco de dados real na nuvem
// Salva links, cliques, comissões e configurações
// ══════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,apikey,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SB_URL || !SB_KEY) {
    return res.status(200).json({ ok: false, error: "Supabase não configurado — usando localStorage" });
  }

  const headers = {
    "Content-Type": "application/json",
    "apikey": SB_KEY,
    "Authorization": `Bearer ${SB_KEY}`,
    "Prefer": "return=representation"
  };

  try {
    const { action, table, data, user_id, filter } = req.body || req.query;

    let url = `${SB_URL}/rest/v1/${table}`;
    let method = "GET";
    let body = null;

    switch(action) {
      case "save":
        // Upsert — insert or update
        method = "POST";
        body = JSON.stringify(Array.isArray(data) ? data : [data]);
        headers["Prefer"] = "resolution=merge-duplicates,return=representation";
        break;
      case "load":
        url += `?user_id=eq.${user_id}&order=created_at.desc&limit=100`;
        method = "GET";
        break;
      case "delete":
        url += `?id=eq.${filter?.id}&user_id=eq.${user_id}`;
        method = "DELETE";
        break;
      case "stats":
        url = `${SB_URL}/rest/v1/rpc/get_user_stats`;
        method = "POST";
        body = JSON.stringify({ p_user_id: user_id });
        break;
    }

    const r = await fetch(url, { method, headers, body });
    const result = method === "DELETE" ? { deleted: true } : await r.json();
    return res.status(200).json({ ok: true, data: result });

  } catch(e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
