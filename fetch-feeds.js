// Mundial26 · genera goleadores.json, marcadores.json y noticias.json
// Noticias: Google News RSS (sin clave). Goleo/Marcadores: API-Football (necesita API_FOOTBALL_KEY).
// Se ejecuta en GitHub Actions (Node 20, fetch global). Escribe los .json en la raíz del repo.

const fs = require("fs");
const KEY = process.env.API_FOOTBALL_KEY || "";
const LEAGUE = Number(process.env.WC_LEAGUE_ID || 1);   // 1 = Copa del Mundo en API-Football
const SEASON = Number(process.env.WC_SEASON || 2026);

async function af(path) {
  if (!KEY) { console.warn("Sin API_FOOTBALL_KEY: se omiten goleo/marcadores"); return []; }
  try {
    const r = await fetch("https://v3.football.api-sports.io/" + path, { headers: { "x-apisports-key": KEY } });
    const j = await r.json();
    if (j.errors && Object.keys(j.errors).length) console.error("API-Football:", JSON.stringify(j.errors));
    return j.response || [];
  } catch (e) { console.error("AF error:", e.message); return []; }
}

function inplay(s) { return ["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT"].includes(s); }

async function news() {
  try {
    const url = "https://news.google.com/rss/search?q=" + encodeURIComponent("Mundial 2026") + "&hl=es-419&gl=CR&ceid=CR:es";
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const xml = await r.text();
    const items = []; const re = /<item>([\s\S]*?)<\/item>/g; let m;
    while ((m = re.exec(xml)) && items.length < 20) {
      const b = m[1];
      const t = ((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      const l = ((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "").trim();
      if (t) items.push({ title: t, link: l });
    }
    return items;
  } catch (e) { console.error("news error:", e.message); return []; }
}

(async () => {
  const ts = await af(`players/topscorers?league=${LEAGUE}&season=${SEASON}`);
  const goleadores = ts.map(x => ({
    player: x.player && x.player.name,
    team: x.statistics && x.statistics[0] && x.statistics[0].team && x.statistics[0].team.name,
    goals: (x.statistics && x.statistics[0] && x.statistics[0].goals && x.statistics[0].goals.total) || 0
  })).filter(p => p.player);

  const fx = await af(`fixtures?league=${LEAGUE}&season=${SEASON}`);
  const marcadores = fx.map(f => {
    const s = f.fixture.status.short;
    return {
      home: f.teams.home.name, away: f.teams.away.name,
      hs: f.goals.home == null ? "" : f.goals.home,
      as: f.goals.away == null ? "" : f.goals.away,
      status: inplay(s) ? "LIVE" : s,
      min: f.fixture.status.elapsed ? (f.fixture.status.elapsed + "'") : "",
      ts: f.fixture.timestamp
    };
  }).sort((a, b) => (b.ts || 0) - (a.ts || 0));

  const noticias = await news();

  fs.writeFileSync("goleadores.json", JSON.stringify(goleadores));
  fs.writeFileSync("marcadores.json", JSON.stringify(marcadores));
  fs.writeFileSync("noticias.json", JSON.stringify(noticias));
  console.log(`OK  goleadores=${goleadores.length}  marcadores=${marcadores.length}  noticias=${noticias.length}`);
})();
