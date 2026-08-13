// ══════════════════════════════════════════════════════
// AI AUTOFILL — ARIA gera fila automática via Groq
// 100% GRÁTIS — sem limite de uso
// ══════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const KEY = process.env.GROQ_API_KEY;
  if (!KEY) return res.status(400).json({ error: "Configure GROQ_API_KEY no Vercel" });

  try {
    const { links, platforms, days, startDate, intervalMinutes } = req.body;
    if (!links?.length) return res.status(400).json({ error: "Nenhum link fornecido" });

    const STORE_RULES = {
      ml:  "Mercado Livre: #publi obrigatório. Não prometer preço falso.",
      amz: "Amazon: #ad obrigatório. Usar apenas links amzn.to.",
      shp: "Shopee: #ShopeeAfiliado recomendado.",
      shn: "Shein: #ad obrigatório.",
      tmu: "Temu: #parceria obrigatório.",
    };

    const PLATFORM_RULES = {
      tiktok:    "máx 150 chars, hook nos 3s, 3-5 hashtags",
      instagram: "#publi obrigatório, link na bio, emojis",
      youtube:   "descrição completa, link afiliado no início",
      facebook:  "texto conversacional, não colocar link no texto",
      kwai:      "texto curto, emojis agressivos, CTA urgente",
      telegram:  "markdown aceito, pode ser mais longo",
      twitter:   "máx 260 chars, 1-2 hashtags",
    };

    const totalPosts = Math.min(days * platforms.length, 25);

    const prompt = `Você é a ARIA, especialista em marketing de afiliados no Brasil. Gere uma fila de posts otimizados.

PRODUTOS:
${links.map((l,i) => `${i+1}. ${l.productName} | ${l.storeName} | ${l.price||"N/A"} | ${l.originalUrl}`).join("\n")}

PLATAFORMAS: ${platforms.join(", ")}
TOTAL DE POSTS: ${totalPosts}

REGRAS DAS LOJAS:
${links.map(l => STORE_RULES[l.storeId] || `${l.storeName}: #publi obrigatório`).filter((v,i,a)=>a.indexOf(v)===i).join("\n")}

REGRAS DAS PLATAFORMAS:
${platforms.map(p => `${p}: ${PLATFORM_RULES[p]||"texto adequado"}`).join("\n")}

RESPONDA APENAS COM JSON VÁLIDO, sem texto antes ou depois, sem markdown:
{"posts":[{"platform":"tiktok","linkIndex":0,"text":"texto aqui","hook":"hook 3s","bestTime":"20:00","note":"motivo"}],"strategy":"estratégia em 1 frase"}

Gere exatamente ${totalPosts} posts únicos. Varie estilos (urgência, benefício, curiosidade). Respeite TODAS as regras.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 4000,
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Você é ARIA, especialista em afiliados. Responda APENAS com JSON válido conforme solicitado. Sempre em português do Brasil." },
          { role: "user", content: prompt }
        ]
      })
    });

    const result = await response.json();
    if (result.error) return res.status(400).json({ error: result.error.message });

    const text = result.choices?.[0]?.message?.content || "{}";
    let parsed;
    try { parsed = JSON.parse(text); }
    catch(e) { return res.status(500).json({ error: "Erro ao processar JSON da IA", raw: text.slice(0,200) }); }

    const start = startDate ? new Date(startDate) : new Date();
    const queueItems = (parsed.posts || []).map((post, i) => {
      const [h, m] = (post.bestTime || "20:00").split(":").map(Number);
      const scheduled = new Date(start);
      scheduled.setDate(scheduled.getDate() + Math.floor(i / platforms.length));
      scheduled.setHours(h, m + (i % platforms.length) * (parseInt(intervalMinutes)||60), 0, 0);
      const link = links[post.linkIndex] || links[0];
      return {
        id: Date.now().toString() + i,
        linkId: link?.id || "",
        productName: link?.productName || "Produto",
        platform: post.platform,
        scheduledAt: scheduled.toISOString(),
        text: post.text,
        hook: post.hook,
        status: "pending",
        createdAt: new Date().toISOString(),
        note: post.note || "",
        aiGenerated: true,
      };
    });

    return res.status(200).json({ queue: queueItems, strategy: parsed.strategy || "", total: queueItems.length });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
