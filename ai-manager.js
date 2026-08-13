// ══════════════════════════════════════════════════════
// AI MANAGER — ARIA powered by Groq (100% GRÁTIS)
// Modelos: llama-3.3-70b-versatile (melhor) ou mixtral
// Documentação: https://console.groq.com/docs
// ══════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const KEY = process.env.GROQ_API_KEY;
  if (!KEY) return res.status(400).json({ error: "Configure GROQ_API_KEY no Vercel — grátis em console.groq.com" });

  try {
    const { mode, data } = req.body;

    const SYSTEM = `# SISTEMA DE REGRAS — ARIA (Advanced Revenue Intelligence Assistant)

Você é ARIA — IA profissional especializada em marketing de afiliados no Brasil, criação de conteúdo, SEO e divulgação ética de produtos.

Você combina expertise em:
- Marketing de afiliados (Mercado Livre, Amazon, Shopee, Shein, Hotmart, Monetizze)
- Conteúdo viral para TikTok, Instagram, YouTube, Facebook, Kwai, Telegram, X
- SEO para Google, YouTube e redes sociais
- Análise de performance e otimização de conversão
- Tendências de consumo no mercado brasileiro
- Psicologia do consumidor e copywriting profissional

REGRAS OBRIGATÓRIAS:
✅ Criar conteúdo original e com linguagem natural e humana
✅ Produzir títulos atrativos sem exageros
✅ Gerar SEO otimizado com palavras-chave relevantes
✅ Adicionar CTA moderado e profissional
✅ Explicar benefícios reais do produto
✅ Inserir aviso de afiliado (#publi, #ad, #parceria)
✅ Seguir diretrizes do Google, YouTube e redes sociais

PROIBIÇÕES:
❌ Nunca prometer ganhos irreais ou resultados garantidos
❌ Nunca criar fake reviews ou informações falsas
❌ Nunca burlar políticas de plataformas
❌ Nunca criar conteúdo enganoso

COMUNICAÇÃO:
- Fale como consultora sênior de R$500/hora
- Seja direta, objetiva e orientada a resultados
- Use dados e números sempre que possível
- Responda SEMPRE em português do Brasil
- Use markdown para organizar respostas
- Máximo 500 palavras para manter foco`;

    let userMessage = "";
    let maxTokens = 1024;

    switch(mode) {
      case "full_audit":
        maxTokens = 1500;
        userMessage = `Faça uma auditoria completa do meu app de afiliados:

DADOS:
- Cliques: ${data.stats?.cliques || 0}
- Vendas: ${data.stats?.vendas || 0}
- Comissão: R$ ${(data.stats?.comissao || 0).toFixed(2)}
- Conversão: ${data.stats?.cliques > 0 ? ((data.stats?.vendas/data.stats?.cliques)*100).toFixed(1) : 0}%
- Links: ${data.links?.length || 0}
- Vídeos: ${data.videos?.length || 0}
- Posts na fila: ${data.queue?.length || 0}

LINKS ATIVOS:
${(data.links||[]).map(l=>`- ${l.productName} | ${l.storeName} | ${l.price||"N/A"} | ${l.clicks||0} cliques`).join("\n")||"Nenhum"}

Me dê:
1. **Diagnóstico geral** (nota 0-10)
2. **Maiores problemas** que estão me custando dinheiro
3. **3 quick wins** para fazer HOJE
4. **Plano de 30 dias** com metas realistas
5. **Alertas** de riscos`;
        break;

      case "analyze_offer":
        maxTokens = 1200;
        userMessage = `Analise esta oferta de afiliado:

Produto: ${data.productName}
Loja: ${data.storeName}
Preço: ${data.price || "não informado"}
Comissão: ${data.commission || data.commRate || "não informada"}
Cliques: ${data.clicks || 0}
Link: ${data.originalUrl}

Me dê:
1. **SCORE 0-10** com justificativa
2. **Público-alvo** ideal
3. **Top 3 plataformas** para promover (com horário ideal)
4. **3 hooks virais** de abertura (máx 10 palavras cada)
5. **Alertas** e riscos`;
        break;

      case "dashboard_insights":
        maxTokens = 1000;
        userMessage = `Analise meu dashboard:
- Cliques: ${data.stats?.cliques || 0}
- Vendas: ${data.stats?.vendas || 0}
- Comissão: R$ ${(data.stats?.comissao || 0).toFixed(2)}
- Conversão: ${data.stats?.cliques>0?((data.stats?.vendas/data.stats?.cliques)*100).toFixed(1):0}%
- Links: ${data.links?.length || 0}

Top links:
${(data.links||[]).sort((a,b)=>(b.clicks||0)-(a.clicks||0)).slice(0,3).map(l=>`- ${l.productName}: ${l.clicks||0} cliques`).join("\n")||"Nenhum"}

Dê insights acionáveis: o que está funcionando, o que melhorar, meta realista para 30 dias e 3 ações de alto impacto.`;
        break;

      case "optimize_text":
        maxTokens = 800;
        userMessage = `Otimize este texto para ${data.platform}:

Produto: ${data.productName}
Preço: ${data.price || ""}
Texto: ${data.text}

Crie:
1. **Versão A** — foco em URGÊNCIA
2. **Versão B** — foco em BENEFÍCIO
3. **Dica exclusiva** para converter mais no ${data.platform}

Respeite as regras da plataforma (${data.platform === "twitter" ? "máx 260 chars" : data.platform === "tiktok" ? "máx 150 chars visíveis, hashtags relevantes" : "hashtags, #publi obrigatório"}).`;
        break;

      case "generate_content_plan":
        maxTokens = 1500;
        userMessage = `Crie um plano de conteúdo de 7 dias:

Produtos:
${(data.links||[]).slice(0,5).map(l=>`- ${l.productName} (${l.storeName}${l.price?", "+l.price:""})`).join("\n")||"Nenhum produto ainda"}

Plataformas: ${data.platforms?.join(", ")||"TikTok, Instagram, YouTube, Facebook, Kwai, Telegram, X"}

Para cada dia: produto, plataforma, formato, horário exato, hook de 3s e objetivo (cliques/vendas/seguidores).
Ao final: estratégia da semana em 1 frase.`;
        break;

      case "chat":
      default:
        maxTokens = 800;
        userMessage = `${data.message}

Contexto do app:
- Links: ${data.context?.links || 0}
- Cliques: ${data.context?.cliques || 0}
- Comissão: R$ ${(data.context?.comissao || 0).toFixed(2)}
- Vendas: ${data.context?.vendas || 0}`;
        break;
    }

    // Call Groq API
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: maxTokens,
        temperature: 0.7,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMessage }
        ]
      })
    });

    const result = await response.json();
    if (result.error) return res.status(400).json({ error: result.error.message });
    const text = result.choices?.[0]?.message?.content || "Sem resposta";
    return res.status(200).json({ response: text, mode, model: "llama-3.3-70b" });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
