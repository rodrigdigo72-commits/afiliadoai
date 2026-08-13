import { useState, useEffect, useCallback } from "react";

// ══════════════════════════════════════════════════════
// STORAGE — localStorage com fallback seguro
// ══════════════════════════════════════════════════════
const KEY = "afiliadoai_final_v1";
const load = () => { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

const EMPTY = {
  user: null,
  links: [],
  videos: [],
  scripts: [],
  stats: { cliques: 0, vendas: 0, comissao: 0 },
  connectedAccounts: {},
  bestTimes: { tiktok:"20:00", instagram:"19:30", youtube:"21:00", facebook:"18:00", kwai:"21:00", telegram:"10:00", twitter:"12:00" },
  settings: { notif: true, ai: true },
  customStores: [],
  connectedStores: {},
  queue: [],
  postLogs: [],
  mlTokens: null,
  storeConfigs: {},
  clickHistory: [],
  monthlyEarnings: [],
  linkScores: {},
  telegramBot: { token:"", chatId:"", active:false },
};

// ══════════════════════════════════════════════════════
// MERCADO LIVRE — busca pública sem token
// ══════════════════════════════════════════════════════
async function fetchProductML(url, accessToken) {
  try {
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
    const idMatch = url.match(/MLB-?(\d+)/i);
    if (idMatch) {
      const r = await fetch(`https://api.mercadolibre.com/items/MLB${idMatch[1]}`, { headers });
      const d = await r.json();
      if (d.title) return {
        name: d.title, price: d.price,
        priceStr: `R$ ${d.price.toFixed(2).replace(".", ",")}`,
        thumb: (d.pictures?.[0]?.url || d.thumbnail || "").replace("I.jpg","O.jpg"),
        sold: d.sold_quantity || 0,
      };
    }
    const r2 = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(url)}&limit=1`, { headers });
    const d2 = await r2.json();
    const item = d2.results?.[0];
    if (item) return {
      name: item.title, price: item.price,
      priceStr: `R$ ${item.price.toFixed(2).replace(".", ",")}`,
      thumb: (item.thumbnail || "").replace("I.jpg","O.jpg"),
      sold: item.sold_quantity || 0,
    };
  } catch {}
  return null;
}

// ══════════════════════════════════════════════════════
// LOJAS — com logos reais
// ══════════════════════════════════════════════════════
const STORES = [
  { id:"ml",  name:"Mercado Livre", color:"#FFE600", commission:0.08, favicon:"https://www.mercadolivre.com.br/favicon.ico" },
  { id:"amz", name:"Amazon",        color:"#FF9900", commission:0.10, favicon:"https://www.amazon.com.br/favicon.ico" },
  { id:"shp", name:"Shopee",        color:"#EE4D2D", commission:0.12, favicon:"https://shopee.com.br/favicon.ico" },
  { id:"shn", name:"Shein",         color:"#E91E8C", commission:0.15, favicon:"https://www.shein.com.br/favicon.ico" },
  { id:"tmu", name:"Temu",          color:"#FF5722", commission:0.09, favicon:"https://www.temu.com/favicon.ico" },
  { id:"nat", name:"Natura",        color:"#00A86B", commission:0.14, favicon:"https://www.natura.com.br/favicon.ico" },
  { id:"bot", name:"O Boticário",   color:"#4CAF50", commission:0.13, favicon:"https://www.boticario.com.br/favicon.ico" },
  { id:"cac", name:"Cacau Show",    color:"#8B4513", commission:0.11, favicon:"https://www.cacaushow.com.br/favicon.ico" },
  { id:"per", name:"Pernambucanas", color:"#E53935", commission:0.07, favicon:"https://www.pernambucanas.com.br/favicon.ico" },
];

function buildTrackedUrl(linkId, originalUrl, platform = "direct") {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const encoded = encodeURIComponent(originalUrl);
  return `${base}/api/track-click?id=${linkId}&url=${encoded}&platform=${platform}`;
}

function detectStore(url) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes("meli.la") || u.includes("mercadolivre") || u.includes("mlb")) return STORES[0];
  if (u.includes("amazon") || u.includes("amzn")) return STORES[1];
  if (u.includes("shopee")) return STORES[2];
  if (u.includes("shein")) return STORES[3];
  if (u.includes("temu")) return STORES[4];
  if (u.includes("natura.com")) return STORES[5];
  if (u.includes("boticario")) return STORES[6];
  if (u.includes("cacaushow")) return STORES[7];
  if (u.includes("pernambucanas")) return STORES[8];
  return null;
}

// ══════════════════════════════════════════════════════
// PLATAFORMAS SOCIAIS
// ══════════════════════════════════════════════════════
const PLATFORMS = [
  { id:"tiktok",    name:"TikTok",    icon:"🎵", color:"#FF0050", url:"https://www.tiktok.com/upload",         rule:"Usar #publi ou #ad obrigatório" },
  { id:"instagram", name:"Instagram", icon:"📸", color:"#E91E8C", url:"https://www.instagram.com/create/story", rule:"#publi obrigatório. Link na bio." },
  { id:"youtube",   name:"YouTube",   icon:"▶️",  color:"#FF0000", url:"https://studio.youtube.com",            rule:"Avisar link afiliado na descrição" },
  { id:"facebook",  name:"Facebook",  icon:"👤", color:"#1877F2", url:"https://www.facebook.com/reel/create",   rule:"Não impulsionar post com link afiliado" },
  { id:"kwai",      name:"Kwai",      icon:"🎬", color:"#FF6B00", url:"https://www.kwai.com/creator/upload",    rule:"Não prometer cashback falso" },
  { id:"telegram",  name:"Telegram",  icon:"✈️",  color:"#2AABEE", url:"https://web.telegram.org",              rule:"Não enviar spam em grupos" },
  { id:"twitter",   name:"X (Twitter)",icon:"𝕏", color:"#ffffff", url:"https://twitter.com/intent/tweet",      rule:"Máx 280 chars · Marcar #ad em posts pagos" },
];

// ══════════════════════════════════════════════════════
// DESIGN TOKENS
// ══════════════════════════════════════════════════════
const C = {
  bg:"#04060e", s1:"#090f1e", s2:"#0e1628", card:"#111827",
  b1:"#1a2540", b2:"#243354",
  neon:"#00ddb4", gold:"#f4a918", blue:"#4b8ef8",
  purple:"#9b72f7", red:"#f05c5c", orange:"#f48c42",
  wa:"#25D366", tg:"#2AABEE",
  t1:"#eef2f8", t2:"#8898b0", t3:"#3d526b",
};

const STYLES = `@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
  html,body,#root{min-height:100%;background:${C.bg};}
  body{font-family:'Outfit',sans-serif;color:${C.t1};overflow-x:hidden;}
  input,button,textarea,select{font-family:inherit;}
  ::-webkit-scrollbar{display:none;}
  @keyframes fu{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .fu{animation:fu .3s ease both;}
  .pulse{animation:pulse 2s infinite;}
`;
const Sty = () => <style>{STYLES}</style>;

// ══════════════════════════════════════════════════════
// UI PRIMITIVES
// ══════════════════════════════════════════════════════
const Spin = ({ size=18, color=C.neon }) => (
  <div style={{ width:size, height:size, border:`2px solid ${color}20`, borderTopColor:color, borderRadius:"50%", animation:"spin .7s linear infinite", flexShrink:0 }} />
);

const StoreLogo = ({ store, size=32 }) => {
  const [err, setErr] = useState(false);
  if (!store) return <div style={{ width:size, height:size, borderRadius:size*.28, background:C.b1, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*.5 }}>🏪</div>;
  return err
    ? <div style={{ width:size, height:size, borderRadius:size*.28, background:store.color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*.5 }}>🏪</div>
    : <img src={store.favicon} alt={store.name} onError={()=>setErr(true)} style={{ width:size, height:size, borderRadius:size*.28, objectFit:"contain", background:store.color+"15", padding:size*.08, flexShrink:0 }} />;
};

const ProductThumb = ({ thumb, store, size=44 }) => {
  const [err, setErr] = useState(false);
  const src = thumb ? `https://wsrv.nl/?url=${encodeURIComponent(thumb)}&w=${size*2}&h=${size*2}&fit=cover&output=jpg` : null;
  return (
    <div style={{ width:size, height:size, borderRadius:size*.25, overflow:"hidden", flexShrink:0, background:(store?.color||C.neon)+"18", border:`1px solid ${(store?.color||C.neon)}25`, display:"flex", alignItems:"center", justifyContent:"center" }}>
      {src && !err ? <img src={src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={()=>setErr(true)} /> : <StoreLogo store={store} size={size*.7} />}
    </div>
  );
};

const Chip = ({ c=C.neon, children, s={} }) => (
  <span style={{ background:c+"1a", border:`1px solid ${c}45`, color:c, borderRadius:7, padding:"2px 9px", fontSize:10, fontWeight:700, letterSpacing:.6, textTransform:"uppercase", ...s }}>{children}</span>
);

const Btn = ({ children, onClick, v="p", full, dis, s={} }) => {
  const V = {
    p:  { bg:`linear-gradient(135deg,${C.neon},${C.blue})`,    c:"#000", b:"none" },
    g:  { bg:`linear-gradient(135deg,${C.gold},${C.orange})`,  c:"#000", b:"none" },
    u:  { bg:`linear-gradient(135deg,${C.purple},${C.blue})`,  c:"#fff", b:"none" },
    r:  { bg:C.red+"1a",   c:C.red,  b:`1px solid ${C.red}40` },
    gh: { bg:"transparent", c:C.t2,  b:`1px solid ${C.b2}` },
    wa: { bg:C.wa+"1a",    c:C.wa,   b:`1px solid ${C.wa}40` },
    tg: { bg:C.tg+"1a",    c:C.tg,   b:`1px solid ${C.tg}40` },
  };
  const x = V[v]||V.p;
  return (
    <button onClick={dis?undefined:onClick} style={{ background:x.bg, border:x.b, borderRadius:12, padding:"11px 18px", color:x.c, fontWeight:700, fontSize:13, cursor:dis?"not-allowed":"pointer", opacity:dis?.5:1, width:full?"100%":undefined, transition:"opacity .15s", ...s }}>
      {children}
    </button>
  );
};

const Inp = ({ label, ph, val, set, type="text", mono, hint }) => (
  <div style={{ marginBottom:12 }}>
    {label && <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:5 }}>{label}</div>}
    <input type={type} placeholder={ph} value={val} onChange={e=>set(e.target.value)}
      style={{ width:"100%", background:C.s1, border:`1px solid ${C.b1}`, borderRadius:11, padding:"11px 13px", color:C.t1, fontSize:13, outline:"none", boxSizing:"border-box", fontFamily:mono?"'JetBrains Mono',monospace":"inherit" }}
      onFocus={e=>e.target.style.borderColor=C.neon+"70"} onBlur={e=>e.target.style.borderColor=C.b1} />
    {hint && <div style={{ color:C.t3, fontSize:10, marginTop:4 }}>{hint}</div>}
  </div>
);

const Card = ({ children, s={}, glow, onClick }) => (
  <div onClick={onClick} style={{ background:C.card, border:`1px solid ${glow?glow+"35":C.b1}`, borderRadius:18, padding:16, boxShadow:glow?`0 2px 24px ${glow}12`:"none", cursor:onClick?"pointer":undefined, ...s }}>
    {children}
  </div>
);

const Empty = ({ ico, title, desc, action }) => (
  <div style={{ textAlign:"center", padding:"32px 16px" }}>
    <div style={{ fontSize:44, opacity:.3, marginBottom:12 }}>{ico}</div>
    <div style={{ color:C.t2, fontWeight:700, fontSize:15, marginBottom:6 }}>{title}</div>
    <div style={{ color:C.t3, fontSize:12, lineHeight:1.7, marginBottom:action?16:0 }}>{desc}</div>
    {action}
  </div>
);

const Tog = ({ val, set }) => (
  <div onClick={()=>set(!val)} style={{ width:44, height:24, background:val?C.neon:C.b1, borderRadius:99, cursor:"pointer", position:"relative", transition:"background .3s", flexShrink:0 }}>
    <div style={{ width:18, height:18, background:"#fff", borderRadius:99, position:"absolute", top:3, left:val?23:3, transition:"left .3s" }} />
  </div>
);

// ══════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════
function Login({ onLogin }) {
  const [mode, setMode] = useState("in");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false); const [err, setErr] = useState("");

  const go = () => {
    if (!email.trim()||!pass.trim()) return setErr("Preencha e-mail e senha");
    if (mode==="up"&&!name.trim()) return setErr("Digite seu nome");
    setErr(""); setLoading(true);
    setTimeout(()=>{ setLoading(false); onLogin({ name:name||email.split("@")[0], email, id:email.replace(/[^a-z0-9]/gi,"_").toLowerCase(), at:new Date().toISOString() }); }, 900);
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <Sty />
      <div style={{ position:"fixed", top:-60, left:"50%", transform:"translateX(-50%)", width:380, height:380, borderRadius:"50%", background:`radial-gradient(circle,${C.neon}07,transparent 70%)`, pointerEvents:"none" }} />
      <div style={{ width:"100%", maxWidth:380 }} className="fu">
        <div style={{ textAlign:"center", marginBottom:44 }}>
          <div style={{ width:68, height:68, background:`linear-gradient(135deg,${C.neon},${C.blue})`, borderRadius:22, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, margin:"0 auto 16px", boxShadow:`0 8px 32px ${C.neon}40` }}>⚡</div>
          <div style={{ color:C.t1, fontWeight:900, fontSize:32, letterSpacing:-1 }}>AfiliadoAI</div>
          <span style={{ background:C.neon, color:"#000", fontSize:9, fontWeight:800, padding:"2px 10px", borderRadius:99, display:"inline-block", marginTop:6, letterSpacing:1.5 }}>PRO</span>
          <div style={{ color:C.t3, fontSize:12, marginTop:10 }}>Sistema profissional de afiliados com IA</div>
        </div>
        <div style={{ display:"flex", background:C.s1, border:`1px solid ${C.b1}`, borderRadius:14, padding:4, marginBottom:22 }}>
          {[["in","🔑 Entrar"],["up","✨ Criar Conta"]].map(([id,l])=>(
            <button key={id} onClick={()=>{setMode(id);setErr("");}} style={{ flex:1, padding:"10px 0", borderRadius:11, border:"none", background:mode===id?`linear-gradient(135deg,${C.neon},${C.blue})`:"transparent", color:mode===id?"#000":C.t3, fontWeight:700, fontSize:13, cursor:"pointer" }}>{l}</button>
          ))}
        </div>
        {mode==="up" && <Inp label="Seu nome" ph="Como posso te chamar?" val={name} set={setName} />}
        <Inp label="E-mail" ph="seu@email.com" val={email} set={setEmail} type="email" />
        <Inp label="Senha" ph="••••••••" val={pass} set={setPass} type="password" />
        {err && <div style={{ color:C.red, fontSize:12, textAlign:"center", marginBottom:10, padding:8, background:C.red+"15", borderRadius:8 }}>{err}</div>}
        <Btn full onClick={go} dis={loading} s={{ padding:"14px 0", fontSize:15, marginTop:4 }}>
          {loading ? <div style={{ display:"flex",gap:8,alignItems:"center",justifyContent:"center" }}><Spin size={16} color="#000"/>Aguarde...</div> : mode==="in"?"🚀 Entrar":"✅ Criar Conta"}
        </Btn>
        <div style={{ color:C.t3, fontSize:11, textAlign:"center", marginTop:16 }}>🔒 Dados salvos no dispositivo · 100% privado</div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════
// REGISTRAR VENDA — inspirado no Hotmart/Monetizze
// ══════════════════════════════════════════════════════
function RegisterSaleCard({ stats, updStats, links }) {
  const [show, setShow] = useState(false);
  const [val, setVal] = useState("");
  const [selLink, setSelLink] = useState("");
  const [saved, setSaved] = useState(false);

  const register = () => {
    const v = parseFloat(val.replace(",","."));
    if (!v || v <= 0) return;
    updStats({
      ...stats,
      vendas: stats.vendas + 1,
      comissao: stats.comissao + v,
    });
    // Track monthly earnings
    const month = new Date().toLocaleDateString("pt-BR", {month:"short", year:"2-digit"});
    const hist = [...(stats.monthlyEarnings||[])];
    const mi = hist.findIndex(h=>h.month===month);
    if (mi>=0) hist[mi].total += v;
    else hist.push({month, total:v});
    setSaved(true); setVal(""); setSelLink("");
    setTimeout(() => { setSaved(false); setShow(false); }, 2000);
  };

  return (
    <Card glow={C.gold} s={{ border:`1px solid ${C.gold}30` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ color:C.gold, fontWeight:700, fontSize:14 }}>💰 Registrar Comissão</div>
          <div style={{ color:C.t3, fontSize:11, marginTop:2 }}>Anote quando receber uma comissão</div>
        </div>
        <button onClick={()=>setShow(s=>!s)} style={{ background:show?C.s1:`linear-gradient(135deg,${C.gold},${C.orange})`, border:show?`1px solid ${C.b2}`:"none", borderRadius:99, padding:"7px 16px", color:show?C.t2:"#000", fontWeight:700, fontSize:12, cursor:"pointer" }}>
          {show?"✕ Fechar":"+ Registrar"}
        </button>
      </div>
      {show && (
        <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${C.b1}` }}>
          {saved ? (
            <div style={{ textAlign:"center", padding:"12px 0", color:C.neon, fontWeight:700, fontSize:15 }}>✅ Comissão registrada!</div>
          ) : (
            <>
              {links.length > 0 && (
                <div style={{ marginBottom:10 }}>
                  <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Produto (opcional)</div>
                  <select value={selLink} onChange={e=>setSelLink(e.target.value)} style={{ width:"100%", background:C.s1, border:`1px solid ${C.b1}`, borderRadius:10, padding:"9px 12px", color:selLink?C.t1:C.t3, fontSize:12, outline:"none" }}>
                    <option value="">Selecionar produto...</option>
                    {links.map(l=><option key={l.id} value={l.id}>{l.productName}{l.price?" — "+l.price:""}</option>)}
                  </select>
                </div>
              )}
              <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Valor da Comissão (R$) *</div>
              <div style={{ display:"flex", gap:8 }}>
                <input placeholder="Ex: 24,50" value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&register()}
                  style={{ flex:1, background:C.s1, border:`1px solid ${C.gold}40`, borderRadius:10, padding:"10px 12px", color:C.t1, fontSize:14, fontWeight:700, outline:"none" }}/>
                <button onClick={register} style={{ background:`linear-gradient(135deg,${C.gold},${C.orange})`, border:"none", borderRadius:10, padding:"0 20px", color:"#000", fontWeight:800, fontSize:14, cursor:"pointer" }}>✓</button>
              </div>
              <div style={{ color:C.t3, fontSize:10, marginTop:6 }}>O valor é adicionado ao total de comissões do Dashboard</div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}



// ══════════════════════════════════════════════════════
// PWA INSTALL PROMPT
// ══════════════════════════════════════════════════════
function PWAInstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [shown, setShown] = useState(false);

  useEffect(()=>{
    const handler = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return ()=>window.removeEventListener("beforeinstallprompt", handler);
  },[]);

  if (!prompt || shown) return null;

  return (
    <div style={{ position:"fixed", bottom:85, left:12, right:12, zIndex:100, background:`linear-gradient(135deg,${C.blue}20,${C.purple}15)`, border:`1px solid ${C.blue}40`, borderRadius:16, padding:"12px 14px", backdropFilter:"blur(14px)" }}>
      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
        <div style={{ width:38, height:38, borderRadius:10, background:`linear-gradient(135deg,${C.neon},${C.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>⚡</div>
        <div style={{ flex:1 }}>
          <div style={{ color:C.t1, fontWeight:700, fontSize:13 }}>Instalar AfiliadoAI</div>
          <div style={{ color:C.t3, fontSize:11 }}>Adicionar à tela inicial do celular</div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={()=>{ prompt.prompt(); setShown(true); }} style={{ background:`linear-gradient(135deg,${C.neon},${C.blue})`, border:"none", borderRadius:9, padding:"7px 14px", color:"#000", fontWeight:800, fontSize:12, cursor:"pointer" }}>Instalar</button>
          <button onClick={()=>setShown(true)} style={{ background:"none", border:`1px solid ${C.b1}`, borderRadius:9, padding:"7px 10px", color:C.t3, fontSize:12, cursor:"pointer" }}>✕</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// ML PROMOS CARD — Dashboard
// ══════════════════════════════════════════════════════
function MLPromosDash({ addLink }) {
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState([]);
  const [cat, setCat] = useState("eletro");
  const [saved, setSaved] = useState({});
  const [copied, setCopied] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const CATS = [
    { id:"eletro",  label:"📱 Eletrônicos", q:"smartphone notebook fone desconto" },
    { id:"moda",    label:"👗 Moda",         q:"roupa tenis sapato desconto" },
    { id:"casa",    label:"🏠 Casa",          q:"cozinha decoração casa desconto" },
    { id:"esporte", label:"⚽ Esportes",      q:"academia esporte fitness desconto" },
    { id:"beleza",  label:"💄 Beleza",        q:"perfume maquiagem skincare desconto" },
  ];

  const fetch_ = async (id) => {
    setLoading(true); setOffers([]);
    const q = CATS.find(x=>x.id===id)?.q || "desconto";
    try {
      const r = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(q)}&sort=relevance&limit=20`);
      const d = await r.json();
      const list = (d.results||[])
        .filter(i=>i.original_price&&i.original_price>i.price)
        .map(i=>({
          id:i.id, name:i.title, price:i.price,
          priceStr:"R$ "+i.price.toFixed(2).replace(".",","),
          originalStr:"R$ "+i.original_price.toFixed(2).replace(".",","),
          discount:Math.round(((i.original_price-i.price)/i.original_price)*100),
          thumb:(i.thumbnail||"").replace("I.jpg","O.jpg"),
          link:i.permalink,
          freeShip:i.shipping?.free_shipping||false,
          sold:i.sold_quantity||0,
          commission:(i.price*0.08).toFixed(2).replace(".",","),
        }))
        .filter(i=>i.discount>=5)
        .sort((a,b)=>b.discount-a.discount)
        .slice(0,8);
      setOffers(list);
    } catch(e){setOffers([]);}
    setLoading(false); setLoaded(true);
  };

  if(!loaded&&!loading) fetch_(cat);

  const save_ = (o) => {
    addLink({ id:Date.now().toString(), originalUrl:o.link, productName:o.name, thumb:o.thumb, price:o.priceStr, priceRaw:o.price, commission:"R$ "+o.commission, commRate:"8%", commVal:o.price*0.08, storeId:"ml", storeName:"Mercado Livre", storeColor:"#FFE600", clicks:0, createdAt:new Date().toISOString() });
    setSaved(s=>({...s,[o.id]:true}));
  };

  const copy_ = (o) => {
    navigator.clipboard?.writeText(o.link);
    setCopied(o.id); setTimeout(()=>setCopied(null),2000);
  };

  return (
    <Card s={{ padding:0, overflow:"hidden", border:"1px solid #FFE60025" }}>
      {/* Header */}
      <div style={{ padding:"14px 14px 10px", display:"flex", gap:10, alignItems:"center" }}>
        <div style={{ width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#FFE600,#FF9900)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>🛒</div>
        <div style={{ flex:1 }}>
          <div style={{ color:C.t1,fontWeight:800,fontSize:14 }}>Promoções ML</div>
          <div style={{ color:C.t3,fontSize:10,marginTop:1 }}>Mercado Livre · {loaded?"Atualizado agora":"Carregando..."}</div>
        </div>
        <button onClick={()=>fetch_(cat)} disabled={loading} style={{ background:"#FFE60018",border:"1px solid #FFE60040",borderRadius:10,padding:"6px 12px",color:"#FFE600",fontWeight:700,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:5 }}>
          {loading?<Spin size={12} color="#FFE600"/>:"🔄"} Atualizar
        </button>
      </div>
      {/* Categories */}
      <div style={{ display:"flex",gap:6,padding:"0 14px 10px",overflowX:"auto",scrollbarWidth:"none" }}>
        {CATS.map(x=>(
          <button key={x.id} onClick={()=>{setCat(x.id);fetch_(x.id);}} style={{ flexShrink:0,padding:"5px 12px",borderRadius:99,border:`1px solid ${cat===x.id?"#FFE600":"#1a2540"}`,background:cat===x.id?"#FFE60018":"transparent",color:cat===x.id?"#FFE600":C.t3,fontWeight:700,fontSize:10,cursor:"pointer",whiteSpace:"nowrap" }}>
            {x.label}
          </button>
        ))}
      </div>
      {/* Loading */}
      {loading&&<div style={{ textAlign:"center",padding:"24px 0" }}><Spin size={32} color="#FFE600"/><div style={{ color:C.t3,fontSize:12,marginTop:10 }}>Buscando promoções...</div></div>}
      {/* Products */}
      {!loading&&(offers||[]).map(o=>(
        <div key={o.id} style={{ borderTop:`1px solid ${C.b1}`,padding:"12px 14px" }}>
          <div style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
            <div style={{ width:64,height:64,borderRadius:10,overflow:"hidden",flexShrink:0,background:C.b1,display:"flex",alignItems:"center",justifyContent:"center" }}>
              {o.thumb?<img src={`https://wsrv.nl/?url=${encodeURIComponent(o.thumb)}&w=128&h=128&fit=cover`} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} onError={e=>e.target.style.display="none"}/>:<span style={{ fontSize:24 }}>🛒</span>}
            </div>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6 }}>
                <div style={{ color:C.t1,fontWeight:600,fontSize:12,lineHeight:1.4,flex:1,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden" }}>{o.name}</div>
                <div style={{ background:"#f05c5c",color:"#fff",fontSize:10,fontWeight:800,padding:"3px 7px",borderRadius:8,flexShrink:0 }}>-{o.discount}%</div>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:6,margin:"4px 0 2px" }}>
                <span style={{ color:"#00ddb4",fontWeight:900,fontSize:18 }}>{o.priceStr}</span>
                <span style={{ color:C.t3,fontSize:11,textDecoration:"line-through" }}>{o.originalStr}</span>
              </div>
              <div style={{ display:"flex",gap:5,flexWrap:"wrap",marginTop:4 }}>
                {o.freeShip&&<span style={{ background:"#00ddb418",border:"1px solid #00ddb430",color:"#00ddb4",fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:6 }}>FRETE GRÁTIS</span>}
                <span style={{ background:"#FFE60018",border:"1px solid #FFE60030",color:"#FFE600",fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:6 }}>💰 Comissão 8%</span>
                {o.sold>0&&<span style={{ color:C.t3,fontSize:9 }}>★ {o.sold} vendidos</span>}
              </div>
            </div>
          </div>
          <div style={{ display:"flex",gap:8,marginTop:10 }}>
            <button onClick={()=>save_(o)} disabled={saved[o.id]} style={{ flex:1,background:saved[o.id]?"#00ddb420":"linear-gradient(135deg,#FFE600,#FF9900)",border:"none",borderRadius:10,padding:"10px 0",color:saved[o.id]?"#00ddb4":"#000",fontWeight:800,fontSize:12,cursor:saved[o.id]?"default":"pointer" }}>
              {saved[o.id]?"✅ Adicionado":"+ Adicionar Link"}
            </button>
            <button onClick={()=>copy_(o)} style={{ background:copied===o.id?"#00ddb420":C.s1,border:`1px solid ${copied===o.id?"#00ddb440":C.b1}`,borderRadius:10,padding:"10px 14px",color:copied===o.id?"#00ddb4":C.t2,fontWeight:700,fontSize:12,cursor:"pointer",flexShrink:0 }}>
              {copied===o.id?"✅":"📋 Copiar"}
            </button>
          </div>
        </div>
      ))}
      {!loading&&loaded&&offers.length===0&&<div style={{ textAlign:"center",padding:"20px",color:C.t3,fontSize:12 }}>Nenhuma promoção encontrada. Tente outra categoria.</div>}
    </Card>
  );
}

// ══════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════
function Dashboard({ stats, links, videos, scripts, goTo, updStats, addLink, clickHistory }) {
  return (
    <div className="fu" style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {[
          { l:"Cliques",  v:stats.cliques,                     ico:"👆", c:C.neon },
          { l:"Links",    v:links.length,                      ico:"🔗", c:C.blue },
          { l:"Roteiros", v:scripts.length,                    ico:"📝", c:C.purple },
          { l:"Vídeos",   v:videos.length,                     ico:"🎬", c:C.orange },
        ].map(x=>(
          <Card key={x.l} glow={x.c} s={{ padding:"16px 14px" }}>
            <div style={{ fontSize:22, marginBottom:8 }}>{x.ico}</div>
            <div style={{ color:x.c, fontWeight:900, fontSize:24, letterSpacing:-.5 }}>{x.v}</div>
            <div style={{ color:C.t3, fontSize:10, marginTop:3, fontWeight:700, textTransform:"uppercase", letterSpacing:.8 }}>{x.l}</div>
          </Card>
        ))}
      </div>

      <Card glow={C.purple} s={{ background:`linear-gradient(135deg,${C.purple}12,${C.blue}08)`, border:`1px solid ${C.purple}35` }}>
        <div style={{ display:"flex", gap:14, alignItems:"center", marginBottom:12 }}>
          <div style={{ width:50, height:50, borderRadius:14, background:`linear-gradient(135deg,${C.purple},${C.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0, boxShadow:`0 4px 20px ${C.purple}40` }}>💰</div>
          <div style={{ flex:1 }}>
            <div style={{ color:C.t3, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8 }}>Comissão Total Gerada</div>
            <div style={{ color:C.purple, fontWeight:900, fontSize:32, letterSpacing:-1, marginTop:2 }}>R$ {stats.comissao.toFixed(2)}</div>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          <div style={{ background:"rgba(0,0,0,.3)", borderRadius:10, padding:"8px 10px", textAlign:"center" }}>
            <div style={{ color:C.neon, fontWeight:800, fontSize:18 }}>{stats.cliques}</div>
            <div style={{ color:C.t3, fontSize:9, marginTop:2, textTransform:"uppercase", letterSpacing:.6 }}>Cliques</div>
          </div>
          <div style={{ background:"rgba(0,0,0,.3)", borderRadius:10, padding:"8px 10px", textAlign:"center" }}>
            <div style={{ color:C.gold, fontWeight:800, fontSize:18 }}>{stats.vendas}</div>
            <div style={{ color:C.t3, fontSize:9, marginTop:2, textTransform:"uppercase", letterSpacing:.6 }}>Vendas</div>
          </div>
          <div style={{ background:"rgba(0,0,0,.3)", borderRadius:10, padding:"8px 10px", textAlign:"center" }}>
            <div style={{ color:C.blue, fontWeight:800, fontSize:18 }}>{links.length}</div>
            <div style={{ color:C.t3, fontSize:9, marginTop:2, textTransform:"uppercase", letterSpacing:.6 }}>Links</div>
          </div>
        </div>
      </Card>

      {links.length===0 ? (
        <Card s={{ border:`1px dashed ${C.b2}` }}>
          <Empty ico="🚀" title="Comece adicionando seu link!" desc="Cole o link meli.la/17XoYuZ na aba Links para começar a rastrear cliques e ganhar comissões." action={<Btn onClick={()=>goTo("Links")} s={{ padding:"10px 20px" }}>➜ Adicionar Link</Btn>} />
        </Card>
      ) : (
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ color:C.t1, fontWeight:700, fontSize:14 }}>🔗 Meus Links</div>
            <Chip>{links.length}</Chip>
          </div>
          {links.slice(0,3).map((l,i)=>(
            <div key={l.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:i<Math.min(links.length,3)-1?`1px solid ${C.b1}`:"none" }}>
              <ProductThumb thumb={l.thumb} store={STORES.find(s=>s.id===l.storeId)} size={36} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:C.t1, fontWeight:600, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.productName}</div>
                {l.price && <div style={{ color:C.neon, fontSize:11, marginTop:1, fontWeight:700 }}>{l.price}</div>}
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:C.neon, fontWeight:800, fontSize:16 }}>{l.clicks||0}</div>
                <div style={{ color:C.t3, fontSize:9 }}>cliques</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card s={{ background:`linear-gradient(135deg,${C.neon}08,${C.blue}06)`, border:`1px solid ${C.neon}20` }}>
        <div style={{ color:C.neon, fontWeight:700, fontSize:13, marginBottom:12 }}>⚡ Ações Rápidas</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <Btn onClick={()=>goTo("Links")} s={{ padding:"10px 0", fontSize:12 }}>🔗 Novo Link</Btn>
          <Btn onClick={()=>goTo("Mensagens")} v="wa" s={{ padding:"10px 0", fontSize:12 }}>💬 Mensagem</Btn>
          <Btn onClick={()=>goTo("Roteiros")} v="u" s={{ padding:"10px 0", fontSize:12 }}>📝 Roteiro</Btn>
          <Btn onClick={()=>{ goTo("Fila"); }} v="u" s={{ padding:"10px 0", fontSize:12, background:`linear-gradient(135deg,#9b72f7,#4b8ef8)` }}>🤖 Auto-Fila</Btn>
        </div>
      </Card>

      <RegisterSaleCard stats={stats} updStats={updStats} links={links} />

      {/* Streak de dias ativos */}
      {(clickHistory||[]).filter(h=>h.clicks>0).length > 0 && (
        <Card s={{ background:`linear-gradient(135deg,${C.orange}10,${C.gold}08)`, border:`1px solid ${C.gold}25` }}>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            <div style={{ fontSize:36 }}>🔥</div>
            <div style={{ flex:1 }}>
              <div style={{ color:C.gold, fontWeight:900, fontSize:22 }}>{(clickHistory||[]).filter(h=>h.clicks>0).length} dias ativos</div>
              <div style={{ color:C.t3, fontSize:11, marginTop:2 }}>Continue postando todo dia!</div>
            </div>
            <div style={{ background:`${C.gold}20`, border:`1px solid ${C.gold}30`, borderRadius:99, padding:"6px 14px" }}>
              <div style={{ color:C.gold, fontSize:11, fontWeight:700 }}>
                {(clickHistory||[]).filter(h=>h.clicks>0).length >= 7 ? "🏆 Semana Perfeita" : (clickHistory||[]).filter(h=>h.clicks>0).length >= 3 ? "🔥 Em Série" : "⚡ Iniciando"}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Gráfico de cliques */}
      <ClickChart clickHistory={clickHistory||[]} stats={stats} />

      {/* Promoções ML no Dashboard */}
      <MLPromosDash addLink={addLink} />
    </div>
  );
}

// ══════════════════════════════════════════════════════
// LINKS
// ══════════════════════════════════════════════════════
function Links({ links, addLink, updateLink, delLink, stats, updStats, goTo, setSelProd, mlTokens, setMlTokens }) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent"); // recent | clicks | commission
  const [url, setUrl] = useState(""); const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(""); const [result, setResult] = useState(null);
  const [showQR, setShowQR] = useState(null); const [copied, setCopied] = useState(null);

  const analyze = async () => {
    try {

    const u = url.trim(); if (!u) return;
    setLoading(true); setResult(null);
    for (let i=0;i<3;i++) {
      setPhase(["🔍 Detectando loja...","📦 Buscando produto...","💰 Calculando comissão..."][i]);
      await new Promise(r=>setTimeout(r,650));
    }
    const store = detectStore(u);
    let prod = null;
    if (u.includes("meli.la")||u.includes("mercadolivre")||u.includes("MLB")||store?.id==="ml") {
      const token = await mlGetValidToken(mlTokens, setMlTokens);
      prod = await fetchProductML(u, token);
    }
    setPhase("✅ Pronto!"); await new Promise(r=>setTimeout(r,300));
    const rate = store?.commission||0.10;
    const comm = prod?.price ? prod.price*rate : null;
    setResult({
      id:Date.now().toString(), originalUrl:u,
      productName: prod?.name||(store?`Produto ${store.name}`:"Produto Afiliado"),
      thumb: prod?.thumb||null,
      price: prod?.priceStr||null, priceRaw: prod?.price||null,
      commission: comm?`R$ ${comm.toFixed(2).replace(".",",")}`:null,
      commRate:`${(rate*100).toFixed(0)}%`, commVal:comm||0,
      storeId:store?.id||"out", storeName:store?.name||"Loja",
      storeColor:store?.color||C.neon, clicks:0, createdAt:new Date().toISOString(),
    });
    setLoading(false);
  
    } catch(e) {
      console.error("analyze error:", e);
      setLoading(false); setResult(null);
    }
};

  const saveLink = (r=result) => {
    if (!r) return;
    if (!links.find(l=>l.originalUrl===r.originalUrl)) addLink(r);
    setUrl(""); setResult(null);
  };

  const openLink = (l) => {
    updateLink({...l, clicks:(l.clicks||0)+1});
    updStats({...stats, cliques:stats.cliques+1});
    window.open(l.originalUrl,"_blank");
  };

  const sendWA = (l) => {
    const msg=`🔥 *${l.productName}*${l.price?"\n💲 Por apenas *"+l.price+"*":""}\n💰 Oferta exclusiva!\n\n👉 ${l.originalUrl}\n\n⚠️ _Estoque limitado!_ 🚨`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,"_blank");
  };

  const sendTG = (l) => {
    const msg=`🔥 ${l.productName}${l.price?" — "+l.price:""}\n\n👉 ${l.originalUrl}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(l.originalUrl)}&text=${encodeURIComponent(msg)}`,"_blank");
  };

  const copy = (txt,id) => { navigator.clipboard?.writeText(txt).catch(()=>{}); setCopied(id); setTimeout(()=>setCopied(null),2000); };
  const qrSrc = (u) => `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(u)}&bgcolor=111827&color=00ddb4&format=png`;

  return (
    <div className="fu" style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* Import mode toggle */}
      <div style={{ display:"flex", background:C.s1, border:`1px solid ${C.b1}`, borderRadius:14, padding:4, gap:4, marginBottom:2 }}>
        <button onClick={()=>setSearch("")} style={{ flex:1, padding:"8px 0", borderRadius:11, border:"none", background:!search.startsWith("BULK")?`linear-gradient(135deg,${C.neon},${C.blue})`:"transparent", color:!search.startsWith("BULK")?"#000":C.t3, fontWeight:700, fontSize:12, cursor:"pointer" }}>🔗 Um Link</button>
        <button onClick={()=>setSearch("BULK")} style={{ flex:1, padding:"8px 0", borderRadius:11, border:"none", background:search.startsWith("BULK")?`linear-gradient(135deg,${C.purple},${C.blue})`:"transparent", color:search.startsWith("BULK")?"#fff":C.t3, fontWeight:700, fontSize:12, cursor:"pointer" }}>📥 Vários Links</button>
      </div>

      <Card glow={C.neon}>
        <div style={{ display:"flex", gap:10, marginBottom:14 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:`linear-gradient(135deg,${C.neon}25,${C.blue}15)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>🔗</div>
          <div>
            <div style={{ color:C.t1, fontWeight:700, fontSize:15 }}>Analisador de Link</div>
            <div style={{ color:C.t3, fontSize:11, marginTop:2 }}>Cola o link → IA detecta produto e calcula comissão</div>
          </div>
        </div>
        <div style={{ position:"relative" }}>
          <input placeholder="https://meli.la/17XoYuZ ou qualquer link..." value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==="Enter"&&analyze()}
            style={{ width:"100%", background:C.s1, border:`1px solid ${url?C.neon+"55":C.b1}`, borderRadius:11, padding:"11px 40px 11px 13px", color:C.t1, fontSize:13, outline:"none", boxSizing:"border-box" }}
            onFocus={e=>e.target.style.borderColor=C.neon+"80"} onBlur={e=>e.target.style.borderColor=url?C.neon+"55":C.b1} />
          {url && <button onClick={()=>{setUrl("");setResult(null);}} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.t3, cursor:"pointer", fontSize:16 }}>✕</button>}
        </div>
        <Btn full onClick={analyze} dis={loading||!url.trim()} s={{ marginTop:10 }}>
          {loading ? <div style={{ display:"flex",gap:8,alignItems:"center",justifyContent:"center" }}><Spin size={16}/>{phase}</div> : "⚡ ANALISAR LINK"}
        </Btn>
        <div style={{ marginTop:10, background:C.neon+"08", borderRadius:10, padding:"8px 12px", display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:14 }}>💡</span>
          <span style={{ color:C.t3, fontSize:11 }}>Tente: <span style={{ color:C.neon, cursor:"pointer", fontWeight:600 }} onClick={()=>setUrl("https://meli.la/17XoYuZ")}>https://meli.la/17XoYuZ</span></span>
        </div>
      </Card>

      {result && (
        <Card glow={result.storeColor} s={{ border:`1px solid ${result.storeColor}45` }} className="fu">
          <Chip c={result.storeColor}>✅ Produto Identificado</Chip>
          <div style={{ display:"flex", gap:12, margin:"14px 0 12px", alignItems:"center" }}>
            <ProductThumb thumb={result.thumb} store={STORES.find(s=>s.id===result.storeId)} size={64} />
            <div style={{ flex:1 }}>
              <div style={{ color:C.t1, fontWeight:700, fontSize:14, lineHeight:1.3 }}>{result.productName}</div>
              <div style={{ color:result.storeColor, fontSize:12, marginTop:4, fontWeight:600 }}>{result.storeName}</div>
              {result.price && <div style={{ color:C.neon, fontWeight:900, fontSize:22, marginTop:4 }}>{result.price}</div>}
              {result.commission && <div style={{ color:C.gold, fontSize:12, marginTop:2 }}>💰 {result.commission} comissão ({result.commRate})</div>}
              {!result.price && <div style={{ color:C.t3, fontSize:11, marginTop:4 }}>⚠️ Configure API do ML para ver preço real</div>}
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:8 }}>
            <Btn onClick={()=>saveLink()} s={{ padding:"9px 0", fontSize:11 }}>💾 Salvar</Btn>
            <Btn onClick={()=>{ saveLink(); setSelProd(result); goTo("Roteiros"); }} v="u" s={{ padding:"9px 0", fontSize:11 }}>📝 Roteiro</Btn>
            <Btn onClick={()=>{ saveLink(); setSelProd(result); goTo("Vídeos"); }} v="g" s={{ padding:"9px 0", fontSize:11 }}>🎬 Vídeo</Btn>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <Btn onClick={()=>sendWA(result)} v="wa" s={{ padding:"9px 0", fontSize:12 }}>💬 WhatsApp</Btn>
            <Btn onClick={()=>sendTG(result)} v="tg" s={{ padding:"9px 0", fontSize:12 }}>✈️ Telegram</Btn>
          </div>
        </Card>
      )}

      {links.length===0 ? (
        <Card s={{ border:`1px dashed ${C.b2}` }}><Empty ico="🔗" title="Nenhum link ainda" desc="Analise seu primeiro link de afiliado acima." /></Card>
      ) : (
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ color:C.t1, fontWeight:700, fontSize:14 }}>📊 Meus Links</div>
            <Chip>{links.length}</Chip>
          </div>
          {/* Search */}
          <div style={{ position:"relative", marginBottom:10 }}>
            <input placeholder="🔍 Buscar por nome ou loja..." value={search} onChange={e=>setSearch(e.target.value)}
              style={{ width:"100%", background:C.s1, border:`1px solid ${search?C.neon+"40":C.b1}`, borderRadius:10, padding:"8px 32px 8px 12px", color:C.t1, fontSize:12, outline:"none", boxSizing:"border-box" }}/>
            {search&&<button onClick={()=>setSearch("")} style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.t3,cursor:"pointer" }}>✕</button>}
          </div>
          {/* Sort */}
          <div style={{ display:"flex", gap:5, marginBottom:12 }}>
            {[["recent","🕐 Recente"],["clicks","👆 Cliques"],["commission","💰 Comissão"]].map(([id,l])=>(
              <button key={id} onClick={()=>setSortBy(id)} style={{ flex:1, background:sortBy===id?`linear-gradient(135deg,${C.neon}18,${C.blue}12)`:C.s1, border:`1px solid ${sortBy===id?C.neon+"40":C.b1}`, borderRadius:8, padding:"6px 0", color:sortBy===id?C.neon:C.t3, fontWeight:700, fontSize:10, cursor:"pointer" }}>{l}</button>
            ))}
          </div>
          {(()=>{
            let filtered = links.filter(l=>
              !search || l.productName?.toLowerCase().includes(search.toLowerCase()) || l.storeName?.toLowerCase().includes(search.toLowerCase())
            );
            if (sortBy==="clicks") filtered = [...filtered].sort((a,b)=>(b.clicks||0)-(a.clicks||0));
            else if (sortBy==="commission") filtered = [...filtered].sort((a,b)=>(b.commVal||0)-(a.commVal||0));
            return filtered;
          })().map((l,i,arr)=>(
            <div key={l.id} style={{ paddingBottom:i<links.length-1?14:0, marginBottom:i<links.length-1?14:0, borderBottom:i<links.length-1?`1px solid ${C.b1}`:"none" }}>
              <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <ProductThumb thumb={l.thumb} store={STORES.find(s=>s.id===l.storeId)} size={46} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:C.t1, fontWeight:600, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.productName}</div>
                  <div style={{ display:"flex", gap:6, alignItems:"center", marginTop:1 }}>
                    <span style={{ color:C.t3, fontSize:10 }}>{l.storeName}</span>
                    {l.clicks>=10&&<span style={{ background:C.neon+"18", color:C.neon, fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:99 }}>🔥 Top</span>}
                    {l.clicks>=5&&l.clicks<10&&<span style={{ background:C.gold+"18", color:C.gold, fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:99 }}>⭐ Bom</span>}
                  </div>
                  {l.price && <div style={{ color:C.neon, fontWeight:700, fontSize:13, marginTop:3 }}>{l.price}</div>}
                  {l.commission && <div style={{ color:C.gold, fontSize:11, marginTop:1 }}>💰 {l.commission}</div>}
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ color:C.neon, fontWeight:900, fontSize:20 }}>{l.clicks||0}</div>
                  <div style={{ color:C.t3, fontSize:9 }}>cliques</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:5, marginTop:10, flexWrap:"wrap" }}>
                <button onClick={()=>openLink(l)} style={{ flex:1, minWidth:50, background:(l.storeColor||C.neon)+"18", border:`1px solid ${(l.storeColor||C.neon)}35`, borderRadius:9, padding:"7px 0", color:l.storeColor||C.neon, fontWeight:700, fontSize:10, cursor:"pointer" }}>🌐 Abrir</button>
                <button onClick={()=>copy(l.originalUrl,l.id)} style={{ flex:1, minWidth:50, background:C.s1, border:`1px solid ${C.b1}`, borderRadius:9, padding:"7px 0", color:copied===l.id?C.neon:C.t2, fontWeight:700, fontSize:10, cursor:"pointer" }}>{copied===l.id?"✅":"📋 Copiar"}</button>
                <button onClick={()=>sendWA(l)} style={{ flex:1, minWidth:50, background:C.wa+"18", border:`1px solid ${C.wa}35`, borderRadius:9, padding:"7px 0", color:C.wa, fontWeight:700, fontSize:10, cursor:"pointer" }}>💬 WA</button>
                <button onClick={()=>sendTG(l)} style={{ flex:1, minWidth:50, background:C.tg+"18", border:`1px solid ${C.tg}35`, borderRadius:9, padding:"7px 0", color:C.tg, fontWeight:700, fontSize:10, cursor:"pointer" }}>✈️ TG</button>
                <button onClick={()=>setShowQR(showQR===l.id?null:l.id)} style={{ flex:1, minWidth:50, background:C.s1, border:`1px solid ${C.b1}`, borderRadius:9, padding:"7px 0", color:C.t2, fontWeight:700, fontSize:10, cursor:"pointer" }}>📱 QR</button>
                <button onClick={()=>delLink(l.id)} style={{ background:C.red+"18", border:`1px solid ${C.red}30`, borderRadius:9, padding:"7px 10px", color:C.red, fontWeight:700, fontSize:10, cursor:"pointer" }}>🗑</button>
              </div>
              {showQR===l.id && (
                <div style={{ marginTop:10, textAlign:"center", background:C.s1, borderRadius:12, padding:14 }}>
                  <img src={qrSrc(l.originalUrl)} alt="QR" style={{ borderRadius:10 }} />
                  <div style={{ color:C.t3, fontSize:10, marginTop:6 }}>Escaneie para abrir</div>
                  <button onClick={()=>copy(l.originalUrl,l.id+"q")} style={{ marginTop:8, background:C.neon+"18", border:`1px solid ${C.neon}35`, borderRadius:8, padding:"6px 16px", color:C.neon, fontSize:11, fontWeight:700, cursor:"pointer" }}>📋 Copiar Link</button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// WHATSAPP + TELEGRAM
// ══════════════════════════════════════════════════════
function Mensagens({ links }) {
  const [selLink, setSelLink] = useState(null);
  const [tpl, setTpl] = useState("oferta");
  const [custom, setCustom] = useState("");
  const [preview, setPreview] = useState(false);
  const [channel, setChannel] = useState("wa");

  const TPL = {
    oferta:  l=>`🔥 *Oferta IMPERDÍVEL!*\n\n🛍️ *${l.productName}*${l.price?"\n💲 Por apenas *"+l.price+"*":""}\n💰 Oferta exclusiva!\n\n👉 ${l.originalUrl}\n\n⚠️ _Estoque limitado!_ 🚨`,
    casual:  l=>`Ei! Olha esse produto incrível 👀\n\n${l.productName}${l.price?" — "+l.price:""}\n\n👉 ${l.originalUrl}`,
    urgente: l=>`🚨 *ÚLTIMAS HORAS!*\n\n*${l.productName}*${l.price?"\nPor apenas *"+l.price+"*":""}\n\n⏰ Só hoje!\n👉 ${l.originalUrl}`,
    presente:l=>`🎁 Presente perfeito!\n\n*${l.productName}*${l.price?"\n"+l.price:""}\n\n✅ Qualidade garantida\n👉 ${l.originalUrl}`,
  };

  const link = links.find(l=>l.id===selLink)||links[0];
  const msg = link?(tpl==="custom"?custom:TPL[tpl]?.(link)||""):"";

  const send = () => {
    if (!msg||!link) return;
    if (channel==="wa") window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,"_blank");
    else window.open(`https://t.me/share/url?url=${encodeURIComponent(link.originalUrl)}&text=${encodeURIComponent(msg)}`,"_blank");
  };

  return (
    <div className="fu" style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <Card glow={channel==="wa"?C.wa:C.tg} s={{ border:`1px solid ${(channel==="wa"?C.wa:C.tg)+"30"}` }}>
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          <button onClick={()=>setChannel("wa")} style={{ flex:1, background:channel==="wa"?C.wa+"20":"transparent", border:`1px solid ${channel==="wa"?C.wa+"50":C.b1}`, borderRadius:12, padding:"10px 0", color:channel==="wa"?C.wa:C.t3, fontWeight:700, fontSize:13, cursor:"pointer" }}>💬 WhatsApp</button>
          <button onClick={()=>setChannel("tg")} style={{ flex:1, background:channel==="tg"?C.tg+"20":"transparent", border:`1px solid ${channel==="tg"?C.tg+"50":C.b1}`, borderRadius:12, padding:"10px 0", color:channel==="tg"?C.tg:C.t3, fontWeight:700, fontSize:13, cursor:"pointer" }}>✈️ Telegram</button>
        </div>

        {links.length===0 ? (
          <div style={{ color:C.t3, fontSize:12, textAlign:"center", padding:12 }}>Adicione links primeiro</div>
        ) : (
          <>
            <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Produto</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
              {links.map(l=>(
                <div key={l.id} onClick={()=>setSelLink(l.id)} style={{ display:"flex", gap:10, alignItems:"center", padding:"10px 12px", background:(selLink===l.id||(!selLink&&l===links[0]))?C.neon+"10":C.s1, border:`1px solid ${(selLink===l.id||(!selLink&&l===links[0]))?C.neon+"40":C.b1}`, borderRadius:12, cursor:"pointer" }}>
                  <ProductThumb thumb={l.thumb} store={STORES.find(s=>s.id===l.storeId)} size={30} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:C.t1, fontSize:12, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.productName}</div>
                    {l.price && <div style={{ color:C.neon, fontSize:11 }}>{l.price}</div>}
                  </div>
                  {(selLink===l.id||(!selLink&&l===links[0])) && <span style={{ color:C.neon }}>✓</span>}
                </div>
              ))}
            </div>

            <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Modelo</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:14 }}>
              {[["oferta","🔥 Oferta"],["casual","😊 Casual"],["urgente","⏰ Urgente"],["presente","🎁 Presente"],["custom","✏️ Custom"]].map(([id,l])=>(
                <button key={id} onClick={()=>setTpl(id)} style={{ background:tpl===id?`linear-gradient(135deg,${C.neon}18,${C.blue}12)`:"transparent", border:`1px solid ${tpl===id?C.neon+"50":C.b1}`, borderRadius:10, padding:"8px 0", color:tpl===id?C.neon:C.t3, fontWeight:700, fontSize:11, cursor:"pointer" }}>{l}</button>
              ))}
            </div>

            {tpl==="custom" && (
              <textarea placeholder="Escreva sua mensagem..." value={custom} onChange={e=>setCustom(e.target.value)} rows={5}
                style={{ width:"100%", background:C.s1, border:`1px solid ${C.b1}`, borderRadius:11, padding:"11px 13px", color:C.t1, fontSize:12, outline:"none", resize:"none", boxSizing:"border-box", marginBottom:12, lineHeight:1.6 }} />
            )}

            <button onClick={()=>setPreview(p=>!p)} style={{ width:"100%", background:"none", border:`1px solid ${C.b2}`, borderRadius:10, padding:"8px 0", color:C.t2, fontSize:12, fontWeight:600, cursor:"pointer", marginBottom:preview&&msg?10:0 }}>
              {preview?"▲ Ocultar prévia":"▼ Ver prévia"}
            </button>

            {preview && msg && (
              <div style={{ background:C.s1, border:`1px solid ${(channel==="wa"?C.wa:C.tg)+"30"}`, borderRadius:12, padding:12, marginBottom:12, marginTop:10 }}>
                <pre style={{ color:C.t2, fontSize:11, lineHeight:1.8, whiteSpace:"pre-wrap", fontFamily:"'Outfit',sans-serif" }}>{msg}</pre>
              </div>
            )}

            <Btn full onClick={send} v={channel==="wa"?"wa":"tg"} dis={!msg} s={{ padding:"13px 0", fontSize:14 }}>
              {channel==="wa"?"💬 ABRIR WHATSAPP":"✈️ ABRIR TELEGRAM"}
            </Btn>
          </>
        )}
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// ROTEIROS
// ══════════════════════════════════════════════════════
function Roteiros({ links, selProd, setSelProd, scripts, addScript, delScript, goTo }) {
  const [gen, setGen] = useState(false); const [msg, setMsg] = useState("");
  const prod = selProd||links[0]||null;

  const generate = async () => {
    try {

    if (!prod) return; setGen(true);
    for (let i=0;i<3;i++) { setMsg(["🔍 Analisando produto...","✍️ Criando roteiro...","🎯 Adicionando CTAs..."][i]); await new Promise(r=>setTimeout(r,600)); }
    const s = `🎬 ROTEIRO VIRAL — ${prod.productName}━━━━━━━━━━━━━━━━━━━━━
⚡ [0-3s] HOOK:
"Para tudo! Você PRECISA ver isso!"
Zoom no produto + expressão surpresa

🛍️ [3-10s] PRODUTO:
Mostrar ${prod.productName}
${prod.price?"Destaque: "+prod.price+" 🔥":"Preço incrível!"}
Música trending ao fundo 🎵

💥 [10-16s] BENEFÍCIOS:
✅ Melhor preço garantido
✅ Entrega rápida no Brasil
✅ Link exclusivo na bio

🔥 [16-20s] CTA:
"LINK NA BIO — corre!"
"Estoque acabando hoje!"
Aponta para cima ⬆️

📍 ${prod.originalUrl}

#viral #afiliado #oferta #${prod.storeName?.toLowerCase().replace(" ","")||"produto"}`;addScript({ id:Date.now().toString(), productName:prod.productName, storeId:prod.storeId, text:s, createdAt:new Date().toISOString() });
    setGen(false); setMsg("");
  
    } catch(e) {
      console.error("generate error:", e);
      setGen(false); setMsg("");
    }
};

  return (
    <div className="fu" style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {prod ? (
        <Card glow={prod.storeColor||C.neon} s={{ border:`1px solid ${(prod.storeColor||C.neon)+"40"}` }}>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <ProductThumb thumb={prod.thumb} store={STORES.find(s=>s.id===prod.storeId)} size={46} />
            <div style={{ flex:1 }}>
              <div style={{ color:C.t1, fontWeight:700, fontSize:13 }}>{prod.productName}</div>
              {prod.price && <div style={{ color:C.neon, fontWeight:700, fontSize:13, marginTop:2 }}>{prod.price}</div>}
            </div>
            <Btn onClick={()=>setSelProd(null)} v="gh" s={{ padding:"6px 12px", fontSize:11 }}>Trocar</Btn>
          </div>
        </Card>
      ) : (
        <Card s={{ border:`1px dashed ${C.b2}` }}>
          <Empty ico="📝" title="Selecione um produto" desc="Adicione um link na aba Links para criar roteiros." action={<Btn onClick={()=>goTo("Links")} s={{ padding:"9px 18px" }}>➜ Links</Btn>} />
        </Card>
      )}

      {prod && (
        <Card glow={C.purple}>
          <div style={{ color:C.t1, fontWeight:700, fontSize:14, marginBottom:4 }}>🤖 Gerador de Roteiro Viral</div>
          <div style={{ color:C.t3, fontSize:11, marginBottom:14 }}>IA cria roteiro com hook, benefícios e CTA pronto para qualquer plataforma</div>
          <Btn full onClick={generate} dis={gen} v="u" s={{ padding:"12px 0" }}>
            {gen ? <div style={{ display:"flex",gap:8,alignItems:"center",justifyContent:"center" }}><Spin size={16} color="#fff"/>{msg}</div> : "🤖 GERAR ROTEIRO VIRAL"}
          </Btn>
        </Card>
      )}

      {scripts.length>0 && (
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ color:C.t1, fontWeight:700, fontSize:14 }}>📋 Meus Roteiros</div>
            <Chip c={C.purple}>{scripts.length}</Chip>
          </div>
          {scripts.map((s,i)=>(
            <div key={s.id} style={{ paddingBottom:i<scripts.length-1?14:0, marginBottom:i<scripts.length-1?14:0, borderBottom:i<scripts.length-1?`1px solid ${C.b1}`:"none" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div>
                  <div style={{ color:C.t1, fontWeight:600, fontSize:13 }}>{s.productName}</div>
                  <div style={{ color:C.t3, fontSize:10, marginTop:1 }}>{new Date(s.createdAt).toLocaleDateString("pt-BR")}</div>
                </div>
                <button onClick={()=>delScript(s.id)} style={{ background:C.red+"18", border:`1px solid ${C.red}30`, borderRadius:8, padding:"4px 8px", color:C.red, fontSize:11, cursor:"pointer" }}>🗑</button>
              </div>
              <pre style={{ color:C.t2, fontSize:11, lineHeight:1.8, whiteSpace:"pre-wrap", fontFamily:"'Outfit',sans-serif", background:C.s1, borderRadius:10, padding:12, maxHeight:200, overflowY:"auto" }}>{s.text}</pre>
              <div style={{ display:"flex", gap:8, marginTop:8 }}>
                <button onClick={()=>navigator.clipboard?.writeText(s.text)} style={{ flex:1, background:C.s1, border:`1px solid ${C.b1}`, borderRadius:9, padding:"7px 0", color:C.t2, fontSize:11, fontWeight:700, cursor:"pointer" }}>📋 Copiar</button>
                <button onClick={()=>{ const l=links.find(x=>x.productName===s.productName)||links[0]; if(l){setSelProd(l);goTo("Vídeos");} }} style={{ flex:1, background:C.gold+"18", border:`1px solid ${C.gold}35`, borderRadius:9, padding:"7px 0", color:C.gold, fontSize:11, fontWeight:700, cursor:"pointer" }}>🎬 Vídeo</button>
                <button onClick={()=>{ const l=links.find(x=>x.productName===s.productName)||links[0]; if(l){ const msg=`🔥 ${s.productName}\n\n${s.text.slice(0,200)}...\n\n👉 ${l.originalUrl}`; window.open("https://wa.me/?text="+encodeURIComponent(msg),"_blank"); }}} style={{ flex:1, background:C.wa+"18", border:`1px solid ${C.wa}35`, borderRadius:9, padding:"7px 0", color:C.wa, fontSize:11, fontWeight:700, cursor:"pointer" }}>💬 WA</button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// VÍDEOS
// ══════════════════════════════════════════════════════
function Videos({ videos, links, selProd, goTo, addVideo, delVideo }) {
  const [apiKey, setApiKey] = useState(()=>{ try{return localStorage.getItem("j2v_key")||"";}catch{return "";} });
  const [apiSaved, setApiSaved] = useState(()=>{ try{return !!localStorage.getItem("j2v_key");}catch{return false;} });
  const [creating, setCreating] = useState(false); const [prog, setProg] = useState(0); const [msg, setMsg] = useState("");
  const [fmt, setFmt] = useState("reels"); const [watching, setWatching] = useState(null);
  const [viralTab, setViralTab] = useState("criar"); // criar | buscar
  const [viralSearch, setViralSearch] = useState("");
  const [viralResults, setViralResults] = useState([]);
  const [viralLoading, setViralLoading] = useState(false);

  const [captionCopied, setCaptionCopied] = useState(false);

  const prod = selProd||links[0]||null;
  const isVercel = typeof window!=="undefined" && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("claudeusercontent");

  const saveKey = () => { if (!apiKey.trim()) return; try{localStorage.setItem("j2v_key",apiKey.trim());}catch{} setApiSaved(true); };

  const createVideo = async () => {
    try {

    if (!apiKey.trim()) { setMsg("⚠️ Cole sua API Key e clique Salvar!"); setTimeout(()=>setMsg(""),4000); return; }
    if (!isVercel) { setMsg("⚠️ Criação de vídeo funciona no Vercel. Suba o app!"); setTimeout(()=>setMsg(""),6000); return; }
    setCreating(true); setProg(0);
    const steps=["🎨 Criando cenas...","🖼️ Produto...","✍️ Textos...","🎵 Música...","🗣️ Narração...","📝 Legendas...","🎬 Renderizando..."];
    let p=0; const iv=setInterval(()=>{ p=Math.min(p+12,85); setProg(p); setMsg(steps[Math.min(Math.floor(p/13),steps.length-1)]); },900);
    const dims=fmt==="reels"?{w:1080,h:1920}:fmt==="yt"?{w:1920,h:1080}:{w:1080,h:1080};
    const payload={
      comment:`AfiliadoAI — ${prod?.productName||"Produto"}`, width:dims.w, height:dims.h,
      scenes:[
        { duration:4, elements:[
          {type:"rectangle",x:0,y:0,width:"100%",height:"100%",color:"#04060e"},
          {type:"text",text:"🔥 OFERTA INCRÍVEL!",x:"center",y:"28%",width:"90%",style:{fontSize:58,fontWeight:"bold",color:"#00ddb4",textAlign:"center"}},
          ...(prod?.thumb?[{type:"image",src:prod.thumb,x:"center",y:"60%",width:"65%",height:"30%",fit:"contain"}]:[]),
        ]},
        { duration:8, elements:[
          {type:"rectangle",x:0,y:0,width:"100%",height:"100%",color:"#090f1e"},
          ...(prod?.thumb?[{type:"image",src:prod.thumb,x:"center",y:"22%",width:"72%",height:"36%",fit:"contain"}]:[]),
          {type:"text",text:prod?.productName||"Produto",x:"center",y:"68%",width:"90%",style:{fontSize:34,fontWeight:"bold",color:"#eef2f8",textAlign:"center"}},
          ...(prod?.price?[{type:"text",text:prod.price,x:"center",y:"80%",width:"90%",style:{fontSize:48,fontWeight:"bold",color:"#00ddb4",textAlign:"center"}}]:[]),
        ]},
        { duration:8, elements:[
          {type:"rectangle",x:0,y:0,width:"100%",height:"100%",color:"#04060e"},
          {type:"text",text:"👇 LINK NA BIO",x:"center",y:"35%",width:"90%",style:{fontSize:54,fontWeight:"bold",color:"#00ddb4",textAlign:"center"}},
          {type:"text",text:"Garanta antes de acabar!",x:"center",y:"52%",width:"90%",style:{fontSize:28,color:"#8898b0",textAlign:"center"}},
        ]},
      ],
      voiceover:{text:`${prod?.productName||"Produto"}${prod?.price?", por apenas "+prod.price:""}. Não perca! Link na bio.`,voice:"pt-BR-FranciscaNeural",speed:1.1},
      subtitles:{position:"bottom",style:{fontSize:26,fontWeight:"bold",color:"#fff",background:"rgba(0,0,0,.75)"}},
    };
    try {
      setMsg("📡 Enviando...");
      const res=await fetch("/api/create-video",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({apiKey:apiKey.trim(),payload})});
      clearInterval(iv);
      if (!res.ok) { const t=await res.text(); setCreating(false); setProg(0); setMsg("❌ Erro: "+t.slice(0,80)); setTimeout(()=>setMsg(""),6000); return; }
      const data=await res.json();
      if (data.error) { setCreating(false); setProg(0); setMsg("❌ "+data.error); setTimeout(()=>setMsg(""),6000); return; }
      if (data.movie) {
        setMsg("⏳ Renderizando... 1-2 min");
        let att=0;
        const poll=setInterval(async()=>{
          att++; if(att>60){clearInterval(poll);setCreating(false);setMsg("⚠️ Tempo excedido. Verifique no painel JSON2Video.");setTimeout(()=>setMsg(""),8000);return;}
          try {
            const cr=await fetch(`/api/check-video?project=${data.movie}&apiKey=${encodeURIComponent(apiKey.trim())}`);
            const st=await cr.json();
            const url=st.movie?.url||st.url; const status=st.movie?.status||st.status;
            if ((status==="done"||status==="ready")&&url) {
              clearInterval(poll); setProg(100); setMsg("✅ Vídeo pronto!");
              setTimeout(()=>{ addVideo({id:Date.now().toString(),title:prod?.productName||"Vídeo",thumb:prod?.thumb||null,videoUrl:url,fmt,createdAt:new Date().toISOString()}); setCreating(false); setProg(0); setMsg(""); },800);
            } else if (status==="error"||status==="failed") { clearInterval(poll); setCreating(false); setProg(0); setMsg("❌ Erro na renderização."); setTimeout(()=>setMsg(""),5000); }
            else { setProg(Math.min(85+att,98)); setMsg("🎬 Renderizando "+Math.min(85+att,98)+"%"); }
          } catch {}
        },3000);
      }
    } catch(e) { clearInterval(iv); setCreating(false); setProg(0); setMsg("❌ "+e.message); setTimeout(()=>setMsg(""),6000); }
  
    } catch(e) {
      console.error("createVideo error:", e);
      setCreating && setCreating(false);
    }
};

  const dl = (v) => { if(!v.videoUrl) return; const a=document.createElement("a"); a.href=v.videoUrl; a.download=`${v.title||"video"}.mp4`; a.target="_blank"; a.click(); };

  // Buscar vídeos virais relacionados ao produto
  const searchViralVideos = async () => {
    try {

    if (!viralSearch.trim() && !prod) return;
    setViralLoading(true); setViralResults([]); 
    const query = viralSearch.trim() || prod?.productName || "produto viral";
    // Use YouTube search API via public endpoint (no key needed for basic search)
    // We search multiple sources and return structured results
    const searches = [
      { platform:"TikTok",    icon:"🎵", color:"#FF0050", searchUrl:`https://www.tiktok.com/search?q=${encodeURIComponent(query)}`, embedBase:"https://www.tiktok.com" },
      { platform:"YouTube",   icon:"▶️",  color:"#FF0000", searchUrl:`https://www.youtube.com/results?search_query=${encodeURIComponent(query+" afiliado oferta")}`, embedBase:"https://www.youtube.com" },
      { platform:"Instagram", icon:"📸", color:"#E91E8C", searchUrl:`https://www.instagram.com/explore/tags/${encodeURIComponent(query.replace(/ /g,""))}`, embedBase:"https://www.instagram.com" },
    ];
    // Generate ready-to-use caption for each platform
    const link = prod?.originalUrl || "https://meli.la/17XoYuZ";
    const name = prod?.productName || query;
    const price = prod?.price || "";
    const captions = {
      tiktok:    `🔥 ${name}${price?" por "+price:""}\n\n👉 Link na bio!\n\n#viral #afiliado #oferta #compras #${query.split(" ")[0].toLowerCase()}`,
      youtube:   `${name}${price?" — "+price:""}\n\nLink do produto: ${link}\n\n✅ Link de afiliado — ganho comissão se você comprar pelo link.\n\n#oferta #afiliado`,
      instagram: `✨ ${name}${price?" por "+price:""}\n\n👉 Link na bio!\n\n#publi #reels #viral #oferta`,
    };
    // Simulate loading (real implementation needs backend scraping)
    await new Promise(r => setTimeout(r, 1500));
    setViralResults((searches||[]).map(s => ({
      ...s,
      caption: captions[s.platform.toLowerCase()] || `${name}\n${link}`,
      query,
    })));
    setViralLoading(false);
  
    } catch(e) {
      console.error("searchViralVideos error:", e);
      setViralLoading(false);
    }
};

  return (
    <div className="fu" style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {watching && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.97)",zIndex:300,display:"flex",flexDirection:"column" }}>
          <div style={{ display:"flex",justifyContent:"space-between",padding:"16px 20px" }}>
            <div style={{ color:C.t1,fontWeight:700,fontSize:14 }}>{watching.title}</div>
            <button onClick={()=>setWatching(null)} style={{ background:C.s2,border:"none",borderRadius:99,width:34,height:34,color:C.t1,cursor:"pointer",fontSize:18 }}>✕</button>
          </div>
          <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
            {watching.videoUrl?<video src={watching.videoUrl} controls autoPlay playsInline style={{ maxWidth:"100%",maxHeight:"75vh",borderRadius:14 }}/>:<Empty ico="🎬" title="Vídeo indisponível" desc=""/>}
          </div>
          <div style={{ padding:"12px 20px 28px" }}><Btn full onClick={()=>dl(watching)} v="g" s={{ padding:"13px 0",fontSize:14 }}>📥 Baixar Vídeo</Btn></div>
        </div>
      )}

      {prod ? (
        <Card glow={prod.storeColor||C.neon} s={{ border:`1px solid ${(prod.storeColor||C.neon)+"40"}` }}>
          <div style={{ display:"flex",gap:10,alignItems:"center" }}>
            <ProductThumb thumb={prod.thumb} store={STORES.find(s=>s.id===prod.storeId)} size={46} />
            <div style={{ flex:1 }}>
              <div style={{ color:C.t1,fontWeight:700,fontSize:13 }}>{prod.productName}</div>
              {prod.price&&<div style={{ color:C.neon,fontWeight:700,fontSize:13,marginTop:2 }}>{prod.price}</div>}
            </div>
          </div>
        </Card>
      ) : (
        <Card s={{ border:`1px dashed ${C.b2}` }}>
          <Empty ico="🎬" title="Selecione um produto" desc="Adicione um link para criar vídeos." action={<Btn onClick={()=>goTo("Links")} s={{ padding:"9px 18px" }}>➜ Links</Btn>} />
        </Card>
      )}

      {prod && (
        <>
        {/* TABS */}
        <div style={{ display:"flex", background:C.s1, border:`1px solid ${C.b1}`, borderRadius:14, padding:4, gap:4 }}>
          <button onClick={()=>setViralTab("criar")} style={{ flex:1, padding:"9px 0", borderRadius:11, border:"none", background:viralTab==="criar"?`linear-gradient(135deg,${C.neon},${C.blue})`:"transparent", color:viralTab==="criar"?"#000":C.t3, fontWeight:700, fontSize:12, cursor:"pointer" }}>🎬 Criar Vídeo</button>
          <button onClick={()=>setViralTab("buscar")} style={{ flex:1, padding:"9px 0", borderRadius:11, border:"none", background:viralTab==="buscar"?`linear-gradient(135deg,${C.purple},${C.blue})`:"transparent", color:viralTab==="buscar"?"#fff":C.t3, fontWeight:700, fontSize:12, cursor:"pointer" }}>🔍 Viral + Link</button>
        </div>

        {/* BUSCAR VÍDEO VIRAL */}
        {viralTab==="buscar" && (
        <Card glow={C.purple}>
          <div style={{ display:"flex", gap:10, marginBottom:14 }}>
            <div style={{ width:44,height:44,borderRadius:12,background:`linear-gradient(135deg,${C.purple}25,${C.blue}15)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>🔍</div>
            <div>
              <div style={{ color:C.t1, fontWeight:700, fontSize:15 }}>Vídeo Viral + Meu Link</div>
              <div style={{ color:C.t3, fontSize:11, marginTop:2 }}>Busca vídeos virais e gera legenda com seu link de afiliado</div>
            </div>
          </div>
          <div style={{ position:"relative", marginBottom:10 }}>
            <input placeholder={`Buscar por: ${prod?.productName||"produto"}...`} value={viralSearch} onChange={e=>setViralSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchViralVideos()}
              style={{ width:"100%",background:C.s1,border:`1px solid ${viralSearch?C.purple+"55":C.b1}`,borderRadius:11,padding:"11px 40px 11px 13px",color:C.t1,fontSize:13,outline:"none",boxSizing:"border-box" }} />
            {viralSearch&&<button onClick={()=>setViralSearch("")} style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.t3,cursor:"pointer",fontSize:16 }}>✕</button>}
          </div>
          <Btn full onClick={searchViralVideos} dis={viralLoading} v="u" s={{ marginBottom:14 }}>
            {viralLoading?<div style={{ display:"flex",gap:8,alignItems:"center",justifyContent:"center" }}><Spin size={16} color="#fff"/>Buscando...</div>:"🔍 BUSCAR VÍDEOS VIRAIS"}
          </Btn>
          {viralResults.length===0&&!viralLoading&&(
            <div style={{ background:C.purple+"08",border:`1px solid ${C.purple}20`,borderRadius:12,padding:12 }}>
              <div style={{ color:C.purple,fontWeight:700,fontSize:12,marginBottom:8 }}>💡 Como funciona:</div>
              <div style={{ color:C.t3,fontSize:11,lineHeight:1.8 }}>
                1. Clique em <strong style={{ color:C.t1 }}>Buscar Vídeos Virais</strong><br/>
                2. Abre TikTok, YouTube e Instagram com o produto<br/>
                3. Encontre um vídeo viral de inspiração<br/>
                4. <strong style={{ color:C.neon }}>Copie a legenda pronta</strong> com seu link incluído<br/>
                5. Grave seu vídeo no estilo do viral e poste!
              </div>
              <div style={{ marginTop:8,background:C.red+"10",border:`1px solid ${C.red}25`,borderRadius:8,padding:"8px 10px" }}>
                <div style={{ color:C.red,fontSize:10,fontWeight:700 }}>⚠️ Não reposte vídeos de outros. Use só como inspiração.</div>
              </div>
            </div>
          )}
          {viralResults.length>0&&(
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {(viralResults||[]).map((r,i)=>(
                <div key={i} style={{ background:C.s1,border:`1px solid ${C.b1}`,borderRadius:14,overflow:"hidden" }}>
                  <div style={{ padding:"12px 14px" }}>
                    <div style={{ display:"flex",gap:10,alignItems:"center",marginBottom:10 }}>
                      <div style={{ width:36,height:36,borderRadius:10,background:r.color+"20",border:`1px solid ${r.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{r.icon}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ color:C.t1,fontWeight:700,fontSize:13 }}>{r.platform}</div>
                        <div style={{ color:C.t3,fontSize:10 }}>Vídeos virais de "{r.query}"</div>
                      </div>
                      <button onClick={()=>window.open(r.searchUrl,"_blank")} style={{ background:r.color+"20",border:`1px solid ${r.color}40`,borderRadius:10,padding:"7px 14px",color:r.color,fontWeight:700,fontSize:11,cursor:"pointer" }}>🔍 Abrir</button>
                    </div>
                    <div style={{ background:C.card,borderRadius:10,padding:"10px 12px" }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
                        <div style={{ color:r.color,fontSize:10,fontWeight:700 }}>📋 LEGENDA COM SEU LINK:</div>
                        <button onClick={()=>{ navigator.clipboard?.writeText(r.caption); setCaptionCopied(i); setTimeout(()=>setCaptionCopied(null),2000); }}
                          style={{ background:captionCopied===i?C.neon+"20":C.s1,border:`1px solid ${captionCopied===i?C.neon+"50":C.b1}`,borderRadius:8,padding:"4px 10px",color:captionCopied===i?C.neon:C.t2,fontWeight:700,fontSize:10,cursor:"pointer" }}>
                          {captionCopied===i?"✅ Copiado!":"📋 Copiar"}
                        </button>
                      </div>
                      <pre style={{ color:C.t2,fontSize:11,lineHeight:1.7,whiteSpace:"pre-wrap",fontFamily:"'Outfit',sans-serif" }}>{r.caption}</pre>
                    </div>
                    {prod?.originalUrl&&(
                      <div style={{ marginTop:8,display:"flex",gap:6,alignItems:"center",background:C.neon+"08",border:`1px solid ${C.neon}20`,borderRadius:8,padding:"6px 10px" }}>
                        <span style={{ fontSize:12 }}>🔗</span>
                        <span style={{ color:C.neon,fontSize:11,fontFamily:"'JetBrains Mono',monospace",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{prod.originalUrl}</span>
                        <button onClick={()=>navigator.clipboard?.writeText(prod.originalUrl)} style={{ background:"none",border:"none",color:C.t3,cursor:"pointer",fontSize:12 }}>📋</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div style={{ background:C.gold+"10",border:`1px solid ${C.gold}25`,borderRadius:12,padding:12 }}>
                <div style={{ color:C.gold,fontWeight:700,fontSize:12,marginBottom:6 }}>🎬 Processo:</div>
                <div style={{ color:C.t3,fontSize:11,lineHeight:1.9 }}>
                  <strong style={{ color:C.t1 }}>1.</strong> Abra uma plataforma e encontre um vídeo viral<br/>
                  <strong style={{ color:C.t1 }}>2.</strong> Copie a legenda pronta ↑ com seu link<br/>
                  <strong style={{ color:C.t1 }}>3.</strong> Grave seu vídeo inspirado no viral<br/>
                  <strong style={{ color:C.t1 }}>4.</strong> Poste com a legenda — link de afiliado já está! ✅
                </div>
              </div>
            </div>
          )}
        </Card>
        )}

        {/* CRIAR VÍDEO */}
        {viralTab==="criar" && (
        <Card glow={C.purple}>
          <div style={{ color:C.t1,fontWeight:700,fontSize:14,marginBottom:4 }}>🎬 Criar Vídeo</div>
          <div style={{ color:C.t3,fontSize:11,marginBottom:14 }}>
            Grátis · <a href="https://json2video.com/get-api-key/" target="_blank" rel="noreferrer" style={{ color:C.neon }}>Pegar API Key gratuita →</a>
          </div>
          <div style={{ display:"flex",gap:6,marginBottom:14 }}>
            {[["reels","📱 Reels"],["yt","▶️ YouTube"],["sq","⬜ Feed"]].map(([id,lb])=>(
              <button key={id} onClick={()=>setFmt(id)} style={{ flex:1,background:fmt===id?`linear-gradient(135deg,${C.purple}25,${C.blue}18)`:C.s1,border:`1px solid ${fmt===id?C.purple+"60":C.b1}`,borderRadius:10,padding:"8px 4px",color:fmt===id?C.purple:C.t3,fontWeight:700,fontSize:11,cursor:"pointer" }}>{lb}</button>
            ))}
          </div>
          <div style={{ display:"flex",gap:8,marginBottom:6 }}>
            <input placeholder="Cole sua API Key JSON2Video..." value={apiKey} onChange={e=>{setApiKey(e.target.value);setApiSaved(false);}}
              style={{ flex:1,background:C.s1,border:`1px solid ${apiSaved?C.neon+"55":C.b1}`,borderRadius:11,padding:"10px 12px",color:C.t1,fontSize:12,outline:"none",fontFamily:"'JetBrains Mono',monospace" }}/>
            <button onClick={saveKey} style={{ background:apiSaved?C.neon+"20":`linear-gradient(135deg,${C.neon},${C.blue})`,border:apiSaved?`1px solid ${C.neon}40`:"none",borderRadius:11,padding:"0 14px",color:apiSaved?C.neon:"#000",fontWeight:800,fontSize:12,cursor:"pointer",flexShrink:0 }}>
              {apiSaved?"✅":"💾 Salvar"}
            </button>
          </div>
          {apiSaved&&<div style={{ color:C.neon,fontSize:10,marginBottom:10 }}>✅ API Key salva!</div>}
          {!isVercel&&<div style={{ color:C.gold,fontSize:11,marginBottom:10,padding:"7px 10px",background:C.gold+"12",borderRadius:8 }}>⚠️ Funciona apenas no Vercel</div>}
          {msg&&!creating&&<div style={{ color:msg.startsWith("❌")?C.red:msg.startsWith("⚠️")?C.gold:C.neon,fontSize:12,marginBottom:10,padding:"8px 10px",background:(msg.startsWith("❌")?C.red:C.gold)+"12",borderRadius:8 }}>{msg}</div>}
          {creating?(
            <div style={{ textAlign:"center",padding:"20px 0" }}>
              <Spin size={40} color={C.purple}/>
              <div style={{ color:C.purple,fontSize:13,fontWeight:700,marginTop:10 }}>{msg}</div>
              <div style={{ background:C.s1,borderRadius:99,height:6,overflow:"hidden",marginTop:12 }}>
                <div style={{ width:`${prog}%`,height:"100%",background:`linear-gradient(90deg,${C.purple},${C.blue})`,borderRadius:99,transition:"width .5s ease" }}/>
              </div>
              <div style={{ color:C.t3,fontSize:11,marginTop:6 }}>{prog}%</div>
            </div>
          ):(
            <Btn full onClick={createVideo} v="u" s={{ padding:"12px 0" }}>🎬 CRIAR VÍDEO AGORA</Btn>
          )}
        </Card>
        )}
        </>
      )}

      <Card>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <div style={{ color:C.t1,fontWeight:700,fontSize:14 }}>📺 Meus Vídeos</div>
          <Chip c={C.orange}>{videos.length}</Chip>
        </div>
        {videos.length===0?(
          <Empty ico="🎬" title="Nenhum vídeo ainda" desc="Crie seu primeiro vídeo viral acima."/>
        ):(
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {videos.map(v=>(
              <div key={v.id} style={{ background:C.s1,borderRadius:14,overflow:"hidden",border:`1px solid ${C.b1}` }}>
                <div style={{ height:88,background:`linear-gradient(135deg,${C.s2},${C.b1})`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",cursor:"pointer" }} onClick={()=>setWatching(v)}>
                  {v.thumb?<img src={`https://wsrv.nl/?url=${encodeURIComponent(v.thumb)}&w=300&h=100&fit=cover`} alt="" style={{ height:"100%",width:"100%",objectFit:"cover" }} onError={e=>e.target.style.display="none"}/>:<span style={{ fontSize:36,opacity:.3 }}>🎬</span>}
                  <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:38,height:38,borderRadius:"50%",background:"rgba(0,0,0,.65)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>▶️</div>
                  <Chip c={C.orange} s={{ position:"absolute",top:8,right:8 }}>{v.fmt==="reels"?"Reels":v.fmt==="yt"?"YouTube":"Feed"}</Chip>
                </div>
                <div style={{ padding:"10px 12px" }}>
                  <div style={{ color:C.t1,fontWeight:700,fontSize:13,marginBottom:4 }}>{v.title}</div>
                  <div style={{ color:C.t3,fontSize:10,marginBottom:8 }}>{new Date(v.createdAt).toLocaleDateString("pt-BR")}</div>
                  <div style={{ display:"flex",gap:8 }}>
                    <button onClick={()=>setWatching(v)} style={{ flex:1,background:C.blue+"18",border:`1px solid ${C.blue}35`,borderRadius:10,padding:"8px 0",color:C.blue,fontWeight:700,fontSize:12,cursor:"pointer" }}>▶️ Ver</button>
                    <button onClick={()=>dl(v)} style={{ flex:2,background:`linear-gradient(135deg,${C.gold}20,${C.orange}20)`,border:`1px solid ${C.gold}35`,borderRadius:10,padding:"8px 0",color:C.gold,fontWeight:700,fontSize:12,cursor:"pointer" }}>📥 Baixar</button>
                    <button onClick={()=>delVideo(v.id)} style={{ background:C.red+"18",border:`1px solid ${C.red}30`,borderRadius:10,padding:"8px 10px",color:C.red,fontWeight:700,fontSize:12,cursor:"pointer" }}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// CONTAS — plataformas sociais
// ══════════════════════════════════════════════════════
function Contas({ accs, setAccs, bestTimes, setBestTimes }) {
  const [exp, setExp] = useState(null); const [inp, setInp] = useState({});

  const save = (id) => { if (!inp[id]?.trim()) return; setAccs({...accs,[id]:inp[id].trim()}); setExp(null); };
  const rem = (id) => { const n={...accs}; delete n[id]; setAccs(n); };
  const cnt = Object.keys(accs).length;

  return (
    <div className="fu" style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {cnt>0 && (
        <Card glow={C.neon} s={{ background:`linear-gradient(135deg,${C.neon}08,${C.blue}06)`, border:`1px solid ${C.neon}25` }}>
          <div style={{ display:"flex",gap:10,alignItems:"center" }}>
            <div style={{ fontSize:28 }}>✅</div>
            <div>
              <div style={{ color:C.neon,fontWeight:700,fontSize:14 }}>{cnt} conta{cnt>1?"s":""} conectada{cnt>1?"s":""}</div>
              <div style={{ color:C.t3,fontSize:11,marginTop:2 }}>Salvas no dispositivo</div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div style={{ color:C.t1,fontWeight:700,fontSize:14,marginBottom:12 }}>⏰ Melhores Horários</div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
          {PLATFORMS.filter(p=>bestTimes[p.id]!==undefined).map(p=>(
            <div key={p.id} style={{ background:C.s1,borderRadius:10,padding:"8px 10px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <span style={{ fontSize:14 }}>{p.icon}</span>
              <input type="time" value={bestTimes[p.id]||"20:00"} onChange={e=>setBestTimes({...bestTimes,[p.id]:e.target.value})}
                style={{ background:"none",border:"none",color:C.neon,fontSize:13,fontWeight:700,outline:"none",width:60,textAlign:"right" }}/>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{ color:C.t1,fontWeight:700,fontSize:14,marginBottom:14 }}>📱 Minhas Contas</div>
        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
          {PLATFORMS.map(p=>{
            const con=accs[p.id]; const open=exp===p.id;
            return (
              <div key={p.id} style={{ background:C.s1,border:`1px solid ${con?p.color+"40":C.b1}`,borderRadius:14,overflow:"hidden",transition:"border-color .2s" }}>
                <div style={{ display:"flex",alignItems:"center",gap:10,padding:"12px 12px",cursor:"pointer" }} onClick={()=>setExp(open?null:p.id)}>
                  <div style={{ width:36,height:36,borderRadius:10,background:p.color+"20",border:`1px solid ${p.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>{p.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ color:C.t1,fontWeight:700,fontSize:13 }}>{p.name}</div>
                    {con?<div style={{ color:p.color,fontSize:11,marginTop:1 }}>✅ {con}</div>:<div style={{ color:C.t3,fontSize:11,marginTop:1 }}>Toque para conectar</div>}
                  </div>
                  <div style={{ color:C.t2,fontSize:16 }}>{open?"↑":"↓"}</div>
                </div>
                {open && (
                  <div style={{ padding:"0 12px 12px",borderTop:`1px solid ${C.b1}` }}>
                    <div style={{ color:C.t3,fontSize:10,margin:"8px 0 6px" }}>⚠️ {p.rule}</div>
                    <input placeholder={`@sua_conta_${p.name.toLowerCase()}`} value={inp[p.id]||""} onChange={e=>setInp(i=>({...i,[p.id]:e.target.value}))}
                      style={{ width:"100%",background:C.card,border:`1px solid ${p.color}40`,borderRadius:10,padding:"9px 12px",color:C.t1,fontSize:12,outline:"none",boxSizing:"border-box",marginBottom:8 }}/>
                    <div style={{ display:"flex",gap:8 }}>
                      <button onClick={()=>save(p.id)} style={{ flex:1,background:`linear-gradient(135deg,${p.color},${p.color}99)`,border:"none",borderRadius:10,padding:9,color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer" }}>✅ Salvar</button>
                      <button onClick={()=>window.open(p.url,"_blank")} style={{ flex:1,background:C.s1,border:`1px solid ${C.b2}`,borderRadius:10,padding:9,color:C.t2,fontWeight:700,fontSize:12,cursor:"pointer" }}>🌐 Abrir</button>
                      {con&&<button onClick={()=>rem(p.id)} style={{ background:C.red+"20",border:`1px solid ${C.red}30`,borderRadius:10,padding:"9px 12px",color:C.red,fontWeight:700,fontSize:12,cursor:"pointer" }}>🗑</button>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Contas extras adicionadas pelo usuário ── */}
          {Object.entries(accs).filter(([id])=>!PLATFORMS.find(p=>p.id===id)).map(([id,val])=>(
            <div key={id} style={{ background:C.s1,border:`1px solid ${C.neon}40`,borderRadius:14,overflow:"hidden" }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,padding:"12px 12px" }}>
                <div style={{ width:36,height:36,borderRadius:10,background:`${C.neon}20`,border:`1px solid ${C.neon}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>📲</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:C.t1,fontWeight:700,fontSize:13 }}>{id}</div>
                  <div style={{ color:C.neon,fontSize:11,marginTop:1 }}>✅ {val}</div>
                </div>
                <button onClick={()=>rem(id)} style={{ background:C.red+"20",border:`1px solid ${C.red}30`,borderRadius:9,padding:"6px 10px",color:C.red,fontWeight:700,fontSize:12,cursor:"pointer" }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Botão + Adicionar Nova Conta ── */}
      {exp==="__new__" ? (
        <Card s={{ border:`1px solid ${C.neon}40` }}>
          <div style={{ color:C.t1,fontWeight:700,fontSize:14,marginBottom:12 }}>➕ Nova Conta</div>
          <input placeholder="Nome da plataforma (ex: Pinterest)" value={inp["__new_name"]||""} onChange={e=>setInp(i=>({...i,"__new_name":e.target.value}))}
            style={{ width:"100%",background:C.s1,border:`1px solid ${C.b1}`,borderRadius:10,padding:"9px 12px",color:C.t1,fontSize:12,outline:"none",boxSizing:"border-box",marginBottom:8 }}/>
          <input placeholder="@seu_usuario ou link" value={inp["__new_val"]||""} onChange={e=>setInp(i=>({...i,"__new_val":e.target.value}))}
            style={{ width:"100%",background:C.s1,border:`1px solid ${C.b1}`,borderRadius:10,padding:"9px 12px",color:C.t1,fontSize:12,outline:"none",boxSizing:"border-box",marginBottom:10 }}/>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={()=>{
              const nm=(inp["__new_name"]||"").trim();
              const vl=(inp["__new_val"]||"").trim();
              if(!nm||!vl) return;
              setAccs({...accs,[nm]:vl});
              setInp(i=>({...i,"__new_name":"","__new_val":""}));
              setExp(null);
            }} style={{ flex:2,background:`linear-gradient(135deg,${C.neon},${C.blue})`,border:"none",borderRadius:10,padding:"11px 0",color:"#000",fontWeight:800,fontSize:13,cursor:"pointer" }}>✅ Adicionar</button>
            <button onClick={()=>setExp(null)} style={{ flex:1,background:C.s1,border:`1px solid ${C.b1}`,borderRadius:10,padding:"11px 0",color:C.t3,fontWeight:700,fontSize:13,cursor:"pointer" }}>Cancelar</button>
          </div>
        </Card>
      ) : (
        <button onClick={()=>setExp("__new__")} style={{ width:"100%",background:`linear-gradient(135deg,${C.neon}15,${C.blue}10)`,border:`2px dashed ${C.neon}50`,borderRadius:14,padding:"14px 0",color:C.neon,fontWeight:800,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
          ➕ Adicionar Nova Conta
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════
function Config({ settings, setSetts, customStores, setCustomStores, connectedStores, setConnectedStores, mlTokens, setMlTokens, storeConfigs, setStoreConfigs, telegramBot, setTelegramBot, onLogout }) {
  const [addStore, setAddStore] = useState(false);
  const [expandedStore, setExpandedStore] = useState(null);
  const [storeInputs, setStoreInputs] = useState({});
  const [sf, setSf] = useState({ name:"", comm:"", ico:"🛒", color:C.neon });
  const ICONS=["🛒","📦","🛍️","👗","🏷️","🌿","💄","🍫","🏪","💅","👠","🎁","🧴","📱","💻","🎮","🍕","☕","🌺","💍"];
  const COLORS=[C.neon,C.gold,C.purple,C.red,C.orange,C.blue,"#E91E8C","#00A86B","#FF5722","#1877F2"];
  const allStores=[...STORES,...customStores];

  return (
    <div className="fu" style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <Card>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <div style={{ color:C.t1,fontWeight:700,fontSize:14 }}>🏪 Lojas Afiliadas</div>
          <button onClick={()=>setAddStore(s=>!s)} style={{ background:addStore?C.s1:`linear-gradient(135deg,${C.neon},${C.blue})`,border:addStore?`1px solid ${C.b2}`:"none",borderRadius:99,padding:"6px 14px",color:addStore?C.t2:"#000",fontWeight:700,fontSize:12,cursor:"pointer" }}>{addStore?"✕ Fechar":"+ Nova"}</button>
        </div>
        {addStore && (
          <div style={{ background:C.s1,borderRadius:12,padding:14,marginBottom:14,border:`1px solid ${sf.color+"40"}` }}>
            <div style={{ display:"flex",gap:8,marginBottom:10,alignItems:"center" }}>
              <div style={{ width:40,height:40,borderRadius:10,background:sf.color+"20",border:`1px solid ${sf.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{sf.ico}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>{COLORS.map(c=><div key={c} onClick={()=>setSf(f=>({...f,color:c}))} style={{ width:20,height:20,borderRadius:99,background:c,cursor:"pointer",border:sf.color===c?"2px solid #fff":"2px solid transparent" }}/>)}</div>
              </div>
            </div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:4,marginBottom:10 }}>{ICONS.map(ic=><div key={ic} onClick={()=>setSf(f=>({...f,ico:ic}))} style={{ width:30,height:30,borderRadius:7,background:sf.ico===ic?sf.color+"25":C.card,border:`1px solid ${sf.ico===ic?sf.color:C.b1}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,cursor:"pointer" }}>{ic}</div>)}</div>
            <Inp label="Nome *" ph="Ex: Magazine Luiza..." val={sf.name} set={v=>setSf(f=>({...f,name:v}))}/>
            <Inp label="Comissão %" ph="Ex: 12" val={sf.comm} set={v=>setSf(f=>({...f,comm:v}))}/>
            <Btn full onClick={()=>{ if(!sf.name.trim())return; setCustomStores([...customStores,{id:"c_"+Date.now(),name:sf.name,icon:sf.ico,color:sf.color,commission:parseFloat(sf.comm)/100||0.10,custom:true,favicon:null}]); setSf({name:"",comm:"",ico:"🛒",color:C.neon}); setAddStore(false); }}>✅ Adicionar</Btn>
          </div>
        )}
        {allStores.map((s,i)=>{
          const isExpanded = expandedStore === s.id;
          const cfg = storeConfigs[s.id] || {};
          const isConfigured = Object.values(cfg).some(v=>v&&v.trim());
          const FIELDS = {
            ml:  [{key:"token",  label:"Access Token",    ph:"APP_USR-...",    url:"developers.mercadolivre.com.br"}],
            amz: [{key:"tag",    label:"Associate Tag",   ph:"seusite-20",     url:"associados.amazon.com.br"}],
            shp: [{key:"id",     label:"Affiliate ID",    ph:"SEU_ID",         url:"shopee.com.br/m/shopee-affiliate"}],
            shn: [{key:"id",     label:"Unique ID",       ph:"SEU_ID",         url:"affiliate.shein.com"}],
            tmu: [{key:"id",     label:"Share ID",        ph:"SEU_ID",         url:"temu.com/affiliate"}],
            nat: [{key:"code",   label:"Código Consultor",ph:"SEU_CODIGO",     url:"natura.com.br/consultoria"}],
            bot: [{key:"code",   label:"Código Revendedor",ph:"SEU_CODIGO",    url:"boticario.com.br/revendedor"}],
            cac: [{key:"code",   label:"Código Afiliado", ph:"SEU_CODIGO",     url:"cacaushow.com.br/afiliados"}],
            per: [{key:"code",   label:"Código Afiliado", ph:"SEU_CODIGO",     url:"pernambucanas.com.br/afiliados"}],
          };
          const fields = FIELDS[s.id] || [{key:"token", label:"Token/Código", ph:"SEU_TOKEN", url:""}];
          return (
          <div key={s.id} style={{ borderBottom:i<allStores.length-1?`1px solid ${C.b1}`:"none" }}>
            {/* Store header row */}
            <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 0" }}>
              <StoreLogo store={s} size={34}/>
              <div style={{ flex:1 }}>
                <div style={{ color:C.t1,fontWeight:600,fontSize:13 }}>{s.name}</div>
                <div style={{ display:"flex",gap:6,alignItems:"center",marginTop:2 }}>
                  <span style={{ color:s.color,fontSize:11 }}>💰 {((s.commission||0)*100).toFixed(0)}%</span>
                  {isConfigured && <span style={{ color:C.neon,fontSize:10,fontWeight:700 }}>✅ Configurado</span>}
                </div>
              </div>
              <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                <button onClick={()=>setExpandedStore(isExpanded?null:s.id)} style={{ background:isExpanded?C.purple+"20":C.s1,border:`1px solid ${isExpanded?C.purple+"50":C.b2}`,borderRadius:8,padding:"5px 10px",color:isExpanded?C.purple:C.t3,fontWeight:700,fontSize:11,cursor:"pointer" }}>
                  {isExpanded?"▲ Fechar":"⚙️ Config"}
                </button>
                <button onClick={()=>setConnectedStores(cc=>({...cc,[s.id]:!cc[s.id]}))} style={{ background:connectedStores[s.id]?`linear-gradient(135deg,${C.neon},${C.blue})`:C.s1,border:connectedStores[s.id]?"none":`1px solid ${C.b2}`,borderRadius:8,padding:"5px 12px",color:connectedStores[s.id]?"#000":C.t3,fontWeight:700,fontSize:11,cursor:"pointer" }}>
                  {connectedStores[s.id]?"✅ Ativa":"Ativar"}
                </button>
                {s.custom&&<button onClick={()=>setCustomStores(customStores.filter(cc=>cc.id!==s.id))} style={{ background:C.red+"18",border:`1px solid ${C.red}30`,borderRadius:8,padding:"5px 8px",color:C.red,fontSize:11,cursor:"pointer" }}>🗑</button>}
              </div>
            </div>
            {/* Config panel */}
            {isExpanded && (
              <div style={{ background:C.s1,borderRadius:12,padding:14,marginBottom:10,border:`1px solid ${s.color}30` }}>
                <div style={{ color:s.color,fontWeight:700,fontSize:12,marginBottom:10 }}>⚙️ Configurações — {s.name}</div>
                {(fields||[]).map(field=>(
                  <div key={field.key} style={{ marginBottom:10 }}>
                    <div style={{ color:C.t2,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:5 }}>{field.label}</div>
                    <div style={{ display:"flex",gap:8 }}>
                      <input
                        placeholder={field.ph}
                        value={storeInputs[s.id+"_"+field.key]??cfg[field.key]??""}
                        onChange={e=>setStoreInputs(prev=>({...prev,[s.id+"_"+field.key]:e.target.value}))}
                        style={{ flex:1,background:C.card,border:`1px solid ${cfg[field.key]?s.color+"50":C.b1}`,borderRadius:10,padding:"9px 12px",color:C.t1,fontSize:12,outline:"none",fontFamily:"'JetBrains Mono',monospace" }}
                        onFocus={e=>e.target.style.borderColor=s.color+"70"}
                        onBlur={e=>e.target.style.borderColor=cfg[field.key]?s.color+"50":C.b1}
                      />
                      <button onClick={()=>{
                        const val = storeInputs[s.id+"_"+field.key];
                        if (!val?.trim()) return;
                        setStoreConfigs({...storeConfigs,[s.id]:{...cfg,[field.key]:val.trim()}});
                        setConnectedStores(cc=>({...cc,[s.id]:true}));
                      }} style={{ background:`linear-gradient(135deg,${s.color},${s.color}99)`,border:"none",borderRadius:10,padding:"0 14px",color:"#000",fontWeight:800,fontSize:12,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap" }}>
                        💾 Salvar
                      </button>
                    </div>
                    {cfg[field.key] && (
                      <div style={{ color:C.neon,fontSize:10,marginTop:4,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                        <span>✅ Salvo: {cfg[field.key].slice(0,20)}{cfg[field.key].length>20?"...":""}</span>
                        <button onClick={()=>{
                          const newCfg = {...cfg}; delete newCfg[field.key];
                          setStoreConfigs({...storeConfigs,[s.id]:newCfg});
                        }} style={{ background:"none",border:"none",color:C.red,fontSize:10,cursor:"pointer" }}>✕ Remover</button>
                      </div>
                    )}
                    {field.url && (
                      <a href={"https://"+field.url} target="_blank" rel="noreferrer" style={{ color:C.blue,fontSize:10,marginTop:4,display:"inline-block" }}>
                        🔗 Pegar em {field.url} →
                      </a>
                    )}
                  </div>
                ))}
                {isConfigured && (
                  <div style={{ background:C.neon+"08",border:`1px solid ${C.neon}20`,borderRadius:8,padding:"7px 10px",marginTop:4 }}>
                    <div style={{ color:C.neon,fontSize:11,fontWeight:700 }}>✅ {s.name} configurado e ativo!</div>
                    <div style={{ color:C.t3,fontSize:10,marginTop:2 }}>O app usa suas credenciais para buscar produtos reais</div>
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })}
      </Card>

      <Card>
        <div style={{ color:C.t1,fontWeight:700,fontSize:14,marginBottom:14 }}>⚙️ Preferências</div>
        {[{k:"notif",l:"🔔 Notificações",d:"Alertas de atividade"},{k:"ai",l:"🤖 IA Ativa",d:"Análise inteligente"}].map(item=>(
          <div key={item.k} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${C.b1}` }}>
            <div>
              <div style={{ color:C.t1,fontSize:13,fontWeight:600 }}>{item.l}</div>
              <div style={{ color:C.t3,fontSize:11,marginTop:2 }}>{item.d}</div>
            </div>
            <Tog val={settings[item.k]} set={v=>setSetts({...settings,[item.k]:v})}/>
          </div>
        ))}
      </Card>

      <Card>
        <div style={{ color:C.t1,fontWeight:700,fontSize:13,marginBottom:10 }}>🔑 APIs</div>
        <div style={{ color:C.t3,fontSize:11,lineHeight:1.7 }}>
          <div style={{ marginBottom:6 }}>• <strong style={{ color:C.t2 }}>JSON2Video:</strong> Cole na aba Vídeos · <a href="https://json2video.com/get-api-key/" target="_blank" rel="noreferrer" style={{ color:C.neon }}>Pegar grátis →</a></div>
          <div>• <strong style={{ color:"#9b72f7" }}>IA (ARIA):</strong> Configure ANTHROPIC_API_KEY no Vercel</div>
        </div>

        {/* ML OAuth Connect */}
        <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${C.b1}` }}>
          <div style={{ color:C.t1, fontWeight:700, fontSize:13, marginBottom:8 }}>🛒 Mercado Livre — Token Automático</div>
          {mlTokens && mlTokens.access_token ? (
            <div>
              <div style={{ background:"#FFE60012", border:"1px solid #FFE60030", borderRadius:10, padding:"10px 12px", marginBottom:8 }}>
                <div style={{ color:"#FFE600", fontWeight:700, fontSize:12 }}>✅ Conta ML conectada!</div>
                {mlTokens?.user_id && <div style={{ color:C.t3, fontSize:11, marginTop:2 }}>User ID: {mlTokens?.user_id}</div>}
                <div style={{ color:C.t3, fontSize:11, marginTop:2 }}>
                  {mlTokenExpired(mlTokens) ? "⚠️ Token expirado — renovando..." : "✅ Token válido · Renovação automática ativa"}
                </div>
              </div>
              <button onClick={()=>setMlTokens(null)} style={{ background:C.red+"18", border:`1px solid ${C.red}30`, borderRadius:10, padding:"7px 14px", color:C.red, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                🔌 Desconectar
              </button>
            </div>
          ) : (
            <div>
              <div style={{ color:C.t3, fontSize:11, lineHeight:1.7, marginBottom:10 }}>
                Conecte sua conta ML para buscar preços reais. O token renova automaticamente a cada 6 horas — sem precisar refazer.
              </div>
              <div style={{ background:C.gold+"10", border:`1px solid ${C.gold}25`, borderRadius:10, padding:"9px 12px", marginBottom:10 }}>
                <div style={{ color:C.gold, fontSize:11, fontWeight:700, marginBottom:4 }}>⚙️ Configure no Vercel:</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:C.t3, lineHeight:2 }}>
                  ML_CLIENT_ID = seu_client_id<br/>
                  ML_CLIENT_SECRET = seu_client_secret<br/>
                  ML_REDIRECT_URI = https://seu-app.vercel.app
                </div>
                <a href="https://developers.mercadolivre.com.br" target="_blank" rel="noreferrer" style={{ color:C.neon, fontSize:11, display:"inline-block", marginTop:6 }}>Criar app ML Developers →</a>
              </div>
              <button onClick={()=>{
                try {
                  const redirectUri = encodeURIComponent(window.location.origin + "/");
                  const mlClientId = (() => { try { return process.env.REACT_APP_ML_CLIENT_ID || "SEU_CLIENT_ID"; } catch(e) { return "SEU_CLIENT_ID"; } })();
                  const mlUrl = "https://auth.mercadolivre.com.br/authorization"
                    + "?response_type=code"
                    + "&client_id=" + mlClientId
                    + "&redirect_uri=" + redirectUri
                    + "&scope=read_catalog%20offline_access"
                    + "&approval_prompt=force";
                  window.open(mlUrl, "_blank");
                } catch(e) {}
              }} style={{ background:"linear-gradient(135deg,#FFE600,#FF9900)", border:"none", borderRadius:10, padding:"10px 20px", color:"#000", fontWeight:800, fontSize:13, cursor:"pointer", width:"100%" }}>
                🔄 Reconectar Mercado Livre
              </button>
              <div style={{ color:"#3d526b", fontSize:10, textAlign:"center", marginTop:6, lineHeight:1.5 }}>Usa approval_prompt=force para forçar nova autorização mesmo se token anterior expirou</div>
            </div>
          )}
        </div>
      </Card>

      {/* Telegram Bot Config */}
      <Card>
        <div style={{ color:C.t1,fontWeight:700,fontSize:14,marginBottom:4 }}>✈️ Bot Telegram</div>
        <div style={{ color:C.t3,fontSize:11,marginBottom:12 }}>Posta automaticamente no seu canal</div>
        <Inp label="Bot Token" ph="123456789:AABBccDDee..." val={telegramBot?.token||""} set={v=>setTelegramBot({...telegramBot,token:v})} mono />
        <Inp label="Chat ID do Canal" ph="-1001234567890" val={telegramBot?.chatId||""} set={v=>setTelegramBot({...telegramBot,chatId:v})} mono />
        <div style={{ background:C.s1,borderRadius:10,padding:"9px 12px",marginBottom:12 }}>
          <div style={{ color:C.t2,fontSize:11,fontWeight:700,marginBottom:4 }}>Como criar o bot:</div>
          <div style={{ color:C.t3,fontSize:11,lineHeight:1.8 }}>
            1. Abra o Telegram → busque <strong style={{ color:"#2AABEE" }}>@BotFather</strong><br/>
            2. Digite /newbot → dê um nome<br/>
            3. Copie o token e cole acima<br/>
            4. Adicione o bot ao seu canal como admin<br/>
            5. Chat ID: use @userinfobot para descobrir
          </div>
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:12 }}>
          <div style={{ flex:1,color:C.t1,fontSize:13 }}>Bot ativo</div>
          <Tog val={telegramBot?.active||false} set={v=>setTelegramBot({...telegramBot,active:v})}/>
        </div>
        {telegramBot?.token&&telegramBot?.chatId&&(
          <div style={{ background:"#2AABEE12",border:"1px solid #2AABEE30",borderRadius:10,padding:"9px 12px",color:"#2AABEE",fontSize:12,fontWeight:700 }}>
            ✅ Bot configurado — aparece na fila de posts!
          </div>
        )}
      </Card>

      {/* Supabase Config */}
      <Card s={{ border:`1px solid ${C.blue}30` }}>
        <div style={{ color:C.t1, fontWeight:700, fontSize:13, marginBottom:4 }}>☁️ Backup na Nuvem (Supabase)</div>
        <div style={{ color:C.t3, fontSize:11, marginBottom:10, lineHeight:1.7 }}>
          Salva seus dados na nuvem para não perder nada se limpar o navegador.
        </div>
        <div style={{ background:C.gold+"10", border:`1px solid ${C.gold}25`, borderRadius:10, padding:"9px 12px", marginBottom:10 }}>
          <div style={{ color:C.gold, fontSize:11, fontWeight:700, marginBottom:4 }}>⚙️ Configure no Vercel:</div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:C.t3, lineHeight:2 }}>
            SUPABASE_URL = https://xxx.supabase.co<br/>
            SUPABASE_ANON_KEY = eyJhbGci...
          </div>
          <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color:C.neon, fontSize:11, display:"inline-block", marginTop:6 }}>Criar conta grátis → supabase.com</a>
        </div>
        <div style={{ background:C.neon+"08", border:`1px solid ${C.neon}20`, borderRadius:10, padding:"9px 12px" }}>
          <div style={{ color:C.neon, fontSize:11 }}>
            ✅ Sem Supabase: dados salvos no dispositivo (localStorage)<br/>
            ✅ Com Supabase: backup automático na nuvem
          </div>
        </div>
      </Card>

      {/* PWA Install hint */}
      <Card s={{ background:`linear-gradient(135deg,${C.blue}10,${C.purple}08)`, border:`1px solid ${C.blue}30` }}>
        <div style={{ color:C.t1, fontWeight:700, fontSize:13, marginBottom:4 }}>📱 Instalar como App</div>
        <div style={{ color:C.t3, fontSize:11, marginBottom:10, lineHeight:1.7 }}>
          Instale o AfiliadoAI na tela inicial do seu celular como um app nativo!
        </div>
        <div style={{ background:C.s1, borderRadius:10, padding:"9px 12px" }}>
          <div style={{ color:C.t2, fontSize:11, lineHeight:1.8 }}>
            <strong style={{ color:C.t1 }}>Android (Chrome):</strong><br/>
            Menu ··· → "Adicionar à tela inicial"<br/><br/>
            <strong style={{ color:C.t1 }}>iPhone (Safari):</strong><br/>
            Compartilhar → "Adicionar à Tela de Início"
          </div>
        </div>
      </Card>

      <Btn full onClick={onLogout} v="r" s={{ padding:"13px 0" }}>🚪 Sair da Conta</Btn>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════
const TABS = [
  { id:"Dashboard", ico:"⚡", lbl:"Início" },
  { id:"Links",     ico:"🔗", lbl:"Links" },
  { id:"Mensagens", ico:"💬", lbl:"Mensagens" },
  { id:"Roteiros",  ico:"📝", lbl:"Roteiros" },
  { id:"Vídeos",    ico:"🎬", lbl:"Vídeos" },
  { id:"VideoAI",   ico:"🤖", lbl:"VideoAI" },
  { id:"MeuVideo",  ico:"📹", lbl:"Meu Vídeo" },
  { id:"AutoPost",  ico:"🚀", lbl:"AutoPost" },
  { id:"Fila",      ico:"📋", lbl:"Fila" },
  { id:"IA",        ico:"🤖", lbl:"IA" },
  { id:"Vitrine",   ico:"🏪", lbl:"Vitrine" },
  { id:"Contas",    ico:"📱", lbl:"Contas" },
  { id:"Config",    ico:"⚙️",  lbl:"Config" },
];





// ══════════════════════════════════════════════════════
// MEU VÍDEO — Upload + Link de vídeo próprio + Post
// ══════════════════════════════════════════════════════
function MeuVideo({ links, addVideo, queue, setQueue, goTo }) {
  const [tab, setTab] = useState("link"); // link | upload
  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [selLink, setSelLink] = useState(links[0]||null);
  const [platform, setPlatform] = useState("tiktok");
  const [caption, setCaption] = useState("");
  const [generating, setGenerating] = useState(false);
  const [added, setAdded] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPrev, setUploadPrev] = useState(null);
  const [scheduledAt, setScheduledAt] = useState("");

  const PLATS = [
    { id:"tiktok",    ico:"🎵", name:"TikTok",    color:"#FF0050" },
    { id:"instagram", ico:"📸", name:"Instagram",  color:"#E91E8C" },
    { id:"youtube",   ico:"▶️",  name:"YouTube",    color:"#FF0000" },
    { id:"facebook",  ico:"👤", name:"Facebook",   color:"#1877F2" },
    { id:"kwai",      ico:"⭐", name:"Kwai",       color:"#FF6B00" },
    { id:"telegram",  ico:"✈️",  name:"Telegram",   color:"#2AABEE" },
  ];

  const selPlat = PLATS.find(p=>p.id===platform)||PLATS[0];

  // Generate caption with ARIA
  const genCaption = async () => {
    if (!selLink) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/ai-manager", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          mode:"optimize_text",
          data:{ platform, productName:selLink.productName, price:selLink.price, text:`Vídeo mostrando ${selLink.productName}. Produto em promoção, link na bio.` }
        })
      });
      const d = await res.json();
      if (d.response) {
        const lines = d.response.split("\n").filter(l=>l.trim()&&!l.startsWith("#")&&!l.includes("**"));
        setCaption(lines[0]||d.response.slice(0,200));
      }
    } catch(e){}
    setGenerating(false);
  };

  // Handle file upload
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) { alert("Selecione um arquivo de vídeo!"); return; }
    if (file.size > 100*1024*1024) { alert("Vídeo muito grande! Máximo 100MB."); return; }
    setUploadFile(file);
    setTitle(file.name.replace(/\.[^.]+$/,""));
    const url = URL.createObjectURL(file);
    setUploadPrev(url);
  };

  // Add to queue
  const addToQueue = () => {
    const vUrl = tab==="link" ? videoUrl : uploadPrev;
    if (!vUrl && !uploadFile) return;
    const text = caption || (selLink ? `🔥 ${selLink.productName}${selLink.price?" — "+selLink.price:""}\n\n👉 Link na bio!\n\n#afiliado #oferta #desconto` : "Confira esse produto incrível! Link na bio! 🔥");
    const item = {
      id: Date.now().toString(),
      linkId: selLink?.id||"",
      productName: selLink?.productName||title||"Meu Vídeo",
      platform,
      videoUrl: vUrl,
      videoFile: tab==="upload" ? uploadFile?.name : null,
      text,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
      status:"pending",
      createdAt: new Date().toISOString(),
      type:"meu-video",
      isVideo: true,
    };
    setQueue([item, ...queue]);
    // Also save to videos
    addVideo({ id:item.id, title:item.productName, videoUrl:vUrl, fmt:platform, thumb:selLink?.thumb||null, createdAt:item.createdAt });
    setAdded(true);
    setTimeout(()=>setAdded(false), 3000);
  };

  const openPlatform = () => {
    const urls = { tiktok:"https://www.tiktok.com/upload", instagram:"https://www.instagram.com", youtube:"https://studio.youtube.com", facebook:"https://www.facebook.com", kwai:"https://www.kwai.com", telegram:"https://web.telegram.org" };
    window.open(urls[platform]||"https://www.tiktok.com/upload","_blank");
  };

  return (
    <div className="fu" style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Header */}
      <Card glow={C.blue} s={{ background:`linear-gradient(135deg,${C.blue}10,${C.purple}08)`, border:`1px solid ${C.blue}30` }}>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <div style={{ width:50,height:50,borderRadius:14,background:`linear-gradient(135deg,${C.blue},${C.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0 }}>📹</div>
          <div style={{ flex:1 }}>
            <div style={{ color:C.t1,fontWeight:900,fontSize:15 }}>Meu Vídeo</div>
            <div style={{ color:C.t3,fontSize:11,marginTop:2 }}>Cole o link ou faça upload do seu vídeo</div>
          </div>
        </div>
      </Card>

      {/* Tab toggle — Link ou Upload */}
      <div style={{ display:"flex", background:C.s1, border:`1px solid ${C.b1}`, borderRadius:14, padding:4, gap:4 }}>
        <button onClick={()=>setTab("link")} style={{ flex:1,padding:"10px 0",borderRadius:11,border:"none",background:tab==="link"?`linear-gradient(135deg,${C.blue},${C.purple})`:"transparent",color:tab==="link"?"#fff":C.t3,fontWeight:700,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
          🔗 Colar Link do Vídeo
        </button>
        <button onClick={()=>setTab("upload")} style={{ flex:1,padding:"10px 0",borderRadius:11,border:"none",background:tab==="upload"?`linear-gradient(135deg,${C.blue},${C.purple})`:"transparent",color:tab==="upload"?"#fff":C.t3,fontWeight:700,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
          📤 Fazer Upload
        </button>
      </div>

      {/* TAB: LINK */}
      {tab==="link" && (
        <Card>
          <div style={{ color:C.t1,fontWeight:700,fontSize:14,marginBottom:12 }}>🔗 Link do Vídeo</div>
          <div style={{ color:C.t2,fontSize:11,marginBottom:8 }}>Cole o link do vídeo (YouTube, TikTok, Google Drive, Dropbox...)</div>
          <Inp label="Link do vídeo" ph="https://youtube.com/watch?v=... ou https://drive.google.com/..." val={videoUrl} set={setVideoUrl} mono />
          <Inp label="Título (opcional)" ph="Nome do vídeo" val={title} set={setTitle} />
          {videoUrl && (
            <div style={{ background:C.s1,borderRadius:12,padding:10,marginTop:10 }}>
              <div style={{ color:C.t3,fontSize:10,marginBottom:6 }}>PRÉVIA DO LINK:</div>
              <div style={{ color:C.neon,fontSize:11,fontFamily:"monospace",wordBreak:"break-all" }}>{videoUrl}</div>
            </div>
          )}
        </Card>
      )}

      {/* TAB: UPLOAD */}
      {tab==="upload" && (
        <Card>
          <div style={{ color:C.t1,fontWeight:700,fontSize:14,marginBottom:12 }}>📤 Upload do Vídeo</div>
          <input type="file" accept="video/*" onChange={handleFile} id="vid-upload" style={{ display:"none" }}/>
          {!uploadFile ? (
            <label htmlFor="vid-upload" style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:"32px 16px",background:C.s1,border:`2px dashed ${C.b2}`,borderRadius:14,cursor:"pointer" }}>
              <div style={{ fontSize:40 }}>📹</div>
              <div style={{ color:C.t1,fontWeight:700,fontSize:13 }}>Toque para selecionar o vídeo</div>
              <div style={{ color:C.t3,fontSize:11 }}>MP4, MOV, AVI · Máx 100MB</div>
            </label>
          ) : (
            <div>
              {uploadPrev && (
                <video src={uploadPrev} controls style={{ width:"100%",borderRadius:12,maxHeight:200,background:"#000" }}/>
              )}
              <div style={{ display:"flex",gap:8,alignItems:"center",marginTop:10,padding:"10px 12px",background:C.s1,borderRadius:12 }}>
                <span style={{ fontSize:20 }}>🎬</span>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ color:C.t1,fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{uploadFile.name}</div>
                  <div style={{ color:C.t3,fontSize:10,marginTop:1 }}>{(uploadFile.size/1024/1024).toFixed(1)} MB</div>
                </div>
                <button onClick={()=>{setUploadFile(null);setUploadPrev(null);}} style={{ background:C.red+"18",border:`1px solid ${C.red}30`,borderRadius:8,padding:"5px 10px",color:C.red,fontSize:11,cursor:"pointer" }}>✕</button>
              </div>
              <Inp label="Título do vídeo" ph="Ex: Review Samsung Galaxy A55" val={title} set={setTitle} />
            </div>
          )}
          <div style={{ marginTop:10 }}>
            <div style={{ background:`${C.blue}10`,border:`1px solid ${C.blue}25`,borderRadius:10,padding:"9px 12px" }}>
              <div style={{ color:C.blue,fontSize:11,lineHeight:1.8 }}>
                💡 <strong style={{ color:C.t1 }}>Dica:</strong> Para postar diretamente nas plataformas, o vídeo precisa ser enviado pelo app de cada uma. Use o link do Google Drive ou YouTube para compartilhar de forma mais fácil.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Produto vinculado */}
      <Card>
        <div style={{ color:C.t1,fontWeight:700,fontSize:14,marginBottom:12 }}>🛒 Produto do Vídeo (opcional)</div>
        {links.length===0 ? (
          <div style={{ color:C.t3,fontSize:12,textAlign:"center",padding:"10px 0" }}>
            Nenhum link salvo. <button onClick={()=>goTo("Links")} style={{ color:C.neon,background:"none",border:"none",cursor:"pointer",fontWeight:700 }}>Adicionar →</button>
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            <button onClick={()=>setSelLink(null)} style={{ display:"flex",gap:8,alignItems:"center",padding:"8px 12px",background:!selLink?C.neon+"12":"transparent",border:`1px solid ${!selLink?C.neon+"40":C.b1}`,borderRadius:10,cursor:"pointer",color:!selLink?C.neon:C.t3,fontWeight:600,fontSize:12 }}>
              <span>🚫</span> Sem produto vinculado
            </button>
            {links.slice(0,5).map(l=>(
              <button key={l.id} onClick={()=>setSelLink(l)} style={{ display:"flex",gap:10,alignItems:"center",padding:"9px 12px",background:selLink?.id===l.id?C.blue+"12":"transparent",border:`1px solid ${selLink?.id===l.id?C.blue+"40":C.b1}`,borderRadius:11,cursor:"pointer" }}>
                <ProductThumb thumb={l.thumb} store={STORES.find(s=>s.id===l.storeId)} size={36} />
                <div style={{ flex:1,minWidth:0,textAlign:"left" }}>
                  <div style={{ color:C.t1,fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{l.productName}</div>
                  {l.price&&<div style={{ color:C.neon,fontSize:11 }}>{l.price}</div>}
                </div>
                {selLink?.id===l.id&&<span style={{ color:C.blue }}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Plataforma */}
      <Card>
        <div style={{ color:C.t1,fontWeight:700,fontSize:14,marginBottom:12 }}>📱 Onde Postar</div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6 }}>
          {PLATS.map(p=>(
            <button key={p.id} onClick={()=>setPlatform(p.id)} style={{ padding:"10px 6px",borderRadius:11,border:`1px solid ${platform===p.id?p.color+"60":C.b1}`,background:platform===p.id?p.color+"15":"transparent",display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer" }}>
              <span style={{ fontSize:20 }}>{p.ico}</span>
              <span style={{ color:platform===p.id?p.color:C.t3,fontSize:10,fontWeight:700 }}>{p.name}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Legenda */}
      <Card>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
          <div style={{ color:C.t1,fontWeight:700,fontSize:14 }}>✍️ Legenda / Texto</div>
          <button onClick={genCaption} disabled={generating||!selLink} style={{ background:generating?C.s1:`linear-gradient(135deg,${C.purple},${C.blue})`,border:"none",borderRadius:9,padding:"6px 14px",color:generating?C.t3:"#fff",fontWeight:700,fontSize:11,cursor:generating||!selLink?"default":"pointer",display:"flex",alignItems:"center",gap:5 }}>
            {generating?<Spin size={12} color={C.purple}/>:"🤖"} ARIA Gerar
          </button>
        </div>
        <textarea value={caption} onChange={e=>setCaption(e.target.value)} placeholder={`Escreva a legenda para o ${selPlat.name}...
Ex: 🔥 Olha esse produto incrível!
💰 Link na bio!
#afiliado #oferta`}style={{ width:"100%",background:C.s1,border:`1px solid ${caption?C.blue+"40":C.b1}`,borderRadius:11,padding:"11px 13px",color:C.t1,fontSize:12,lineHeight:1.7,minHeight:100,outline:"none",resize:"vertical",fontFamily:"inherit",boxSizing:"border-box" }}/>
        <div style={{ color:C.t3,fontSize:10,marginTop:4,textAlign:"right" }}>{caption.length} caracteres</div>
      </Card>

      {/* Agendar */}
      <Card>
        <div style={{ color:C.t1,fontWeight:700,fontSize:14,marginBottom:10 }}>⏰ Agendar Post (opcional)</div>
        <Inp label="Data e hora" ph="" val={scheduledAt} set={setScheduledAt} type="datetime-local" />
        <div style={{ color:C.t3,fontSize:11,marginTop:4 }}>Deixe vazio para adicionar à fila sem data específica</div>
      </Card>

      {/* Botões de ação */}
      <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
        <button onClick={addToQueue} disabled={(!videoUrl&&!uploadFile)||added} style={{ width:"100%",background:added?`${C.neon}20`:`linear-gradient(135deg,${C.blue},${C.purple})`,border:added?`1px solid ${C.neon}40`:"none",borderRadius:14,padding:"14px 0",color:added?C.neon:"#fff",fontWeight:800,fontSize:14,cursor:(!videoUrl&&!uploadFile)||added?"default":"pointer" }}>
          {added?"✅ Adicionado à Fila!":"📋 Adicionar à Fila de Posts"}
        </button>
        <button onClick={openPlatform} style={{ width:"100%",background:"none",border:`1px solid ${selPlat.color}40`,borderRadius:14,padding:"13px 0",color:selPlat.color,fontWeight:700,fontSize:13,cursor:"pointer" }}>
          {selPlat.ico} Abrir {selPlat.name} para Postar Agora
        </button>
      </div>

      {/* Instrução de como usar */}
      <Card s={{ background:`linear-gradient(135deg,${C.gold}08,${C.orange}06)`, border:`1px solid ${C.gold}20` }}>
        <div style={{ color:C.gold,fontWeight:700,fontSize:13,marginBottom:8 }}>💡 Como usar</div>
        <div style={{ color:C.t3,fontSize:12,lineHeight:1.9 }}>
          <strong style={{ color:C.t1 }}>Opção 1 — Link:</strong> Cole o link do vídeo do YouTube ou Google Drive, gere a legenda com a ARIA e adicione à fila.<br/>
          <strong style={{ color:C.t1 }}>Opção 2 — Upload:</strong> Selecione o vídeo do seu celular/computador, escreva ou gere a legenda e adicione à fila.<br/>
          <strong style={{ color:C.t1 }}>Postar:</strong> Na aba 📋 Fila, clique em "🚀 Postar Agora" para abrir a plataforma com o texto copiado.
        </div>
      </Card>

    </div>
  );
}

// ══════════════════════════════════════════════════════
// VIDEO AI CREATOR — Criação inteligente com JSON2Video
// ══════════════════════════════════════════════════════
function VideoAICreator({ links, selProd, addVideo, goTo }) {
  const [step, setStep] = useState(1); // 1=produto 2=estilo 3=gerar 4=pronto
  const [prod, setProd] = useState(selProd || links[0] || null);
  const [style, setStyle] = useState("reels");
  const [tone, setTone] = useState("urgente");
  const [lang, setLang] = useState("pt-BR-FranciscaNeural");
  const [creating, setCreating] = useState(false);
  const [prog, setProg] = useState(0);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const isVercel = typeof window !== "undefined" &&
    !window.location.hostname.includes("localhost") &&
    !window.location.hostname.includes("claudeusercontent");

  const STYLES = [
    { id:"reels",   label:"📱 Reels/TikTok", w:1080, h:1920, desc:"Vertical 9:16" },
    { id:"youtube", label:"▶️ YouTube",       w:1920, h:1080, desc:"Horizontal 16:9" },
    { id:"square",  label:"⬜ Feed/Square",   w:1080, h:1080, desc:"Quadrado 1:1" },
  ];

  const TONES = [
    { id:"urgente",    label:"🔥 Urgente",     hook:"CORRE! Essa oferta acaba hoje!" },
    { id:"casual",     label:"😊 Casual",      hook:"Olha que produto incrível que achei!" },
    { id:"profissional",label:"💼 Profissional",hook:"Análise completa desse produto:" },
    { id:"curioso",    label:"🤔 Curioso",      hook:"Você conhece esse produto?" },
  ];

  const VOICES = [
    { id:"pt-BR-FranciscaNeural", label:"🎙️ Feminina (Francisca)" },
    { id:"pt-BR-AntonioNeural",   label:"🎙️ Masculina (Antônio)" },
    { id:"pt-BR-BrendaNeural",    label:"🎙️ Feminina (Brenda)" },
  ];

  const buildPayload = () => {
    const dims = STYLES.find(s=>s.id===style) || STYLES[0];
    const hookText = TONES.find(t=>t.id===tone)?.hook || "Veja essa oferta!";
    const name = prod?.productName || "Produto";
    const price = prod?.price || "";
    const link = prod?.originalUrl || "";

    return {
      comment: `AfiliadoAI — ${name}`,
      width: dims.w, height: dims.h,
      scenes: [
        {
          duration: 3,
          elements: [
            { type:"rectangle", x:0, y:0, width:"100%", height:"100%", color:"#04060e" },
            { type:"text", text:hookText, x:"center", y:"35%", width:"88%",
              style:{ fontSize:dims.w===1080&&dims.h===1920?62:42, fontWeight:"bold", color:"#00ddb4", textAlign:"center", fontFamily:"Outfit" }},
          ]
        },
        {
          duration: 6,
          elements: [
            { type:"rectangle", x:0, y:0, width:"100%", height:"100%", color:"#090f1e" },
            ...(prod?.thumb ? [{ type:"image", src:prod.thumb, x:"center", y:"22%", width:"65%", height:"32%", fit:"contain" }] : []),
            { type:"text", text:name, x:"center", y:"65%", width:"88%",
              style:{ fontSize:dims.w===1080&&dims.h===1920?34:28, fontWeight:"bold", color:"#eef2f8", textAlign:"center" }},
            ...(price ? [{ type:"text", text:price, x:"center", y:"78%", width:"88%",
              style:{ fontSize:dims.w===1080&&dims.h===1920?52:38, fontWeight:"bold", color:"#00ddb4", textAlign:"center" }}] : []),
          ]
        },
        {
          duration: 4,
          elements: [
            { type:"rectangle", x:0, y:0, width:"100%", height:"100%", color:"#04060e" },
            { type:"text", text:"👇 LINK NA BIO", x:"center", y:"38%", width:"88%",
              style:{ fontSize:dims.w===1080&&dims.h===1920?58:42, fontWeight:"bold", color:"#f4a918", textAlign:"center" }},
            { type:"text", text:"Oferta por tempo limitado!", x:"center", y:"58%", width:"88%",
              style:{ fontSize:dims.w===1080&&dims.h===1920?28:22, color:"#8898b0", textAlign:"center" }},
          ]
        },
      ],
      voiceover: {
        text: `${name}${price ? ", por apenas " + price : ""}. Não perca! Link na bio.`,
        voice: lang, speed: 1.1,
      },
      subtitles: {
        position: "bottom",
        style: { fontSize:dims.w===1080&&dims.h===1920?26:20, fontWeight:"bold", color:"#fff", background:"rgba(0,0,0,.75)" }
      },
    };
  };

  const createVideo = async () => {
    if (!isVercel) { setError("⚠️ Funciona apenas no Vercel. Suba o app!"); return; }
    setCreating(true); setProg(0); setError(""); setResult(null);
    const steps = ["🎨 Montando cenas..","🖼️ Adicionando produto..","🎵 Adicionando música..","🗣️ Gerando narração..","📝 Adicionando legendas..","🎬 Renderizando.."];
    let si = 0;
    setMsg(steps[0]);
    const iv = setInterval(()=>{ si=Math.min(si+1,steps.length-1); setMsg(steps[si]); setProg(Math.min(si*14,80)); },1200);

    try {
      const res = await fetch("/api/create-video", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ payload: buildPayload() })
      });
      const data = await res.json();
      clearInterval(iv);
      if (data.error) { setError("❌ "+data.error); setCreating(false); setProg(0); return; }

      const projectId = data.movie || data.project_id || data.id;
      if (!projectId) { setError("❌ Sem project_id na resposta"); setCreating(false); setProg(0); return; }

      setMsg("⏳ Renderizando vídeo... ~1-2 min");
      let att = 0;
      const poll = setInterval(async()=>{
        att++;
        if (att > 60) { clearInterval(poll); setCreating(false); setError("⚠️ Tempo excedido. Verifique no painel JSON2Video."); return; }
        try {
          const cr = await fetch(`/api/check-video?project_id=${projectId}`);
          const st = await cr.json();
          setProg(Math.min(80 + att, 98));
          setMsg(`🎬 Renderizando ${Math.min(80+att,98)}%`);
          if ((st.status === "done" || st.status === "ready") && st.url) {
            clearInterval(poll);
            setProg(100); setMsg("✅ Vídeo pronto!");
            const vid = { id:Date.now().toString(), title:prod?.productName||"Vídeo", thumb:st.thumbnail||prod?.thumb||null, videoUrl:st.url, fmt:style, createdAt:new Date().toISOString(), duration:st.duration };
            addVideo(vid);
            setResult(vid);
            setCreating(false); setStep(4);
          } else if (st.status === "error") {
            clearInterval(poll); setCreating(false); setError("❌ Erro na renderização.");
          }
        } catch(e){}
      }, 3000);
    } catch(e) { clearInterval(iv); setCreating(false); setError("❌ "+e.message); }
  };

  const dl = (url, title) => { const a=document.createElement("a"); a.href=url; a.download=`${title||"video"}.mp4`; a.target="_blank"; a.click(); };

  return (
    <div className="fu" style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Header */}
      <Card glow={C.purple} s={{ background:`linear-gradient(135deg,${C.purple}12,${C.blue}08)`, border:`1px solid ${C.purple}35` }}>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <div style={{ width:50,height:50,borderRadius:14,background:`linear-gradient(135deg,${C.purple},${C.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0,boxShadow:`0 4px 20px ${C.purple}40` }}>🤖</div>
          <div style={{ flex:1 }}>
            <div style={{ color:C.t1,fontWeight:900,fontSize:16 }}>VideoAI Creator</div>
            <div style={{ color:C.t3,fontSize:11,marginTop:2 }}>Cria vídeos profissionais automáticos com IA</div>
          </div>
          <Chip c={C.purple}>JSON2Video</Chip>
        </div>
        {!isVercel && <div style={{ marginTop:10,background:C.gold+"12",border:`1px solid ${C.gold}30`,borderRadius:10,padding:"8px 12px",color:C.gold,fontSize:11 }}>⚠️ Configure JSON2VIDEO_API_KEY no Vercel para usar</div>}
      </Card>

      {/* Steps indicator */}
      <div style={{ display:"flex", gap:6 }}>
        {[["1","Produto"],["2","Estilo"],["3","Gerar"],["4","Pronto"]].map(([n,l],i)=>(
          <div key={n} style={{ flex:1, textAlign:"center" }}>
            <div style={{ width:28,height:28,borderRadius:"50%",background:step>i+1?C.neon:step===i+1?`linear-gradient(135deg,${C.purple},${C.blue})`:C.b1,color:step>i+1?"#000":"#fff",fontWeight:800,fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 4px" }}>
              {step>i+1?"✓":n}
            </div>
            <div style={{ color:step===i+1?C.purple:C.t3,fontSize:9,fontWeight:700 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* STEP 1 — Produto */}
      {step===1 && (
        <Card>
          <div style={{ color:C.t1,fontWeight:700,fontSize:14,marginBottom:12 }}>1️⃣ Escolha o Produto</div>
          {links.length===0 ? (
            <Empty ico="🔗" title="Nenhum link salvo" desc="Adicione um link na aba Links primeiro." action={<Btn onClick={()=>goTo("Links")} s={{ padding:"9px 18px" }}>➜ Links</Btn>} />
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              {links.map(l=>(
                <div key={l.id} onClick={()=>setProd(l)} style={{ display:"flex",gap:10,alignItems:"center",padding:"10px 12px",background:prod?.id===l.id?C.purple+"15":C.s1,border:`1px solid ${prod?.id===l.id?C.purple+"50":C.b1}`,borderRadius:12,cursor:"pointer" }}>
                  <ProductThumb thumb={l.thumb} store={STORES.find(s=>s.id===l.storeId)} size={40} />
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ color:C.t1,fontSize:12,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{l.productName}</div>
                    {l.price&&<div style={{ color:C.neon,fontSize:11,marginTop:1 }}>{l.price}</div>}
                  </div>
                  {prod?.id===l.id&&<div style={{ width:20,height:20,borderRadius:"50%",background:C.purple,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12 }}>✓</div>}
                </div>
              ))}
              <Btn full onClick={()=>setStep(2)} dis={!prod} s={{ marginTop:6 }}>Próximo → Estilo</Btn>
            </div>
          )}
        </Card>
      )}

      {/* STEP 2 — Estilo */}
      {step===2 && (
        <Card>
          <div style={{ color:C.t1,fontWeight:700,fontSize:14,marginBottom:12 }}>2️⃣ Escolha o Estilo</div>
          <div style={{ color:C.t2,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8 }}>Formato</div>
          <div style={{ display:"flex",flexDirection:"column",gap:6,marginBottom:16 }}>
            {STYLES.map(s=>(
              <div key={s.id} onClick={()=>setStyle(s.id)} style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:style===s.id?C.purple+"15":C.s1,border:`1px solid ${style===s.id?C.purple+"50":C.b1}`,borderRadius:12,cursor:"pointer" }}>
                <div style={{ fontSize:24 }}>{s.id==="reels"?"📱":s.id==="youtube"?"▶️":"⬜"}</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:C.t1,fontWeight:700,fontSize:13 }}>{s.label}</div>
                  <div style={{ color:C.t3,fontSize:11,marginTop:1 }}>{s.desc}</div>
                </div>
                {style===s.id&&<div style={{ width:20,height:20,borderRadius:"50%",background:C.purple,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12 }}>✓</div>}
              </div>
            ))}
          </div>
          <div style={{ color:C.t2,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8 }}>Tom do Vídeo</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:16 }}>
            {TONES.map(t=>(
              <button key={t.id} onClick={()=>setTone(t.id)} style={{ background:tone===t.id?C.purple+"20":C.s1,border:`1px solid ${tone===t.id?C.purple+"50":C.b1}`,borderRadius:10,padding:"10px 8px",color:tone===t.id?C.purple:C.t3,fontWeight:700,fontSize:12,cursor:"pointer" }}>{t.label}</button>
            ))}
          </div>
          <div style={{ color:C.t2,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8 }}>Voz da Narração</div>
          <div style={{ display:"flex",flexDirection:"column",gap:6,marginBottom:16 }}>
            {VOICES.map(v=>(
              <div key={v.id} onClick={()=>setLang(v.id)} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:lang===v.id?C.neon+"12":C.s1,border:`1px solid ${lang===v.id?C.neon+"40":C.b1}`,borderRadius:11,cursor:"pointer" }}>
                <span style={{ fontSize:16 }}>🎙️</span>
                <span style={{ color:lang===v.id?C.neon:C.t2,fontWeight:600,fontSize:12,flex:1 }}>{v.label}</span>
                {lang===v.id&&<span style={{ color:C.neon }}>✓</span>}
              </div>
            ))}
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <Btn onClick={()=>setStep(1)} v="gh" s={{ padding:"11px 0",flex:1 }}>← Voltar</Btn>
            <Btn onClick={()=>setStep(3)} s={{ padding:"11px 0",flex:2 }}>Próximo → Gerar</Btn>
          </div>
        </Card>
      )}

      {/* STEP 3 — Gerar */}
      {step===3 && (
        <Card>
          <div style={{ color:C.t1,fontWeight:700,fontSize:14,marginBottom:14 }}>3️⃣ Criar Vídeo</div>
          {/* Preview */}
          <div style={{ background:C.s1,borderRadius:12,padding:14,marginBottom:14,border:`1px solid ${C.purple}25` }}>
            <div style={{ color:C.t3,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:10 }}>Resumo</div>
            <div style={{ display:"flex",gap:10,alignItems:"center",marginBottom:8 }}>
              <ProductThumb thumb={prod?.thumb} store={STORES.find(s=>s.id===prod?.storeId)} size={44} />
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ color:C.t1,fontSize:12,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{prod?.productName}</div>
                {prod?.price&&<div style={{ color:C.neon,fontSize:12,marginTop:2 }}>{prod.price}</div>}
              </div>
            </div>
            {[
              ["Formato", STYLES.find(s=>s.id===style)?.label],
              ["Tom", TONES.find(t=>t.id===tone)?.label],
              ["Voz", VOICES.find(v=>v.id===lang)?.label],
            ].map(([k,v])=>(
              <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.b1}` }}>
                <span style={{ color:C.t3,fontSize:11 }}>{k}</span>
                <span style={{ color:C.t1,fontSize:11,fontWeight:600 }}>{v}</span>
              </div>
            ))}
          </div>
          {error && <div style={{ background:C.red+"15",border:`1px solid ${C.red}30`,borderRadius:10,padding:"9px 12px",color:C.red,fontSize:12,marginBottom:10 }}>{error}</div>}
          {creating ? (
            <div style={{ textAlign:"center",padding:"20px 0" }}>
              <Spin size={44} color={C.purple}/>
              <div style={{ color:C.purple,fontWeight:700,fontSize:14,marginTop:12 }}>{msg}</div>
              <div style={{ background:C.s1,borderRadius:99,height:6,overflow:"hidden",marginTop:14 }}>
                <div style={{ width:`${prog}%`,height:"100%",background:`linear-gradient(90deg,${C.purple},${C.blue})`,borderRadius:99,transition:"width .5s ease" }}/>
              </div>
              <div style={{ color:C.t3,fontSize:11,marginTop:6 }}>{prog}%</div>
            </div>
          ) : (
            <div style={{ display:"flex",gap:8 }}>
              <Btn onClick={()=>setStep(2)} v="gh" s={{ padding:"12px 0",flex:1 }}>← Voltar</Btn>
              <Btn onClick={createVideo} v="u" s={{ padding:"12px 0",flex:2 }}>🤖 CRIAR VÍDEO</Btn>
            </div>
          )}
        </Card>
      )}

      {/* STEP 4 — Pronto */}
      {step===4 && result && (
        <Card glow={C.neon} s={{ textAlign:"center" }}>
          <div style={{ fontSize:52,marginBottom:10 }}>🎉</div>
          <div style={{ color:C.neon,fontWeight:900,fontSize:18,marginBottom:6 }}>Vídeo Pronto!</div>
          <div style={{ color:C.t3,fontSize:12,marginBottom:16 }}>{result.title}{result.duration?` · ${result.duration}s`:""}</div>
          {result.thumb&&<img src={result.thumb} alt="" style={{ width:"100%",borderRadius:12,marginBottom:14 }} onError={e=>e.target.style.display="none"}/>}
          <div style={{ display:"flex",gap:8,marginTop:8 }}>
            <button onClick={()=>window.open(result.videoUrl,"_blank")} style={{ flex:1,background:C.blue+"18",border:`1px solid ${C.blue}35`,borderRadius:10,padding:"11px 0",color:C.blue,fontWeight:700,fontSize:13,cursor:"pointer" }}>▶️ Ver</button>
            <button onClick={()=>dl(result.videoUrl,result.title)} style={{ flex:2,background:`linear-gradient(135deg,${C.gold},${C.orange})`,border:"none",borderRadius:10,padding:"11px 0",color:"#000",fontWeight:800,fontSize:13,cursor:"pointer" }}>📥 Baixar</button>
          </div>
          <button onClick={()=>{ setStep(1); setResult(null); setProg(0); setError(""); }} style={{ width:"100%",marginTop:10,background:"none",border:`1px solid ${C.b2}`,borderRadius:10,padding:"10px 0",color:C.t3,fontWeight:700,fontSize:12,cursor:"pointer" }}>
            🔄 Criar outro vídeo
          </button>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// IA MANAGER — ARIA · Claude Sonnet 4
// ══════════════════════════════════════════════════════
function renderMD(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g,'<strong style="color:#eef2f8;font-weight:700">$1</strong>')
    .replace(/^#{1,3} (.+)$/gm,'<div style="color:#9b72f7;font-weight:800;font-size:14px;margin:12px 0 5px;padding-bottom:4px;border-bottom:1px solid #1a2540">$1</div>')
    .replace(/^[-*] (.+)$/gm,'<div style="display:flex;gap:7px;margin:3px 0;align-items:flex-start"><span style="color:#00ddb4;flex-shrink:0;margin-top:2px">▸</span><span>$1</span></div>')
    .replace(/^(\d+)\. (.+)$/gm,'<div style="display:flex;gap:7px;margin:3px 0"><span style="color:#9b72f7;font-weight:700;flex-shrink:0">$1.</span><span>$2</span></div>')
    .replace(/`(.+?)`/g,'<code style="background:#1a2540;color:#00ddb4;padding:1px 6px;border-radius:4px;font-family:monospace;font-size:11px">$1</code>');
}

function AIResponse({ text }) {
  return (
    <div style={{ color:C.t2, fontSize:12, lineHeight:1.9 }}
      dangerouslySetInnerHTML={{ __html: renderMD(text) }} />
  );
}

function AIManager({ stats, links, videos, scripts, queue, connectedAccounts }) {
  const [tab, setTab] = useState("chat");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [messages, setMessages] = useState([{
    role:"ai",
    text:"Olá! Sou a **ARIA** — sua gestora de IA powered by Claude Sonnet.\n\nPosso:\n- Auditar seu app completo e encontrar onde você perde dinheiro\n- Analisar qualquer oferta e dar nota de potencial (0-10)\n- Criar plano de conteúdo de 7 dias personalizado\n- Otimizar textos para cada plataforma\n- Diagnosticar qualquer problema do seu negócio\n\nComo posso te ajudar hoje?"
  }]);
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [selLinkId, setSelLinkId] = useState("");
  const [selPlatform, setSelPlatform] = useState("instagram");

  const isVercel = typeof window !== "undefined" &&
    !window.location.hostname.includes("localhost") &&
    !window.location.hostname.includes("claudeusercontent");

  const LOADING_MSGS = {
    full_audit: ["🔍 Auditando seus dados...", "📊 Calculando métricas...", "🎯 Identificando oportunidades...", "📝 Escrevendo diagnóstico..."],
    analyze_offer: ["🔍 Pesquisando o produto...", "📈 Analisando potencial de mercado...", "🎯 Calculando score...", "✍️ Preparando estratégia..."],
    dashboard_insights: ["📊 Lendo seus dados...", "🧠 Processando padrões...", "💡 Gerando insights..."],
    generate_content_plan: ["📅 Analisando seus produtos...", "🗓️ Montando calendário...", "✍️ Criando plano de 7 dias..."],
    optimize_text: ["✨ Analisando texto...", "🎯 Otimizando para conversão...", "📝 Criando variações..."],
    diagnose: ["🔍 Analisando problema...", "🧠 Identificando causa raiz...", "💊 Prescrevendo solução..."],
    chat: ["🤔 Pensando...", "🧠 Analisando...", "✍️ Respondendo..."],
  };

  const callAI = async (mode, data) => {
    if (!isVercel) return "⚠️ A ARIA funciona apenas no **Vercel**. Configure `ANTHROPIC_API_KEY` nas variáveis de ambiente do Vercel e faça o deploy.";
    try {
      const msgs = LOADING_MSGS[mode] || LOADING_MSGS.chat;
      let mi = 0;
      setLoadingMsg(msgs[0]);
      const iv = setInterval(() => { mi = (mi+1) % msgs.length; setLoadingMsg(msgs[mi]); }, 1800);
      const res = await fetch("/api/ai-manager", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ mode, data })
      });
      clearInterval(iv); setLoadingMsg("");
      const json = await res.json();
      if (json.error) return "❌ " + json.error;
      return json.response;
    } catch(e) { return "❌ Erro: " + e.message; }
  };

  const sendChat = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim(); setInput("");
    setMessages(m => [...m, { role:"user", text:msg }]);
    setLoading(true);
    const resp = await callAI("chat", { message:msg, context:{ links:links.length, cliques:stats.cliques, comissao:stats.comissao, vendas:stats.vendas } });
    setMessages(m => [...m, { role:"ai", text:resp }]);
    setLoading(false);
  };

  const runAudit = async () => {
    setResult({ loading:true, type:"audit" });
    const resp = await callAI("full_audit", { stats, links, videos, scripts, queue, connectedAccounts });
    setResult({ loading:false, type:"audit", text:resp });
  };

  const analyzeOffer = async () => {
    const link = links.find(l=>l.id===selLinkId)||links[0];
    if (!link) return;
    setResult({ loading:true, type:"offer", link });
    const resp = await callAI("analyze_offer", link);
    setResult({ loading:false, type:"offer", link, text:resp });
  };

  const getInsights = async () => {
    setResult({ loading:true, type:"insights" });
    const resp = await callAI("dashboard_insights", { stats, links, videos, queue, scripts });
    setResult({ loading:false, type:"insights", text:resp });
  };

  const genPlan = async () => {
    setResult({ loading:true, type:"plan" });
    const resp = await callAI("generate_content_plan", { links, platforms:PLATFORMS.map(p=>p.name) });
    setResult({ loading:false, type:"plan", text:resp });
  };

  const optimizeText = async () => {
    try {

    const link = links.find(l=>l.id===selLinkId)||links[0];
    if (!link) return;
    setResult({ loading:true, type:"optimize" });
    const tplTexts = {
      tiktok: `🔥 ${link.productName}\n#viral #afiliado #oferta`,
      instagram: `✨ ${link.productName}${link.price?" por "+link.price:""}\n#publi #reels`,
      youtube: `${link.productName} — Vale a pena? REVIEW\nLink: ${link.originalUrl}`,
      twitter: `🔥 ${link.productName}${link.price?" "+link.price:""} ${link.originalUrl} #oferta`,
      facebook: `🔥 ${link.productName}${link.price?" por "+link.price:""}`,
      kwai: `${link.productName}${link.price?" "+link.price:""} #viral`,
      telegram: `*${link.productName}*${link.price?"\n💲 "+link.price:""}\n\n${link.originalUrl}`,
    };
    const resp = await callAI("optimize_text", { platform:selPlatform, productName:link.productName, price:link.price, text:tplTexts[selPlatform]||link.productName });
    setResult({ loading:false, type:"optimize", text:resp });
  
    } catch(e) {
      console.error("optimizeText error:", e);
      setResult(null);
    }
};

  const ResultBox = ({ r }) => (
    <div style={{ background:C.s1, borderRadius:14, overflow:"hidden", border:`1px solid ${C.purple}30` }}>
      <div style={{ display:"flex", gap:8, alignItems:"center", padding:"12px 14px", borderBottom:`1px solid ${C.b1}`, background:C.purple+"08" }}>
        <span style={{ fontSize:18 }}>🤖</span>
        <span style={{ color:C.purple, fontWeight:700, fontSize:13 }}>ARIA — Análise Concluída</span>
        <button onClick={()=>navigator.clipboard?.writeText(r.text)} style={{ marginLeft:"auto", background:C.neon+"15", border:`1px solid ${C.neon}30`, borderRadius:7, padding:"3px 10px", color:C.neon, fontSize:10, cursor:"pointer" }}>📋 Copiar</button>
      </div>
      <div style={{ padding:14, maxHeight:420, overflowY:"auto" }}>
        <AIResponse text={r.text} />
      </div>
      <div style={{ padding:"8px 14px", borderTop:`1px solid ${C.b1}` }}>
        <button onClick={()=>setResult(null)} style={{ background:"none", border:`1px solid ${C.b2}`, borderRadius:8, padding:"6px 14px", color:C.t3, fontSize:11, cursor:"pointer" }}>← Nova análise</button>
      </div>
    </div>
  );

  const LoadingBox = ({ msg }) => (
    <div style={{ textAlign:"center", padding:"28px 0" }}>
      <div style={{ width:52, height:52, background:`linear-gradient(135deg,${C.purple},${C.blue})`, borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, margin:"0 auto 14px", boxShadow:`0 4px 20px ${C.purple}40` }}>🤖</div>
      <div style={{ color:C.purple, fontWeight:700, fontSize:14, marginBottom:6 }}>ARIA pensando...</div>
      <div style={{ color:C.t3, fontSize:12, marginBottom:16 }}>{msg || "Analisando..."}</div>
      <div style={{ display:"flex", gap:4, justifyContent:"center" }}>
        {[0,1,2].map(i=>(
          <div key={i} style={{ width:8, height:8, borderRadius:"50%", background:C.purple, animation:`pulse 1.4s ${i*0.2}s infinite` }} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="fu" style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Header ARIA */}
      <Card glow={C.purple} s={{ background:`linear-gradient(135deg,${C.purple}12,${C.blue}08)`, border:`1px solid ${C.purple}40` }}>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <div style={{ width:52, height:52, borderRadius:16, background:`linear-gradient(135deg,${C.purple},${C.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0, boxShadow:`0 4px 24px ${C.purple}50` }}>🤖</div>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ color:C.t1, fontWeight:900, fontSize:16, letterSpacing:-.5 }}>ARIA</div>
              <Chip c={C.purple}>Groq · Grátis</Chip>
            </div>
            <div style={{ color:C.t3, fontSize:11, marginTop:2 }}>ARIA · Groq Llama 3.3 · 100% Grátis</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:isVercel?C.neon:C.t3, boxShadow:isVercel?`0 0 8px ${C.neon}`:"none" }} className={isVercel?"pulse":""} />
            <div style={{ color:isVercel?C.neon:C.t3, fontSize:9, fontWeight:700 }}>{isVercel?"ONLINE":"OFFLINE"}</div>
          </div>
        </div>
        {!isVercel && (
          <div style={{ marginTop:10, background:C.gold+"12", border:`1px solid ${C.gold}35`, borderRadius:10, padding:"9px 12px" }}>
            <div style={{ color:C.gold, fontWeight:700, fontSize:12, marginBottom:3 }}>⚠️ Para ativar a ARIA no Vercel:</div>
            <div style={{ color:C.t3, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>GROQ_API_KEY = gsk_sua-chave-aqui</div>
            <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ color:C.blue, fontSize:11 }}>Pegar chave grátis → console.groq.com</a>
          </div>
        )}
      </Card>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
        {[["chat","💬","Chat"],["audit","🔎","Auditoria"],["offer","⭐","Oferta"],["insights","📊","Insights"],["plan","📅","Plano"],["optimize","✨","Otimizar"],["timing","⏰","Horários"],["viral","🔥","Viral"]].map(([id,ico,l])=>(
          <button key={id} onClick={()=>{ setTab(id); setResult(null); }} style={{ flex:"1 1 80px", padding:"8px 4px", borderRadius:11, border:`1px solid ${tab===id?C.purple+"60":C.b1}`, background:tab===id?`linear-gradient(135deg,${C.purple}25,${C.blue}18)`:"transparent", color:tab===id?C.purple:C.t3, fontWeight:700, fontSize:11, cursor:"pointer", transition:"all .2s" }}>
            {ico} {l}
          </button>
        ))}
      </div>

      {/* ── CHAT ── */}
      {tab==="chat" && (
        <Card s={{ padding:0 }}>
          <div style={{ maxHeight:400, overflowY:"auto", padding:14, display:"flex", flexDirection:"column", gap:10 }}>
            {(messages||[]).map((m,i)=>(
              <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start", flexDirection:m.role==="user"?"row-reverse":"row" }}>
                <div style={{ width:32, height:32, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, background:m.role==="user"?`linear-gradient(135deg,${C.neon},${C.blue})`:`linear-gradient(135deg,${C.purple},${C.blue})`, color:"#000", fontWeight:800 }}>
                  {m.role==="user"?"V":"A"}
                </div>
                <div style={{ background:m.role==="user"?C.neon+"12":C.s1, border:`1px solid ${m.role==="user"?C.neon+"25":C.b1}`, borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px", padding:"10px 13px", maxWidth:"82%" }}>
                  <AIResponse text={m.text} />
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:`linear-gradient(135deg,${C.purple},${C.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"#000", flexShrink:0 }}>A</div>
                <div style={{ background:C.s1, border:`1px solid ${C.b1}`, borderRadius:"14px 14px 14px 4px", padding:"10px 14px", display:"flex", gap:8, alignItems:"center" }}>
                  <Spin size={14} color={C.purple}/>
                  <span style={{ color:C.t3, fontSize:11 }}>{loadingMsg || "ARIA pensando..."}</span>
                </div>
              </div>
            )}
          </div>
          <div style={{ borderTop:`1px solid ${C.b1}`, padding:"10px 12px", display:"flex", gap:8 }}>
            <input placeholder="Pergunte qualquer coisa para a ARIA..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!loading&&sendChat()}
              style={{ flex:1, background:C.s1, border:`1px solid ${C.b1}`, borderRadius:11, padding:"10px 12px", color:C.t1, fontSize:12, outline:"none" }}
              onFocus={e=>e.target.style.borderColor=C.purple+"70"} onBlur={e=>e.target.style.borderColor=C.b1} />
            <button onClick={sendChat} disabled={loading||!input.trim()} style={{ width:42, height:42, background:loading||!input.trim()?"#1a2540":`linear-gradient(135deg,${C.purple},${C.blue})`, border:"none", borderRadius:11, cursor:loading||!input.trim()?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, transition:"all .2s" }}>
              {loading?<Spin size={16} color="#fff"/>:<span style={{ color:"#fff", fontWeight:800 }}>→</span>}
            </button>
          </div>
          <div style={{ padding:"0 12px 10px", display:"flex", gap:5, flexWrap:"wrap" }}>
            {["Como aumento minhas vendas?","Qual produto focar agora?","Por que não tenho cliques?","Crie um script de vendas"].map(s=>(
              <button key={s} onClick={()=>setInput(s)} style={{ background:C.purple+"12", border:`1px solid ${C.purple}25`, borderRadius:99, padding:"4px 10px", color:C.purple, fontSize:10, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>{s}</button>
            ))}
          </div>
        </Card>
      )}

      {/* ── AUDITORIA COMPLETA ── */}
      {tab==="audit" && (
        <Card>
          <div style={{ color:C.t1, fontWeight:800, fontSize:15, marginBottom:4 }}>🔎 Auditoria Completa do App</div>
          <div style={{ color:C.t3, fontSize:11, marginBottom:14 }}>A ARIA analisa TUDO — dados, links, fila, performance — e entrega um diagnóstico cirúrgico com plano de ação</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
            {[
              { l:"Cliques", v:stats.cliques, c:C.neon, ico:"👆" },
              { l:"Vendas", v:stats.vendas, c:C.gold, ico:"🛒" },
              { l:"Comissão", v:`R$ ${stats.comissao.toFixed(2)}`, c:C.purple, ico:"💰" },
              { l:"Conversão", v:`${stats.cliques>0?((stats.vendas/stats.cliques)*100).toFixed(1):0}%`, c:C.blue, ico:"📈" },
            ].map(x=>(
              <div key={x.l} style={{ background:C.s1, borderRadius:12, padding:"12px 14px", border:`1px solid ${x.c}20` }}>
                <div style={{ fontSize:18, marginBottom:6 }}>{x.ico}</div>
                <div style={{ color:x.c, fontWeight:800, fontSize:20 }}>{x.v}</div>
                <div style={{ color:C.t3, fontSize:10, marginTop:3, textTransform:"uppercase", letterSpacing:.6 }}>{x.l}</div>
              </div>
            ))}
          </div>
          {result?.loading && result?.type==="audit" ? <LoadingBox msg={loadingMsg} />
          : result?.type==="audit" ? <ResultBox r={result} />
          : (
            <>
              <div style={{ background:C.purple+"08", border:`1px solid ${C.purple}20`, borderRadius:12, padding:12, marginBottom:14 }}>
                <div style={{ color:C.t2, fontSize:11, lineHeight:1.8 }}>
                  A ARIA vai analisar:<br/>
                  ▸ Todos os seus links e comissões<br/>
                  ▸ Taxa de conversão real<br/>
                  ▸ Onde você está perdendo dinheiro<br/>
                  ▸ Plataformas conectadas<br/>
                  ▸ Fila de posts e roteiros<br/>
                  ▸ Roadmap de 30 dias personalizado
                </div>
              </div>
              <Btn full onClick={runAudit} v="u" s={{ padding:"13px 0", fontSize:14 }}>🔎 INICIAR AUDITORIA COMPLETA</Btn>
            </>
          )}
        </Card>
      )}

      {/* ── ANÁLISE DE OFERTA ── */}
      {tab==="offer" && (
        <Card>
          <div style={{ color:C.t1, fontWeight:800, fontSize:15, marginBottom:4 }}>⭐ Analisar Oferta</div>
          <div style={{ color:C.t3, fontSize:11, marginBottom:14 }}>Score de potencial 0-10 + estratégia completa de promoção</div>
          {links.length===0 ? (
            <Empty ico="🔍" title="Nenhum link" desc="Adicione links na aba Links primeiro." />
          ) : (
            <>
              <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:8 }}>Selecione a oferta</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
                {links.map(l=>(
                  <div key={l.id} onClick={()=>setSelLinkId(l.id)} style={{ display:"flex", gap:10, alignItems:"center", padding:"10px 12px", background:(selLinkId===l.id||(l===links[0]&&!selLinkId))?C.purple+"12":C.s1, border:`1px solid ${(selLinkId===l.id||(l===links[0]&&!selLinkId))?C.purple+"45":C.b1}`, borderRadius:12, cursor:"pointer" }}>
                    <ProductThumb thumb={l.thumb} store={STORES.find(s=>s.id===l.storeId)} size={38} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:C.t1, fontSize:12, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.productName}</div>
                      <div style={{ color:C.t3, fontSize:10, marginTop:1 }}>{l.storeName}{l.price?" · "+l.price:""}{l.commission?" · "+l.commission:""} · {l.clicks||0} cliques</div>
                    </div>
                    {(selLinkId===l.id||(l===links[0]&&!selLinkId)) && <div style={{ width:20, height:20, borderRadius:"50%", background:C.purple, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0 }}>✓</div>}
                  </div>
                ))}
              </div>
              {result?.loading && result?.type==="offer" ? <LoadingBox msg={loadingMsg} />
              : result?.type==="offer" ? <ResultBox r={result} />
              : <Btn full onClick={analyzeOffer} v="u" s={{ padding:"13px 0", fontSize:14 }}>⭐ ANALISAR OFERTA COM ARIA</Btn>}
            </>
          )}
        </Card>
      )}

      {/* ── INSIGHTS ── */}
      {tab==="insights" && (
        <Card>
          <div style={{ color:C.t1, fontWeight:800, fontSize:15, marginBottom:4 }}>📊 Insights de Performance</div>
          <div style={{ color:C.t3, fontSize:11, marginBottom:14 }}>A ARIA lê seus números reais e diz exatamente o que fazer</div>
          {result?.loading && result?.type==="insights" ? <LoadingBox msg={loadingMsg} />
          : result?.type==="insights" ? <ResultBox r={result} />
          : (
            <>
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
                {[
                  { l:"Cliques totais", v:stats.cliques, c:C.neon },
                  { l:"Vendas", v:stats.vendas, c:C.gold },
                  { l:"Comissão", v:`R$ ${stats.comissao.toFixed(2)}`, c:C.purple },
                  { l:"Taxa conversão", v:`${stats.cliques>0?((stats.vendas/stats.cliques)*100).toFixed(1):0}%`, c:C.blue },
                ].map(x=>(
                  <div key={x.l} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:C.s1, borderRadius:10 }}>
                    <span style={{ color:C.t2, fontSize:12 }}>{x.l}</span>
                    <span style={{ color:x.c, fontWeight:800, fontSize:14 }}>{x.v}</span>
                  </div>
                ))}
              </div>
              <Btn full onClick={getInsights} v="u" s={{ padding:"13px 0", fontSize:14 }}>📊 GERAR INSIGHTS COM ARIA</Btn>
            </>
          )}
        </Card>
      )}

      {/* ── PLANO 7 DIAS ── */}
      {tab==="plan" && (
        <Card>
          <div style={{ color:C.t1, fontWeight:800, fontSize:15, marginBottom:4 }}>📅 Plano de Conteúdo 7 Dias</div>
          <div style={{ color:C.t3, fontSize:11, marginBottom:14 }}>Calendário completo: produto, plataforma, formato, horário e hook de cada post</div>
          {result?.loading && result?.type==="plan" ? <LoadingBox msg={loadingMsg} />
          : result?.type==="plan" ? <ResultBox r={result} />
          : (
            <>
              {links.length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Produtos que serão incluídos</div>
                  {links.slice(0,4).map(l=>(
                    <div key={l.id} style={{ display:"flex", gap:8, alignItems:"center", padding:"7px 0", borderBottom:`1px solid ${C.b1}` }}>
                      <ProductThumb thumb={l.thumb} store={STORES.find(s=>s.id===l.storeId)} size={28} />
                      <span style={{ color:C.t2, fontSize:12, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.productName}</span>
                      {l.price && <span style={{ color:C.neon, fontSize:11, fontWeight:700, flexShrink:0 }}>{l.price}</span>}
                    </div>
                  ))}
                </div>
              )}
              <Btn full onClick={genPlan} v="u" s={{ padding:"13px 0", fontSize:14 }}>📅 CRIAR PLANO DE 7 DIAS</Btn>
            </>
          )}
        </Card>
      )}

      {/* ── MELHORES HORÁRIOS ── */}
      {tab==="timing" && (
        <Card>
          <div style={{ color:C.t1, fontWeight:800, fontSize:15, marginBottom:4 }}>⏰ Melhor Horário por Plataforma</div>
          <div style={{ color:C.t3, fontSize:11, marginBottom:14 }}>ARIA analisa seus dados e sugere o horário ideal para cada plataforma</div>
          {result?.loading && result?.type==="timing" ? <LoadingBox msg={loadingMsg} />
          : result?.type==="timing" ? <ResultBox r={result} />
          : (
            <>
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
                {PLATFORMS.map(p=>(
                  <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:C.s1, borderRadius:12 }}>
                    <span style={{ fontSize:20 }}>{p.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ color:C.t1, fontWeight:600, fontSize:12 }}>{p.name}</div>
                      <div style={{ color:C.t3, fontSize:10, marginTop:1 }}>Horário de pico no Brasil</div>
                    </div>
                    <div style={{ color:C.neon, fontWeight:800, fontSize:13 }}>
                      {p.id==="tiktok"?"20:00":p.id==="instagram"?"19:30":p.id==="youtube"?"21:00":p.id==="facebook"?"18:00":p.id==="kwai"?"21:00":p.id==="telegram"?"10:00":"12:00"}
                    </div>
                  </div>
                ))}
              </div>
              <Btn full onClick={async()=>{ setResult({loading:true,type:"timing"}); const resp=await callAI("chat",{message:"Analise meus dados e sugira o melhor horário para postar em cada plataforma social (TikTok, Instagram, YouTube, Facebook, Kwai, Telegram, X) baseado no mercado brasileiro de afiliados. Dê horários específicos e justificativas.",context:{links:links.length,cliques:stats.cliques,comissao:stats.comissao,vendas:stats.vendas}}); setResult({loading:false,type:"timing",text:resp}); }} v="u" s={{ padding:"13px 0" }}>⏰ ARIA ANALISAR MEUS HORÁRIOS</Btn>
            </>
          )}
        </Card>
      )}

      {/* ── PRODUTO VIRAL ── */}
      {tab==="viral" && (
        <Card>
          <div style={{ color:C.t1, fontWeight:800, fontSize:15, marginBottom:4 }}>🔥 Produto Viral da Semana</div>
          <div style={{ color:C.t3, fontSize:11, marginBottom:14 }}>ARIA detecta o que está vendendo mais no mercado brasileiro agora</div>
          {result?.loading && result?.type==="viral" ? <LoadingBox msg={loadingMsg} />
          : result?.type==="viral" ? <ResultBox r={result} />
          : (
            <>
              <div style={{ background:C.red+"08", border:`1px solid ${C.red}20`, borderRadius:12, padding:12, marginBottom:14 }}>
                <div style={{ color:C.t2, fontSize:11, lineHeight:1.8 }}>
                  A ARIA vai analisar:<br/>
                  🔥 Tendências do mercado brasileiro<br/>
                  📈 Produtos com alta demanda agora<br/>
                  💰 Nichos mais lucrativos da semana<br/>
                  🎯 Qual categoria focar para vender mais
                </div>
              </div>
              {links.length>0&&(
                <div style={{ marginBottom:14 }}>
                  <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:8 }}>Seus links para comparar:</div>
                  {links.slice(0,3).map(l=>(
                    <div key={l.id} style={{ display:"flex", gap:8, alignItems:"center", padding:"7px 10px", background:C.s1, borderRadius:10, marginBottom:5 }}>
                      <span style={{ fontSize:14 }}>🛒</span>
                      <span style={{ color:C.t2, fontSize:12, flex:1 }}>{l.productName}</span>
                      <span style={{ color:C.neon, fontSize:11, fontWeight:700 }}>{l.clicks||0} cliques</span>
                    </div>
                  ))}
                </div>
              )}
              <Btn full onClick={async()=>{ setResult({loading:true,type:"viral"}); const resp=await callAI("chat",{message:"Analise as tendências do mercado de afiliados no Brasil agora em 2025. Quais produtos/nichos estão viralizando? Quais categorias têm mais conversão? Dê recomendações específicas do que eu deveria promover agora para maximizar ganhos. Meus produtos atuais: "+links.map(l=>l.productName).join(", "),context:{links:links.length,cliques:stats.cliques,comissao:stats.comissao,vendas:stats.vendas}}); setResult({loading:false,type:"viral",text:resp}); }} s={{ padding:"13px 0", background:`linear-gradient(135deg,${C.red},${C.orange})` }}>🔥 DETECTAR PRODUTOS VIRAIS</Btn>
            </>
          )}
        </Card>
      )}

      {/* ── OTIMIZAR TEXTO ── */}
      {tab==="optimize" && (
        <Card>
          <div style={{ color:C.t1, fontWeight:800, fontSize:15, marginBottom:4 }}>✨ Otimizar Texto</div>
          <div style={{ color:C.t3, fontSize:11, marginBottom:14 }}>2 versões otimizadas + dica exclusiva para cada plataforma</div>
          {links.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Produto</div>
              <select value={selLinkId||links[0]?.id} onChange={e=>setSelLinkId(e.target.value)}
                style={{ width:"100%", background:C.s1, border:`1px solid ${C.b1}`, borderRadius:10, padding:"9px 12px", color:C.t1, fontSize:12, outline:"none" }}>
                {links.map(l=><option key={l.id} value={l.id}>{l.productName}{l.price?" — "+l.price:""}</option>)}
              </select>
            </div>
          )}
          <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:8 }}>Plataforma alvo</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:14 }}>
            {PLATFORMS.map(p=>(
              <button key={p.id} onClick={()=>setSelPlatform(p.id)} style={{ display:"flex", alignItems:"center", gap:7, background:selPlatform===p.id?p.color+"20":C.s1, border:`1px solid ${selPlatform===p.id?p.color+"55":C.b1}`, borderRadius:10, padding:"8px 10px", cursor:"pointer", transition:"all .2s" }}>
                <span style={{ fontSize:16 }}>{p.icon}</span>
                <span style={{ color:selPlatform===p.id?p.color:C.t3, fontWeight:700, fontSize:11 }}>{p.name}</span>
                {selPlatform===p.id && <div style={{ marginLeft:"auto", width:16, height:16, borderRadius:"50%", background:p.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10 }}>✓</div>}
              </button>
            ))}
          </div>
          {result?.loading && result?.type==="optimize" ? <LoadingBox msg={loadingMsg} />
          : result?.type==="optimize" ? <ResultBox r={result} />
          : <Btn full onClick={optimizeText} dis={links.length===0} v="u" s={{ padding:"13px 0", fontSize:14 }}>✨ OTIMIZAR PARA {PLATFORMS.find(p=>p.id===selPlatform)?.name?.toUpperCase()}</Btn>}
        </Card>
      )}
    </div>
  );
}



// ══════════════════════════════════════════════════════
// CLICK CHART — Gráfico de cliques por dia
// ══════════════════════════════════════════════════════
function ClickChart({ clickHistory, stats }) {
  const days = 7;
  // Build last 7 days data
  const today = new Date();
  const chartData = Array.from({length:days}, (_,i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days-1-i));
    const label = d.toLocaleDateString("pt-BR", {day:"2-digit",month:"2-digit"});
    const found = clickHistory.find(h=>h.date===d.toLocaleDateString("pt-BR"));
    return { label, clicks: found?.clicks || 0 };
  });
  const maxClicks = Math.max(...chartData.map(d=>d.clicks), 1);
  const total = chartData.reduce((s,d)=>s+d.clicks,0);

  return (
    <Card glow={C.neon} s={{ background:`linear-gradient(135deg,${C.neon}06,${C.blue}04)` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <div style={{ color:C.t1, fontWeight:800, fontSize:14 }}>📈 Cliques — 7 dias</div>
          <div style={{ color:C.t3, fontSize:11, marginTop:2 }}>{total} cliques esta semana</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ color:C.neon, fontWeight:900, fontSize:22 }}>{stats.cliques}</div>
          <div style={{ color:C.t3, fontSize:10 }}>total</div>
        </div>
      </div>

      {/* Bar chart */}
      <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:80, marginBottom:8 }}>
        {chartData.map((d,i)=>{
          const pct = maxClicks > 0 ? (d.clicks/maxClicks) : 0;
          const isToday = i === days-1;
          return (
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              {d.clicks > 0 && <div style={{ color:isToday?C.neon:C.t3, fontSize:9, fontWeight:700 }}>{d.clicks}</div>}
              <div style={{ width:"100%", borderRadius:"4px 4px 0 0", height:Math.max(pct*60, d.clicks>0?4:2),
                background:isToday?`linear-gradient(180deg,${C.neon},${C.blue})`:d.clicks>0?C.b2:C.b1,
                transition:"height .5s ease", boxShadow:isToday?`0 0 8px ${C.neon}40`:"none" }} />
            </div>
          );
        })}
      </div>
      {/* Labels */}
      <div style={{ display:"flex", gap:6 }}>
        {chartData.map((d,i)=>(
          <div key={i} style={{ flex:1, textAlign:"center", color:i===days-1?C.neon:C.t3, fontSize:8, fontWeight:i===days-1?700:400 }}>
            {i===days-1?"hoje":d.label}
          </div>
        ))}
      </div>

      {clickHistory.length===0 && (
        <div style={{ textAlign:"center", marginTop:8, color:C.t3, fontSize:11 }}>
          Cliques aparecerão aqui conforme você usa os links 👆
        </div>
      )}
    </Card>
  );
}


// ══════════════════════════════════════════════════════
// VITRINE — Página pública de produtos
// ══════════════════════════════════════════════════════
function Vitrine({ links, user }) {
  const [copied, setCopied] = useState(false);
  const vitrineUrl = typeof window !== "undefined"
    ? window.location.origin + "?vitrine=" + (user?.name?.toLowerCase().replace(/ /g,"_")||"meus-produtos")
    : "";

  const copyUrl = () => {
    navigator.clipboard?.writeText(vitrineUrl);
    setCopied(true); setTimeout(()=>setCopied(false), 2500);
  };

  // Check if we're viewing a vitrine (URL has ?vitrine=)
  const isViewing = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("vitrine");

  if (isViewing) {
    return (
      <div className="fu" style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <Card glow={C.neon} s={{ textAlign:"center", padding:"24px 16px" }}>
          <div style={{ fontSize:44, marginBottom:10 }}>⚡</div>
          <div style={{ color:C.t1, fontWeight:900, fontSize:20 }}>Meus Produtos</div>
          <div style={{ color:C.t3, fontSize:12, marginTop:4 }}>Selecionei os melhores para você!</div>
        </Card>
        {links.map(l=>(
          <Card key={l.id} glow={l.storeColor||C.neon} s={{ border:`1px solid ${(l.storeColor||C.neon)}30` }}>
            <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:12 }}>
              <ProductThumb thumb={l.thumb} store={STORES.find(s=>s.id===l.storeId)} size={64} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:C.t1, fontWeight:700, fontSize:14, lineHeight:1.3 }}>{l.productName}</div>
                <div style={{ color:l.storeColor||C.neon, fontSize:12, marginTop:3 }}>{l.storeName}</div>
                {l.price&&<div style={{ color:C.neon, fontWeight:900, fontSize:22, marginTop:4 }}>{l.price}</div>}
              </div>
            </div>
            <button onClick={()=>window.open(l.originalUrl,"_blank")} style={{ width:"100%", background:`linear-gradient(135deg,${l.storeColor||C.neon},${C.blue})`, border:"none", borderRadius:12, padding:"13px 0", color:"#000", fontWeight:800, fontSize:14, cursor:"pointer" }}>
              🛒 Ver Produto
            </button>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="fu" style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* Header */}
      <Card glow={C.neon} s={{ background:`linear-gradient(135deg,${C.neon}10,${C.blue}08)`, border:`1px solid ${C.neon}30` }}>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <div style={{ width:50,height:50,borderRadius:14,background:`linear-gradient(135deg,${C.neon},${C.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0 }}>🏪</div>
          <div style={{ flex:1 }}>
            <div style={{ color:C.t1, fontWeight:900, fontSize:15 }}>Minha Vitrine</div>
            <div style={{ color:C.t3, fontSize:11, marginTop:2 }}>Página pública com todos seus produtos</div>
          </div>
        </div>

        {/* Share link */}
        <div style={{ marginTop:14, background:C.s1, borderRadius:12, padding:12 }}>
          <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:8 }}>🔗 Seu link da vitrine</div>
          <div style={{ display:"flex", gap:8 }}>
            <div style={{ flex:1, background:C.card, border:`1px solid ${C.b1}`, borderRadius:10, padding:"9px 12px", fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:C.neon, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {vitrineUrl || "https://seu-app.vercel.app?vitrine=..."}
            </div>
            <button onClick={copyUrl} style={{ background:copied?C.neon+"20":`linear-gradient(135deg,${C.neon},${C.blue})`, border:copied?`1px solid ${C.neon}40`:"none", borderRadius:10, padding:"0 14px", color:copied?C.neon:"#000", fontWeight:800, fontSize:12, cursor:"pointer", flexShrink:0 }}>
              {copied?"✅":"📋"}
            </button>
          </div>
          {copied && <div style={{ color:C.neon, fontSize:11, marginTop:6, textAlign:"center" }}>✅ Link copiado! Cole no WhatsApp, Instagram, TikTok...</div>}
        </div>

        {/* Share buttons */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:10 }}>
          <button onClick={()=>window.open(`https://wa.me/?text=${encodeURIComponent("🔥 Confira meus produtos em promoção!\n\n👉 "+vitrineUrl)}`,"_blank")} style={{ background:"#25D36620", border:"1px solid #25D36640", borderRadius:10, padding:"9px 0", color:"#25D366", fontWeight:700, fontSize:12, cursor:"pointer" }}>💬 Compartilhar WA
          </button>
          <button onClick={()=>window.open(`https://t.me/share/url?url=${encodeURIComponent(vitrineUrl)}&text=${encodeURIComponent("🔥 Meus produtos em promoção!")}`,"_blank")} style={{ background:"#2AABEE20", border:"1px solid #2AABEE40", borderRadius:10, padding:"9px 0", color:"#2AABEE", fontWeight:700, fontSize:12, cursor:"pointer" }}>
            ✈️ Compartilhar TG
          </button>
        </div>
      </Card>

      {/* Preview */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ color:C.t1, fontWeight:700, fontSize:14 }}>👁️ Preview da Vitrine</div>
          <Chip c={C.neon}>{links.length} produto{links.length!==1?"s":""}</Chip>
        </div>
        {links.length===0 ? (
          <Empty ico="🏪" title="Vitrine vazia" desc="Adicione links na aba Links para aparecerem aqui." />
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {links.map(l=>(
              <div key={l.id} style={{ display:"flex", gap:10, alignItems:"center", padding:"10px 12px", background:C.s1, borderRadius:12, border:`1px solid ${C.b1}` }}>
                <ProductThumb thumb={l.thumb} store={STORES.find(s=>s.id===l.storeId)} size={46} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:C.t1, fontWeight:600, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.productName}</div>
                  <div style={{ color:C.t3, fontSize:10, marginTop:1 }}>{l.storeName}</div>
                  {l.price&&<div style={{ color:C.neon, fontWeight:700, fontSize:13, marginTop:2 }}>{l.price}</div>}
                </div>
                <div style={{ color:C.neon, fontSize:10, fontWeight:700 }}>{l.clicks||0} cliques</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Tips */}
      <Card s={{ background:`linear-gradient(135deg,${C.gold}08,${C.orange}06)`, border:`1px solid ${C.gold}20` }}>
        <div style={{ color:C.gold, fontWeight:700, fontSize:13, marginBottom:8 }}>💡 Como usar a Vitrine</div>
        <div style={{ color:C.t3, fontSize:12, lineHeight:1.8 }}>
          • Cole o link da vitrine na <strong style={{ color:C.t1 }}>bio do Instagram</strong><br/>
          • Coloque no <strong style={{ color:C.t1 }}>perfil do TikTok</strong><br/>
          • Envie para <strong style={{ color:C.t1 }}>grupos de WhatsApp</strong><br/>
          • Pin no seu <strong style={{ color:C.t1 }}>canal do Telegram</strong><br/>
          • Funciona como um <strong style={{ color:C.neon }}>mini Linktree</strong> de afiliados!
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// FILA DE POSTAGEM — Agendamento + Logs
// ══════════════════════════════════════════════════════
function buildPostText(link, platform, customText) {
  if (customText) return customText;
  const name = link?.productName || "Produto";
  const price = link?.price ? `\n💲 ${link.price}` : "";
  const url = link?.originalUrl || "";
  const templates = {
    tiktok:    `🔥 ${name}${price}\n\n👉 Link na bio!\n\n#viral #afiliado #oferta #compras`,
    instagram: `✨ ${name}${price}\n\n👉 Link na bio!\n\n#publi #reels #viral #oferta`,
    youtube:   `${name}${price}\n\nLink do produto: ${url}\n\n✅ Link de afiliado — ganho comissão se você comprar.`,
    facebook:  `🔥 ${name}${price}\n\n👉 ${url}\n\n#oferta #viral`,
    kwai:      `${name}${price}\n\n👉 ${url}\n\n#viral #oferta`,
    telegram:  `🔥 *${name}*${price}\n\n👉 ${url}`,
    twitter:   `🔥 ${name}${price} 👉 ${url} #oferta #afiliado`,
  };
  return templates[platform] || `${name}${price}\n\n${url}`;
}

function buildOpenUrl(platform, text, link) {
  const url = link?.originalUrl || "";
  const enc = encodeURIComponent;
  switch(platform) {
    case "tiktok":    return "https://www.tiktok.com/upload";
    case "instagram": return "https://www.instagram.com/create/story";
    case "youtube":   return "https://studio.youtube.com";
    case "facebook":  return "https://www.facebook.com/reel/create";
    case "kwai":      return "https://www.kwai.com/creator/upload";
    case "telegram":  return `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`;
    case "twitter":   return `https://twitter.com/intent/tweet?text=${enc(text.slice(0,260))}`;
    default:          return "#";
  }
}

function Fila({ queue, setQueue, postLogs, setPostLogs, links, scripts, telegramBot, setTelegramBot }) {
  const [tab, setTab] = useState("fila"); // fila | novo | logs
  const [form, setForm] = useState({
    linkId: "", platforms: [], scheduledAt: "", interval: "30",
    useInterval: false, customText: "", note: ""
  });
  const [notification, setNotification] = useState(null);
  const [autoFill, setAutoFill] = useState({ days:3, platforms:["tiktok","instagram","telegram"], interval:"60", startDate:"" });
  const [tgPosting, setTgPosting] = useState(null);

  const postToTelegram = async (item) => {
    if (!telegramBot?.token && !telegramBot?.chatId) return;
    setTgPosting(item.id);
    try {
      const link = links.find(l=>l.id===item.linkId);
      await fetch("/api/telegram-bot", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          token: telegramBot.token||"",
          chat_id: telegramBot.chatId||"",
          text: item.text,
          photo: link?.thumb||null,
        })
      });
    } catch(e){}
    setTgPosting(null);
    markDone(item);
  };
  const [autoFillResult, setAutoFillResult] = useState(null);

  const isVercel = typeof window !== "undefined" &&
    !window.location.hostname.includes("localhost") &&
    !window.location.hostname.includes("claudeusercontent");

  const handleAutoFill = async () => {
    if (!autoFill.platforms.length || links.length === 0) return;
    setAutoFillResult({ loading:true, msg:"🤖 ARIA analisando seus produtos...", prog:10 });
    const steps = [
      { msg:"🔍 Escolhendo produtos ideais...", prog:25 },
      { msg:"✍️ Criando textos otimizados...", prog:50 },
      { msg:"🎯 Adaptando para cada plataforma...", prog:70 },
      { msg:"📅 Agendando com intervalos...", prog:85 },
      { msg:"✅ Finalizando fila...", prog:95 },
    ];
    let si = 0;
    const iv = setInterval(() => {
      if (si < steps.length) { setAutoFillResult(r => ({ ...r, ...steps[si] })); si++; }
    }, 1800);
    try {
      const res = await fetch("/api/ai-autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          links,
          platforms: autoFill.platforms,
          days: autoFill.days,
          startDate: autoFill.startDate || new Date().toISOString(),
          intervalMinutes: parseInt(autoFill.interval),
        })
      });
      clearInterval(iv);
      const data = await res.json();
      if (data.error) { setAutoFillResult({ loading:false, error:data.error }); return; }
      // Add to queue
      setQueue(prev => [...prev, ...data.queue].sort((a,b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)));
      setAutoFillResult({ loading:false, done:true, total:data.queue.length, strategy:data.strategy });
    } catch(e) {
      clearInterval(iv);
      setAutoFillResult({ loading:false, error:e.message });
    }
  };

  // Check for due posts every 30s
  useEffect(() => {
    const check = () => {
      const now = new Date();
      queue.forEach(item => {
        if (item.status === "pending") {
          const due = new Date(item.scheduledAt);
          const diff = (due - now) / 1000 / 60; // minutes
          if (diff <= 0 && diff > -2) {
            setNotification(item);
          }
        }
      });
    };
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, [queue]);

  const selLink = links.find(l => l.id === form.linkId) || links[0];

  const addToQueue = () => {
    if (!form.platforms.length) return;
    const baseTime = form.scheduledAt ? new Date(form.scheduledAt) : new Date();
    const intervalMin = parseInt(form.interval) || 30;
    const newItems = (form.platforms||[]).map((pid, i) => {
      const t = new Date(baseTime.getTime() + (form.useInterval ? i * intervalMin * 60000 : 0));
      return {
        id: Date.now().toString() + i,
        linkId: selLink?.id || "",
        productName: selLink?.productName || "Produto",
        platform: pid,
        scheduledAt: t.toISOString(),
        text: buildPostText(selLink, pid, form.customText),
        status: "pending",
        createdAt: new Date().toISOString(),
        note: form.note,
      };
    });
    setQueue([...queue, ...newItems].sort((a,b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)));
    setForm({ linkId:"", platforms:[], scheduledAt:"", interval:"30", useInterval:false, customText:"", note:"" });
    setTab("fila");
  };

  const markDone = (item) => {
    setQueue(queue.map(q => q.id === item.id ? {...q, status:"done", doneAt:new Date().toISOString()} : q));
    setPostLogs([{ id:Date.now().toString(), ...item, status:"done", doneAt:new Date().toISOString() }, ...postLogs]);
  };

  const markSkipped = (item) => {
    setQueue(queue.map(q => q.id === item.id ? {...q, status:"skipped"} : q));
    setPostLogs([{ id:Date.now().toString(), ...item, status:"skipped" }, ...postLogs]);
  };

  const deleteItem = (id) => setQueue(queue.filter(q => q.id !== id));
  const clearDone = () => setQueue(queue.filter(q => q.status === "pending"));

  const pending = queue.filter(q => q.status === "pending");
  const done = queue.filter(q => q.status !== "pending");

  const getPlatform = (id) => PLATFORMS.find(p => p.id === id);

  const formatTime = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = (d - now) / 1000 / 60;
    if (diff < 0) return "Atrasado " + Math.abs(Math.round(diff)) + "min";
    if (diff < 60) return "Em " + Math.round(diff) + " min";
    if (diff < 1440) return "Hoje " + d.toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"});
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"});
  };

  const isOverdue = (iso) => new Date(iso) < new Date();

  return (
    <div className="fu" style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Notification popup */}
      {notification && (
        <div style={{ position:"fixed", top:70, left:16, right:16, zIndex:200, background:`linear-gradient(135deg,${C.gold}20,${C.orange}15)`, border:`1px solid ${C.gold}50`, borderRadius:16, padding:16, boxShadow:`0 8px 32px rgba(0,0,0,.5)` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ color:C.gold, fontWeight:800, fontSize:14, marginBottom:4 }}>⏰ Hora de Postar!</div>
              <div style={{ color:C.t2, fontSize:12 }}>{notification.productName} → {getPlatform(notification.platform)?.name}</div>
            </div>
            <button onClick={()=>setNotification(null)} style={{ background:"none", border:"none", color:C.t3, cursor:"pointer", fontSize:18 }}>✕</button>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            <button onClick={()=>{ navigator.clipboard?.writeText(notification.text).catch(()=>{}); window.open(buildOpenUrl(notification.platform, notification.text, links.find(l=>l.id===notification.linkId)), "_blank"); markDone(notification); setNotification(null); }}
              style={{ flex:2, background:`linear-gradient(135deg,${C.neon},${C.blue})`, border:"none", borderRadius:10, padding:"9px 0", color:"#000", fontWeight:800, fontSize:12, cursor:"pointer" }}>
              🚀 Abrir e Postar
            </button>
            <button onClick={()=>{ markSkipped(notification); setNotification(null); }}
              style={{ flex:1, background:C.s1, border:`1px solid ${C.b1}`, borderRadius:10, padding:"9px 0", color:C.t3, fontWeight:700, fontSize:12, cursor:"pointer" }}>
              Pular
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", background:C.s1, border:`1px solid ${C.b1}`, borderRadius:14, padding:4, gap:4 }}>
        {[["fila","📋 Fila"],["auto","🤖 Auto"],["novo","➕ Manual"],["logs","📊 Logs"]].map(([id,l])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ flex:1, padding:"9px 0", borderRadius:11, border:"none", background:tab===id?id==="auto"?`linear-gradient(135deg,${C.purple},${C.blue})`:`linear-gradient(135deg,${C.neon},${C.blue})`:"transparent", color:tab===id?"#000":C.t3, fontWeight:700, fontSize:id==="auto"?11:12, cursor:"pointer" }}>{l}</button>
        ))}
      </div>

      {/* ── FILA ── */}
      {tab==="fila" && (
        <>
          {pending.length === 0 ? (
            <Card s={{ border:`1px dashed ${C.b2}` }}>
              <Empty ico="📋" title="Fila vazia" desc="Agende posts na aba Agendar para ver aqui." action={<Btn onClick={()=>setTab("novo")} s={{ padding:"9px 18px" }}>➜ Agendar</Btn>} />
            </Card>
          ) : (
            <Card>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div style={{ color:C.t1, fontWeight:700, fontSize:14 }}>📋 Fila de Posts</div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <Chip c={C.neon}>{pending.length} pendente{pending.length>1?"s":""}</Chip>
                  {done.length>0 && <button onClick={clearDone} style={{ background:C.red+"18", border:`1px solid ${C.red}30`, borderRadius:8, padding:"3px 10px", color:C.red, fontSize:10, fontWeight:700, cursor:"pointer" }}>Limpar feitos</button>}
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {(pending||[]).map((item) => {
                  const plt = getPlatform(item.platform);
                  const overdue = isOverdue(item.scheduledAt);
                  const link = links.find(l=>l.id===item.linkId);
                  return (
                    <div key={item.id} style={{ background:overdue?`${C.gold}0a`:C.s1, border:`1px solid ${overdue?C.gold+"50":C.b1}`, borderRadius:14, overflow:"hidden" }}>
                      <div style={{ padding:"12px 12px 0" }}>
                        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                          <div style={{ width:34, height:34, borderRadius:9, background:(plt?.color||C.neon)+"20", border:`1px solid ${(plt?.color||C.neon)}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{plt?.icon||"📱"}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ color:C.t1, fontWeight:700, fontSize:13 }}>{plt?.name} — {item.productName}</div>
                            <div style={{ color:overdue?C.gold:C.t3, fontSize:11, marginTop:1, fontWeight:overdue?700:400 }}>{formatTime(item.scheduledAt)}</div>
                          </div>
                          <button onClick={()=>deleteItem(item.id)} style={{ background:"none", border:"none", color:C.t3, cursor:"pointer", fontSize:16, flexShrink:0 }}>✕</button>
                        </div>
                        <div style={{ margin:"8px 0", background:C.card, borderRadius:8, padding:"7px 10px" }}>
                          <div style={{ color:C.t3, fontSize:9, fontWeight:700, marginBottom:3 }}>TEXTO DO POST</div>
                          <div style={{ color:C.t2, fontSize:11, lineHeight:1.6, whiteSpace:"pre-wrap" }}>{item.text.slice(0,120)}{item.text.length>120?"...":""}</div>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:0, borderTop:`1px solid ${C.b1}` }}>
                        <button onClick={()=>{ navigator.clipboard?.writeText(item.text).catch(()=>{}); window.open(buildOpenUrl(item.platform, item.text, link), "_blank"); markDone(item); }}
                          style={{ flex:2, background:"none", border:"none", borderRight:`1px solid ${C.b1}`, padding:"10px 0", color:C.neon, fontWeight:700, fontSize:12, cursor:"pointer" }}>
                          🚀 Postar Agora
                        </button>
                        {item.platform==="telegram" && telegramBot?.token && (
                          <button onClick={()=>postToTelegram(item)} disabled={tgPosting===item.id}
                            style={{ flex:1, background:"none", border:"none", borderRight:`1px solid ${C.b1}`, padding:"10px 0", color:"#2AABEE", fontWeight:700, fontSize:11, cursor:"pointer" }}>
                            {tgPosting===item.id?<Spin size={12} color="#2AABEE"/>:"🤖 Auto"}
                          </button>
                        )}
                        <button onClick={()=>{ navigator.clipboard?.writeText(item.text).catch(()=>{}); }}
                          style={{ flex:1, background:"none", border:"none", borderRight:`1px solid ${C.b1}`, padding:"10px 0", color:C.t2, fontWeight:700, fontSize:12, cursor:"pointer" }}>
                          📋 Copiar
                        </button>
                        <button onClick={()=>markSkipped(item)}
                          style={{ flex:1, background:"none", border:"none", padding:"10px 0", color:C.t3, fontWeight:700, fontSize:12, cursor:"pointer" }}>
                          Pular
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}


      {/* ── AUTO FILL ARIA ── */}
      {tab==="auto" && (
        <Card glow={C.purple} s={{ border:`1px solid ${C.purple}35` }}>
          <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:14 }}>
            <div style={{ width:46, height:46, borderRadius:14, background:`linear-gradient(135deg,${C.purple},${C.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0, boxShadow:`0 4px 20px ${C.purple}40` }}>🤖</div>
            <div>
              <div style={{ color:C.t1, fontWeight:800, fontSize:15 }}>ARIA Auto-Fila</div>
              <div style={{ color:C.t3, fontSize:11, marginTop:2 }}>IA gera textos otimizados e agenda tudo automaticamente</div>
            </div>
          </div>

          {!isVercel && (
            <div style={{ background:C.gold+"12", border:`1px solid ${C.gold}30`, borderRadius:10, padding:"9px 12px", marginBottom:14 }}>
              <div style={{ color:C.gold, fontSize:11, fontWeight:700 }}>⚠️ Configure ANTHROPIC_API_KEY no Vercel para usar</div>
            </div>
          )}

          {/* Days selector */}
          <div style={{ marginBottom:12 }}>
            <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Quantos dias de conteúdo?</div>
            <div style={{ display:"flex", gap:6 }}>
              {[1,3,5,7].map(d=>(
                <button key={d} onClick={()=>setAutoFill(f=>({...f,days:d}))} style={{ flex:1, background:autoFill.days===d?`linear-gradient(135deg,${C.purple},${C.blue})`:C.s1, border:`1px solid ${autoFill.days===d?C.purple:C.b1}`, borderRadius:10, padding:"9px 0", color:autoFill.days===d?"#fff":C.t3, fontWeight:700, fontSize:12, cursor:"pointer" }}>
                  {d} {d===1?"dia":"dias"}
                </button>
              ))}
            </div>
          </div>

          {/* Platforms */}
          <div style={{ marginBottom:12 }}>
            <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Plataformas</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
              {PLATFORMS.map(p=>{
                const sel = autoFill.platforms.includes(p.id);
                return (
                  <button key={p.id} onClick={()=>setAutoFill(f=>({ ...f, platforms: sel ? f.platforms.filter(x=>x!==p.id) : [...f.platforms, p.id] }))}
                    style={{ display:"flex", alignItems:"center", gap:6, background:sel?p.color+"20":C.s1, border:`1px solid ${sel?p.color+"55":C.b1}`, borderRadius:10, padding:"8px 10px", cursor:"pointer" }}>
                    <span style={{ fontSize:16 }}>{p.icon}</span>
                    <span style={{ color:sel?p.color:C.t3, fontWeight:700, fontSize:11, flex:1, textAlign:"left" }}>{p.name}</span>
                    {sel && <span style={{ color:p.color, fontSize:12 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interval */}
          <div style={{ marginBottom:12 }}>
            <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Intervalo entre posts</div>
            <div style={{ display:"flex", gap:6 }}>
              {[["30","30min"],["60","1h"],["120","2h"],["240","4h"]].map(([v,l])=>(
                <button key={v} onClick={()=>setAutoFill(f=>({...f,interval:v}))} style={{ flex:1, background:autoFill.interval===v?`linear-gradient(135deg,${C.neon},${C.blue})`:C.s1, border:`1px solid ${autoFill.interval===v?C.neon:C.b1}`, borderRadius:10, padding:"8px 0", color:autoFill.interval===v?"#000":C.t3, fontWeight:700, fontSize:11, cursor:"pointer" }}>{l}</button>
              ))}
            </div>
          </div>

          {/* Start date */}
          <div style={{ marginBottom:14 }}>
            <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Início</div>
            <input type="datetime-local" value={autoFill.startDate} onChange={e=>setAutoFill(f=>({...f,startDate:e.target.value}))}
              style={{ width:"100%", background:C.s1, border:`1px solid ${C.b1}`, borderRadius:10, padding:"9px 12px", color:C.t1, fontSize:12, outline:"none", boxSizing:"border-box" }} />
          </div>

          {/* Products summary */}
          {links.length > 0 && (
            <div style={{ background:C.neon+"08", border:`1px solid ${C.neon}20`, borderRadius:10, padding:"9px 12px", marginBottom:14 }}>
              <div style={{ color:C.neon, fontSize:11, fontWeight:700, marginBottom:4 }}>✅ Produtos que serão usados:</div>
              {links.slice(0,4).map(l=>(
                <div key={l.id} style={{ color:C.t3, fontSize:11, marginTop:2 }}>▸ {l.productName}{l.price?" — "+l.price:""}</div>
              ))}
              {links.length > 4 && <div style={{ color:C.t3, fontSize:10, marginTop:2 }}>+{links.length-4} mais...</div>}
            </div>
          )}

          {/* Preview */}
          {autoFill.platforms.length > 0 && (
            <div style={{ background:C.purple+"08", border:`1px solid ${C.purple}20`, borderRadius:10, padding:"9px 12px", marginBottom:14 }}>
              <div style={{ color:C.purple, fontSize:11, fontWeight:700, marginBottom:4 }}>📋 A ARIA vai gerar:</div>
              <div style={{ color:C.t3, fontSize:11 }}>▸ {Math.min(autoFill.days * autoFill.platforms.length, 30)} posts únicos e otimizados</div>
              <div style={{ color:C.t3, fontSize:11, marginTop:2 }}>▸ Textos adaptados para cada plataforma</div>
              <div style={{ color:C.t3, fontSize:11, marginTop:2 }}>▸ Respeitando regras de cada loja</div>
              <div style={{ color:C.t3, fontSize:11, marginTop:2 }}>▸ Agendados com intervalo de {autoFill.interval}min</div>
              <div style={{ color:C.t3, fontSize:11, marginTop:2 }}>▸ Você só aperta o botão "Postar Agora" no horário</div>
            </div>
          )}

          {autoFillResult?.loading ? (
            <div style={{ textAlign:"center", padding:"24px 0" }}>
              <div style={{ width:50, height:50, background:`linear-gradient(135deg,${C.purple},${C.blue})`, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, margin:"0 auto 12px" }}>🤖</div>
              <div style={{ color:C.purple, fontWeight:700, fontSize:14, marginBottom:4 }}>ARIA gerando seus posts...</div>
              <div style={{ color:C.t3, fontSize:12, marginBottom:14 }}>{autoFillResult.msg}</div>
              <div style={{ background:C.s1, borderRadius:99, height:5, overflow:"hidden" }}>
                <div style={{ width:`${autoFillResult.prog||0}%`, height:"100%", background:`linear-gradient(90deg,${C.purple},${C.blue})`, borderRadius:99, transition:"width .5s ease" }} />
              </div>
            </div>
          ) : autoFillResult?.done ? (
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:48, marginBottom:10 }}>🎉</div>
              <div style={{ color:C.neon, fontWeight:800, fontSize:16, marginBottom:6 }}>Fila gerada com sucesso!</div>
              <div style={{ color:C.t2, fontSize:13, marginBottom:6 }}>{autoFillResult.total} posts prontos para postar</div>
              {autoFillResult.strategy && (
                <div style={{ background:C.purple+"12", border:`1px solid ${C.purple}25`, borderRadius:10, padding:"10px 12px", marginBottom:14, textAlign:"left" }}>
                  <div style={{ color:C.purple, fontSize:11, fontWeight:700, marginBottom:4 }}>🎯 Estratégia da ARIA:</div>
                  <div style={{ color:C.t2, fontSize:12, lineHeight:1.6 }}>{autoFillResult.strategy}</div>
                </div>
              )}
              <Btn full onClick={()=>{ setAutoFillResult(null); setTab("fila"); }} s={{ padding:"12px 0" }}>📋 Ver Fila Gerada →</Btn>
              <button onClick={()=>setAutoFillResult(null)} style={{ width:"100%", marginTop:8, background:"none", border:`1px solid ${C.b2}`, borderRadius:10, padding:"9px 0", color:C.t3, fontSize:12, cursor:"pointer" }}>Gerar nova fila</button>
            </div>
          ) : (
            <Btn full onClick={handleAutoFill} dis={!autoFill.platforms.length || links.length===0 || !isVercel}
              v="u" s={{ padding:"13px 0", fontSize:14 }}>
              🤖 ARIA — GERAR FILA AUTOMÁTICA
            </Btn>
          )}
          {links.length===0 && <div style={{ color:C.red, fontSize:11, textAlign:"center", marginTop:8 }}>⚠️ Adicione links na aba Links primeiro</div>}
        </Card>
      )}

      {/* ── AGENDAR ── */}
      {tab==="novo" && (
        <Card glow={C.neon}>
          <div style={{ color:C.t1, fontWeight:700, fontSize:14, marginBottom:14 }}>➕ Agendar Posts</div>

          {/* Link */}
          {links.length > 0 ? (
            <div style={{ marginBottom:12 }}>
              <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Produto</div>
              <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                {links.map(l=>(
                  <div key={l.id} onClick={()=>setForm(f=>({...f,linkId:l.id}))} style={{ display:"flex", gap:10, alignItems:"center", padding:"9px 12px", background:(form.linkId===l.id||(!form.linkId&&l===links[0]))?C.neon+"12":C.s1, border:`1px solid ${(form.linkId===l.id||(!form.linkId&&l===links[0]))?C.neon+"40":C.b1}`, borderRadius:11, cursor:"pointer" }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:C.t1, fontSize:12, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.productName}</div>
                      {l.price && <div style={{ color:C.neon, fontSize:11 }}>{l.price}</div>}
                    </div>
                    {(form.linkId===l.id||(!form.linkId&&l===links[0])) && <span style={{ color:C.neon }}>✓</span>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color:C.t3, fontSize:12, marginBottom:12, textAlign:"center", padding:10 }}>Adicione links primeiro na aba Links</div>
          )}

          {/* Platforms */}
          <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Plataformas (pode selecionar várias)</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:14 }}>
            {PLATFORMS.map(p=>{
              const sel = form.platforms.includes(p.id);
              return (
                <button key={p.id} onClick={()=>setForm(f=>({ ...f, platforms: sel ? f.platforms.filter(x=>x!==p.id) : [...f.platforms, p.id] }))}
                  style={{ display:"flex", alignItems:"center", gap:7, background:sel?p.color+"20":C.s1, border:`1px solid ${sel?p.color+"60":C.b1}`, borderRadius:10, padding:"8px 10px", cursor:"pointer" }}>
                  <span style={{ fontSize:16 }}>{p.icon}</span>
                  <span style={{ color:sel?p.color:C.t3, fontWeight:700, fontSize:11, flex:1, textAlign:"left" }}>{p.name}</span>
                  {sel && <span style={{ color:p.color, fontSize:12 }}>✓</span>}
                </button>
              );
            })}
          </div>

          {/* Date/time */}
          <Inp label="Data e hora do primeiro post" ph="" val={form.scheduledAt} set={v=>setForm(f=>({...f,scheduledAt:v}))} type="datetime-local" />

          {/* Interval toggle */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${C.b1}`, marginBottom:12 }}>
            <div>
              <div style={{ color:C.t1, fontSize:13, fontWeight:600 }}>⏱ Intervalo automático entre plataformas</div>
              <div style={{ color:C.t3, fontSize:11, marginTop:2 }}>Espaça os posts para evitar spam</div>
            </div>
            <Tog val={form.useInterval} set={v=>setForm(f=>({...f,useInterval:v}))} />
          </div>

          {form.useInterval && (
            <div style={{ marginBottom:12 }}>
              <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Intervalo entre posts (minutos)</div>
              <div style={{ display:"flex", gap:6 }}>
                {["15","30","60","120"].map(v=>(
                  <button key={v} onClick={()=>setForm(f=>({...f,interval:v}))} style={{ flex:1, background:form.interval===v?`linear-gradient(135deg,${C.neon},${C.blue})`:C.s1, border:`1px solid ${form.interval===v?C.neon:C.b1}`, borderRadius:9, padding:"8px 0", color:form.interval===v?"#000":C.t3, fontWeight:700, fontSize:12, cursor:"pointer" }}>
                    {v==="60"?"1h":v==="120"?"2h":v+"min"}
                  </button>
                ))}
              </div>
              {form.platforms.length > 1 && form.scheduledAt && (
                <div style={{ marginTop:8, background:C.neon+"08", borderRadius:8, padding:"7px 10px" }}>
                  <div style={{ color:C.t3, fontSize:10, fontWeight:700, marginBottom:4 }}>PRÉVIA DO AGENDAMENTO:</div>
                  {form.platforms.map((pid, i) => {
                    const plt = getPlatform(pid);
                    const t = new Date(new Date(form.scheduledAt).getTime() + i * parseInt(form.interval) * 60000);
                    return (
                      <div key={pid} style={{ color:C.t2, fontSize:11, display:"flex", gap:6, marginBottom:2 }}>
                        <span>{plt?.icon}</span>
                        <span>{plt?.name}</span>
                        <span style={{ color:C.neon, marginLeft:"auto" }}>{t.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Custom text */}
          <div style={{ marginBottom:14 }}>
            <div style={{ color:C.t2, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>Texto personalizado (opcional)</div>
            <textarea placeholder="Deixe em branco para usar o template automático de cada plataforma..." value={form.customText} onChange={e=>setForm(f=>({...f,customText:e.target.value}))} rows={3}
              style={{ width:"100%", background:C.s1, border:`1px solid ${C.b1}`, borderRadius:11, padding:"10px 12px", color:C.t1, fontSize:12, outline:"none", resize:"none", boxSizing:"border-box", lineHeight:1.6 }} />
          </div>

          <Inp label="Nota (opcional)" ph="Ex: Campanha Black Friday..." val={form.note} set={v=>setForm(f=>({...f,note:v}))} />

          <Btn full onClick={addToQueue} dis={!form.platforms.length} s={{ padding:"12px 0" }}>
            📋 ADICIONAR À FILA ({form.platforms.length} post{form.platforms.length!==1?"s":""})
          </Btn>
        </Card>
      )}

      {/* ── LOGS ── */}
      {tab==="logs" && (
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ color:C.t1, fontWeight:700, fontSize:14 }}>📊 Histórico de Posts</div>
            <div style={{ display:"flex", gap:6 }}>
              <Chip c={C.neon}>{postLogs.filter(l=>l.status==="done").length} feitos</Chip>
              <Chip c={C.t3}>{postLogs.filter(l=>l.status==="skipped").length} pulados</Chip>
            </div>
          </div>
          {postLogs.length === 0 ? (
            <Empty ico="📊" title="Nenhum post registrado" desc="Os posts que você marcar como feito aparecerão aqui." />
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {postLogs.slice(0,20).map((log) => {
                const plt = getPlatform(log.platform);
                return (
                  <div key={log.id} style={{ display:"flex", gap:10, alignItems:"center", padding:"10px 12px", background:C.s1, borderRadius:12, border:`1px solid ${log.status==="done"?C.neon+"25":C.b1}` }}>
                    <div style={{ width:32, height:32, borderRadius:9, background:(plt?.color||C.t3)+"20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{plt?.icon||"📱"}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:C.t1, fontSize:12, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{plt?.name} — {log.productName}</div>
                      <div style={{ color:C.t3, fontSize:10, marginTop:1 }}>{log.doneAt ? new Date(log.doneAt).toLocaleDateString("pt-BR")+" "+new Date(log.doneAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) : "—"}</div>
                    </div>
                    <Chip c={log.status==="done"?C.neon:C.t3}>{log.status==="done"?"✅ Feito":"⏭ Pulado"}</Chip>
                  </div>
                );
              })}
              {postLogs.length > 20 && <div style={{ color:C.t3, fontSize:11, textAlign:"center", padding:8 }}>+{postLogs.length-20} registros anteriores</div>}
            </div>
          )}
          {postLogs.length > 0 && (
            <button onClick={()=>setPostLogs([])} style={{ width:"100%", marginTop:12, background:C.red+"15", border:`1px solid ${C.red}30`, borderRadius:10, padding:"8px 0", color:C.red, fontWeight:700, fontSize:12, cursor:"pointer" }}>
              🗑 Limpar histórico
            </button>
          )}
        </Card>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════
// MERCADO LIVRE — Token Manager com auto-refresh
// ══════════════════════════════════════════════════════
async function mlRefreshToken(refresh_token) {
  try {
    const res = await fetch("/api/ml-refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  } catch(e) {
    return null;
  }
}

function mlTokenExpired(tokens) {
  if (!tokens?.expires_at) return true;
  // Renova se faltar menos de 30 minutos
  return Date.now() > tokens.expires_at - 30 * 60 * 1000;
}

async function mlGetValidToken(tokens, setTokens) {
  if (!tokens) return process.env.REACT_APP_ML_ACCESS_TOKEN || null;
  if (!mlTokenExpired(tokens)) return tokens.access_token;
  if (!tokens.refresh_token) return tokens.access_token;
  // Renova automaticamente
  const newTokens = await mlRefreshToken(tokens.refresh_token);
  if (newTokens) { setTokens(newTokens); return newTokens.access_token; }
  return tokens.access_token; // fallback
}



// ══════════════════════════════════════════════════════
// SUPABASE SYNC — Backup na nuvem
// ══════════════════════════════════════════════════════
async function syncToSupabase(userId, table, data) {
  try {
    const res = await fetch("/api/supabase-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", table, data: { ...data, user_id: userId, updated_at: new Date().toISOString() } })
    });
    const json = await res.json();
    return json.ok;
  } catch(e) { return false; }
}

async function loadFromSupabase(userId, table) {
  try {
    const res = await fetch("/api/supabase-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "load", table, user_id: userId })
    });
    const json = await res.json();
    return json.ok ? json.data : null;
  } catch(e) { return null; }
}


// ══════════════════════════════════════════════════════
// AUTO POST PANEL — UI do sistema de postagem automática
// ══════════════════════════════════════════════════════
function AutoPostPanel({ queue, setQueue, telegramBot, goTo }) {
  const { runAutoPost, posting, lastRun, stats } = useAutoPost(queue, setQueue, telegramBot);
  const [interval_, setInterval_] = useState("60");
  const [enabled, setEnabled] = useState(true);

  const pending  = (queue||[]).filter(i => i.status === "pending");
  const done     = (queue||[]).filter(i => i.status === "done");
  const tgPosts  = pending.filter(i => i.platform === "telegram");
  const otherPosts = pending.filter(i => i.platform !== "telegram");

  const PLAT_OPEN = {
    tiktok:    "https://www.tiktok.com/upload",
    instagram: "https://www.instagram.com",
    youtube:   "https://studio.youtube.com",
    facebook:  "https://www.facebook.com",
    kwai:      "https://www.kwai.com",
    twitter:   "https://twitter.com",
    telegram:  "https://web.telegram.org",
  };

  const openAndPost = (item) => {
    navigator.clipboard?.writeText(item.text).catch(() => {});
    window.open(PLAT_OPEN[item.platform] || "https://www.tiktok.com/upload", "_blank");
    setQueue((queue||[]).map(i => i.id === item.id ? { ...i, status: "done", postedAt: new Date().toISOString() } : i));
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

      {/* Header */}
      <Card glow={C.neon} s={{ background:`linear-gradient(135deg,${C.neon}10,${C.blue}08)`, border:`1px solid ${C.neon}30` }}>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <div style={{ width:50, height:50, borderRadius:14, background:`linear-gradient(135deg,${C.neon},${C.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0 }}>🤖</div>
          <div style={{ flex:1 }}>
            <div style={{ color:C.t1, fontWeight:900, fontSize:15 }}>Auto-Post Engine</div>
            <div style={{ color:C.t3, fontSize:11, marginTop:2 }}>Posta automaticamente a cada {interval_} min</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:enabled?C.neon:C.t3, boxShadow:enabled?`0 0 8px ${C.neon}`:"none" }}/>
            <div style={{ color:enabled?C.neon:C.t3, fontSize:9, fontWeight:700 }}>{enabled?"ATIVO":"OFF"}</div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:14 }}>
          {[
            { l:"Na Fila", v:pending.length, c:C.gold },
            { l:"Postados", v:done.length, c:C.neon },
            { l:"Total", v:(queue||[]).length, c:C.blue },
          ].map(x => (
            <div key={x.l} style={{ background:"rgba(0,0,0,.3)", borderRadius:10, padding:"10px 6px", textAlign:"center" }}>
              <div style={{ color:x.c, fontWeight:900, fontSize:22 }}>{x.v}</div>
              <div style={{ color:C.t3, fontSize:9, marginTop:2, textTransform:"uppercase", letterSpacing:.6 }}>{x.l}</div>
            </div>
          ))}
        </div>

        {/* Last run */}
        {lastRun && (
          <div style={{ marginTop:10, color:C.t3, fontSize:11, textAlign:"center" }}>
            Última execução: {lastRun.toLocaleTimeString("pt-BR")}
            {stats.posted > 0 && <span style={{ color:C.neon }}> · {stats.posted} postado(s) no TG</span>}
          </div>
        )}
      </Card>

      {/* Interval selector */}
      <Card>
        <div style={{ color:C.t1, fontWeight:700, fontSize:13, marginBottom:10 }}>⏱️ Intervalo de Postagem</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:6 }}>
          {[["30","30 min"],["60","1 hora"],["120","2 horas"],["240","4 horas"]].map(([val,lbl]) => (
            <button key={val} onClick={() => setInterval_(val)}
              style={{ padding:"9px 0", borderRadius:10, border:`1px solid ${interval_===val?C.neon+"50":C.b1}`, background:interval_===val?C.neon+"15":"transparent", color:interval_===val?C.neon:C.t3, fontWeight:700, fontSize:11, cursor:"pointer" }}>
              {lbl}
            </button>
          ))}
        </div>
        <div style={{ marginTop:10 }}>
          <Tog val={enabled} set={setEnabled} />
          <span style={{ color:C.t2, fontSize:12, marginLeft:10 }}>Auto-post ativo</span>
        </div>
      </Card>

      {/* Manual trigger */}
      <button onClick={() => runAutoPost(true)} disabled={posting || !pending.length}
        style={{ width:"100%", background:posting||!pending.length?"#1a2540":`linear-gradient(135deg,${C.neon},${C.blue})`, border:"none", borderRadius:14, padding:"14px 0", color:posting||!pending.length?C.t3:"#000", fontWeight:800, fontSize:14, cursor:posting||!pending.length?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
        {posting ? <><Spin size={18} color={C.neon}/> Processando...</> : `🚀 Executar Agora (${pending.length} posts)`}
      </button>

      {/* Telegram posts — auto */}
      {tgPosts.length > 0 && (
        <Card s={{ border:`1px solid #2AABEE30` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ color:"#2AABEE", fontWeight:700, fontSize:13 }}>✈️ Telegram — Auto</div>
            <Chip c="#2AABEE">{tgPosts.length}</Chip>
          </div>
          {tgPosts.map(item => (
            <div key={item.id} style={{ padding:"10px 12px", background:C.s1, borderRadius:12, marginBottom:8, border:`1px solid ${C.b1}` }}>
              <div style={{ color:C.t1, fontWeight:600, fontSize:12 }}>{item.productName}</div>
              <div style={{ color:C.t3, fontSize:10, marginTop:2 }}>{new Date(item.scheduledAt).toLocaleString("pt-BR")}</div>
              <div style={{ color:C.t2, fontSize:11, marginTop:6, lineHeight:1.5 }}>{item.text?.slice(0,80)}...</div>
            </div>
          ))}
          <div style={{ background:`#2AABEE10`, border:`1px solid #2AABEE25`, borderRadius:10, padding:"8px 12px", color:"#2AABEE", fontSize:11, marginTop:4 }}>
            🤖 Esses posts serão enviados automaticamente no horário agendado!
          </div>
        </Card>
      )}

      {/* Other platforms — 1-tap post */}
      {otherPosts.length > 0 && (
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ color:C.t1, fontWeight:700, fontSize:13 }}>📱 Outros — 1 Toque</div>
            <Chip>{otherPosts.length}</Chip>
          </div>
          <div style={{ color:C.t3, fontSize:11, marginBottom:10 }}>
            Toque em "Postar Agora" → abre a plataforma com o texto copiado → cole e publique!
          </div>
          {otherPosts.map(item => {
            const plat = {
              tiktok:    { ico:"🎵", name:"TikTok",    color:"#FF0050" },
              instagram: { ico:"📸", name:"Instagram",  color:"#E91E8C" },
              youtube:   { ico:"▶️",  name:"YouTube",    color:"#FF0000" },
              facebook:  { ico:"👤", name:"Facebook",   color:"#1877F2" },
              kwai:      { ico:"⭐", name:"Kwai",       color:"#FF6B00" },
              twitter:   { ico:"🐦", name:"X/Twitter",  color:"#1DA1F2" },
            }[item.platform] || { ico:"📱", name:item.platform, color:C.neon };

            const isDue = new Date(item.scheduledAt) <= new Date();

            return (
              <div key={item.id} style={{ marginBottom:10, background:isDue?`${C.gold}08`:C.s1, border:`1px solid ${isDue?C.gold+"40":C.b1}`, borderRadius:13, overflow:"hidden" }}>
                <div style={{ padding:"10px 12px" }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
                    <div style={{ width:32, height:32, borderRadius:9, background:`${plat.color}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{plat.ico}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ color:C.t1, fontWeight:700, fontSize:12 }}>{plat.name} · {item.productName}</div>
                      <div style={{ color:isDue?C.gold:C.t3, fontSize:10, marginTop:1 }}>
                        {isDue ? "⏰ HORA DE POSTAR!" : new Date(item.scheduledAt).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </div>
                  <div style={{ color:C.t2, fontSize:11, lineHeight:1.5, background:C.card, borderRadius:8, padding:"7px 10px" }}>
                    {item.text?.slice(0,100)}{item.text?.length > 100 ? "..." : ""}
                  </div>
                </div>
                <button onClick={() => openAndPost(item)}
                  style={{ width:"100%", background:`linear-gradient(135deg,${plat.color},${plat.color}cc)`, border:"none", padding:"11px 0", color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  {plat.ico} Postar no {plat.name} Agora →
                </button>
              </div>
            );
          })}
        </Card>
      )}

      {/* Empty state */}
      {pending.length === 0 && (
        <Card>
          <Empty ico="📋" title="Fila vazia" desc="Adicione posts na aba Fila usando a Auto-Fila da ARIA." action={<Btn onClick={() => goTo("Fila")} s={{ padding:"9px 18px" }}>📋 Ir para Fila</Btn>} />
        </Card>
      )}

    </div>
  );
}


// ══════════════════════════════════════════════════════
// AUTO POST ENGINE — Sistema de postagem automática 1h
// ══════════════════════════════════════════════════════
function useAutoPost(queue, setQueue, telegramBot) {
  const [lastRun, setLastRun] = useState(null);
  const [posting, setPosting] = useState(false);
  const [stats, setStats] = useState({ posted: 0, ready: 0 });

  const runAutoPost = async (manual = false) => {
    if (posting) return;
    const pending = queue.filter(i => i.status === "pending");
    if (!pending.length) return;

    setPosting(true);
    try {
      const res = await fetch("/api/auto-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: pending.map(i => ({
            ...i,
            thumb: null, // avoid sending large data
          })),
          telegramToken: telegramBot?.token || "",
          telegramChatId: telegramBot?.chatId || "",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        // Mark posted items as done
        const postedIds = (data.results || [])
          .filter(r => r.status === "posted")
          .map(r => r.id);
        const readyIds = (data.results || [])
          .filter(r => r.status === "ready")
          .map(r => r.id);

        if (postedIds.length > 0) {
          setQueue(queue.map(i =>
            postedIds.includes(i.id) ? { ...i, status: "done", postedAt: new Date().toISOString() } : i
          ));
        }

        setStats({ posted: data.posted, ready: data.ready });
        setLastRun(new Date());

        // Show notification for ready items
        if (readyIds.length > 0 && "Notification" in window && Notification.permission === "granted") {
          new Notification("⏰ AfiliadoAI — Hora de Postar!", {
            body: `${readyIds.length} post(s) pronto(s)! Abra o app e poste agora.`,
            icon: "/favicon.ico",
          });
        }
      }
    } catch(e) {
      console.error("AutoPost error:", e);
    }
    setPosting(false);
  };

  // Run every hour automatically
  useEffect(() => {
    // Run on mount
    runAutoPost();
    // Then every 60 minutes
    const iv = setInterval(() => runAutoPost(), 60 * 60 * 1000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length]);

  return { runAutoPost, posting, lastRun, stats };
}


// ══════════════════════════════════════════════════════
// AUTO POST ENGINE — Sistema de postagem automática 1h
export default function App() {
  const [st, setSt] = useState(()=>{ const s=load(); return s?{...EMPTY,...s}:EMPTY; });
  const [tab, setTab] = useState("Dashboard");
  const [selProd, setSelProd] = useState(null);
  const mlTokens = st.mlTokens;
  const setMlTokens = (tokens) => up({ mlTokens: tokens });

  useEffect(()=>{ save(st); },[st]);

  // Request notification permission on first load
  useEffect(()=>{
    if ("Notification" in window && Notification.permission === "default") {
      setTimeout(()=>{ Notification.requestPermission(); }, 3000);
    }
    // Send notification when post is due
    const checkNotif = () => {
      const now = new Date();
      (st.queue||[]).forEach(item=>{
        if (item.status==="pending") {
          const due = new Date(item.scheduledAt);
          const diff = (due-now)/1000/60;
          if (diff<=0&&diff>-1&&Notification.permission==="granted") {
            new Notification("⏰ AfiliadoAI — Hora de Postar!", {
              body: `${item.productName} → ${item.platform}`,
              icon: "/favicon.ico"
            });
          }
        }
      });
    };
    const iv = setInterval(checkNotif, 60000);
    return ()=>clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[st.queue]);

  // ML OAuth callback handler
  useEffect(()=>{
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (!code) return;
      window.history.replaceState({}, document.title, window.location.pathname);
      fetch("/api/ml-refresh", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ code })
      }).then(r=>r.json()).then(data=>{
        if (data.access_token) { up({ mlTokens: data }); setTab("Config"); }
      }).catch(()=>{});
    } catch(e) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const up = useCallback(p=>setSt(s=>({...s,...p})),[]);
  const login = u => up({user:u});
  const logout = () => { try{localStorage.removeItem(KEY);}catch{} setSt(EMPTY); };
  const goTo = t => setTab(t);

  if (!st.user) return <Login onLogin={login}/>;

  const addLink = l => {
    up({links:[l,...st.links]});
    if (st.user?.id) syncToSupabase(st.user.id, "links", l).catch(()=>{});
  };
  const updateLink = l => {
    up({links:st.links.map(x=>x.id===l.id?l:x)});
    // Track click history for chart
    if (l.clicks > (st.links.find(x=>x.id===l.id)?.clicks||0)) {
      const today = new Date().toLocaleDateString("pt-BR");
      const hist = [...(st.clickHistory||[])];
      const idx = hist.findIndex(h=>h.date===today);
      if (idx>=0) hist[idx].clicks++;
      else hist.push({date:today, clicks:1});
      up({links:st.links.map(x=>x.id===l.id?l:x), clickHistory:hist.slice(-30)});
    }
  };
  const delLink = id => up({links:st.links.filter(l=>l.id!==id)});
  const addVideo = v => up({videos:[v,...st.videos]});
  const delVideo = id => up({videos:st.videos.filter(v=>v.id!==id)});
  const addScript = s => up({scripts:[s,...(st.scripts||[])]});
  const delScript = id => up({scripts:(st.scripts||[]).filter(s=>s.id!==id)});
  const updStats = s => up({stats:s});

  const render = () => {
    switch(tab) {
      case "Dashboard": return <Dashboard stats={st.stats} links={st.links} videos={st.videos} scripts={st.scripts||[]} goTo={goTo} updStats={updStats} addLink={l=>up({links:[l,...st.links]})} clickHistory={st.clickHistory||[]}/>;
      case "Links":     return <Links links={st.links} addLink={addLink} updateLink={updateLink} delLink={delLink} stats={st.stats} updStats={updStats} goTo={goTo} setSelProd={setSelProd} mlTokens={mlTokens} setMlTokens={setMlTokens}/>;
      case "Mensagens": return <Mensagens links={st.links}/>;
      case "Roteiros":  return <Roteiros links={st.links} selProd={selProd} setSelProd={setSelProd} scripts={st.scripts||[]} addScript={addScript} delScript={delScript} goTo={goTo}/>;
      case "Vídeos":    return <Videos videos={st.videos} links={st.links} selProd={selProd} goTo={goTo} addVideo={addVideo} delVideo={delVideo}/>;
      case "VideoAI":   return <VideoAICreator links={st.links} selProd={selProd} addVideo={addVideo} goTo={goTo}/>;
      case "MeuVideo":  return <MeuVideo links={st.links} addVideo={addVideo} queue={st.queue||[]} setQueue={q=>up({queue:q})} goTo={goTo}/>;
      case "AutoPost":  return <AutoPostPanel queue={st.queue||[]} setQueue={q=>up({queue:q})} telegramBot={st.telegramBot||{}} goTo={goTo} />;
      case "Fila":      return <Fila queue={st.queue||[]} setQueue={q=>up({queue:q})} postLogs={st.postLogs||[]} setPostLogs={l=>up({postLogs:l})} links={st.links} scripts={st.scripts||[]} telegrtelegramBot={st.telegramBot||{token:"",chatId:"",active:false}} setTelegramBot={b=>up({telegramBot:b})} />;
      case "IA":        return <AIManager stats={st.stats} links={st.links} videos={st.videos} scripts={st.scripts||[]} queue={st.queue||[]} connectedAccounts={st.connectedAccounts||{}} />;
      case "Analytics": return <div style={{padding:16}}><div style={{color:C.t1,fontWeight:700,fontSize:16,marginBottom:12}}>📊 Analytics</div><div style={{color:C.t3,fontSize:13}}>Configure o Supabase no Vercel para ver relatórios reais de cliques.</div></div>;
      case "Vitrine":   return <Vitrine links={st.links} user={st.user} />;
      case "Contas":    return <Contas accs={st.connectedAccounts} setAccs={a=>up({connectedAccounts:a})} bestTimes={st.bestTimes} setBestTimes={t=>up({bestTimes:t})}/>;
      case "Config":    return <Config settings={st.settings} setSetts={s=>up({settings:s})} customStores={st.customStores||[]} setCustomStores={c=>up({customStores:c})} connectedStores={st.connectedStores||{}} setConnectedStores={f=>up({connectedStores:typeof f==="function"?f(st.connectedStores):f})} mlTokens={mlTokens} setMlTokens={setMlTokens} storeConfigs={st.storeConfigs||{}} setStoreConfigs={cfg=>up({storeConfigs:cfg})} telegrtelegramBot={st.telegramBot||{token:"",chatId:"",active:false}} setTelegramBot={b=>up({telegramBot:b})} onLogout={logout}/>;
      default: return null;
    }
  };

  return (
    <div style={{ background:C.bg, minHeight:"100vh", maxWidth:430, margin:"0 auto", fontFamily:"'Outfit',sans-serif" }}>
      <Sty/>
      <div style={{ position:"fixed", top:-60, left:"50%", transform:"translateX(-50%)", width:380, height:380, borderRadius:"50%", background:`radial-gradient(circle,${C.neon}06,transparent 70%)`, pointerEvents:"none", zIndex:0 }}/>
      <div style={{ position:"sticky", top:0, zIndex:50, background:C.bg+"ee", backdropFilter:"blur(14px)", borderBottom:`1px solid ${C.b1}`, padding:"14px 20px 12px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:26, height:26, background:`linear-gradient(135deg,${C.neon},${C.blue})`, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>⚡</div>
              <span style={{ color:C.t1, fontWeight:900, fontSize:18, letterSpacing:-.5 }}>AfiliadoAI</span>
              <span style={{ background:C.neon, color:"#000", fontSize:9, fontWeight:800, padding:"2px 7px", borderRadius:99, letterSpacing:1.2 }}>PRO</span>
            </div>
            <div style={{ color:C.t3, fontSize:10, marginTop:1, marginLeft:34 }}>Olá, {st.user?.name} 👋</div>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            {st.stats.cliques > 0 && (
              <div style={{ background:C.neon+"18", border:`1px solid ${C.neon}30`, borderRadius:99, padding:"4px 10px", display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:C.neon }} className="pulse"/>
                <span style={{ color:C.neon, fontSize:10, fontWeight:700 }}>{st.stats.cliques} cliques</span>
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div onClick={()=>setTab("Config")} style={{ width:34, height:34, borderRadius:99, background:`linear-gradient(135deg,${C.neon},${C.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"#000", fontSize:14, cursor:"pointer" }}>
              {st.user?.name?.[0]?.toUpperCase()}
            </div>
          </div>
          </div>
        </div>
      </div>
      <div style={{ display:"flex", gap:6, padding:"12px 16px 0", overflowX:"auto", scrollbarWidth:"none" }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flexShrink:0, display:"flex", alignItems:"center", gap:5, background:tab===t.id?`linear-gradient(135deg,${C.neon}18,${C.blue}12)`:"transparent", border:`1px solid ${tab===t.id?C.neon+"50":C.b1}`, borderRadius:99, padding:"7px 14px", color:tab===t.id?C.neon:C.t3, fontWeight:700, fontSize:12, cursor:"pointer", transition:"all .2s" }}>
            <span style={{ fontSize:14 }}>{t.ico}</span><span>{t.lbl}</span>
          </button>
        ))}
      </div>
      <div style={{ padding:"16px 16px 100px", position:"relative", zIndex:1 }} key={tab}>
        {render()}
      </div>
      <PWAInstallBanner />
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:C.bg+"f2", backdropFilter:"blur(16px)", borderTop:`1px solid ${C.b1}`, padding:"10px 4px 22px", zIndex:50 }}>
        <div style={{ display:"flex" }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, background:"none", border:"none", display:"flex", flexDirection:"column", alignItems:"center", gap:3, cursor:"pointer", padding:"4px 0" }}>
              <span style={{ fontSize:tab===t.id?21:17, transition:"font-size .2s" }}>{t.ico}</span>
              <span style={{ fontSize:9, fontWeight:700, color:tab===t.id?C.neon:C.t3 }}>{t.lbl}</span>
              {tab===t.id && <div style={{ width:4, height:4, borderRadius:99, background:C.neon, boxShadow:`0 0 6px ${C.neon}` }}/>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
