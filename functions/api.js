// ==================================================
// 🔹 MCP DTcentre — Version universelle (Render + Netlify + Local)
// ==================================================
const { createClient } = require("@supabase/supabase-js");

// --------------------------------------------------
// 🔧 Variables d'environnement
// --------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ SUPABASE_URL ou SUPABASE_KEY manquant(s)");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --------------------------------------------------
// 🔄 Headers CORS + SSE
// --------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

// ==================================================
// 🧠 Manifest MCP pour ChatGPT
// ==================================================
function buildManifest() {
  return {
    name: "DTcentre",
    version: "1.0.0",
    description: "Accès à la base Supabase PVManager pour la DT Centre",
    tools: [
      {
        name: "get_stats",
        description: "Récupère des statistiques PV sur une période donnée",
        parameters: {
          type: "object",
          properties: {
            table: { type: "string", description: "Nom de la table (pv_lci, pv_rd...)" },
            column: { type: "string", description: "Colonne à agréger (agent_nom, code_natinf...)" },
            from: { type: "string", description: "Date de début (AAAA-MM-JJ)" },
            to: { type: "string", description: "Date de fin (AAAA-MM-JJ)" },
          },
          required: ["table", "column"],
        },
      },
      {
        name: "get_pv",
        description: "Récupère les PV d’un agent donné",
        parameters: {
          type: "object",
          properties: {
            table: { type: "string", description: "Nom de la table (pv_lci ou pv_rd)" },
            agent: { type: "string", description: "Nom de l’agent ou matricule" },
            limit: { type: "integer", description: "Nombre maximal de résultats" },
          },
          required: ["table", "agent"],
        },
      },
    ],
  };
}

// ==================================================
// 🧩 Serveur HTTP compatible Render
// ==================================================
const express = require("express");
const app = express();
app.use(express.json());

// 🔹 CORS
app.use((req, res, next) => {
  res.set(corsHeaders);
  next();
});

// ✅ Racine
app.get("/", (req, res) => {
  res.json({ ok: true, service: "MCP DTcentre (Render)" });
});

// ✅ Manifest JSON
app.get("/manifest.json", (req, res) => {
  res.json(buildManifest());
});

// ✅ Flux SSE (ChatGPT MCP)
app.get("/sse", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ ok: true, connected: true })}\n\n`);
});

// ✅ get_stats
app.get("/get_stats", async (req, res) => {
  const { table, column, from, to } = req.query;
  if (!table || !column) {
    return res.status(400).json({ error: "Paramètres requis : table, column" });
  }

  let query = supabase.from(table).select(`${column}, date_infraction`);
  if (from) query = query.gte("date_infraction", from);
  if (to) query = query.lte("date_infraction", to);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });

  const stats = {};
  for (const row of data) {
    const key = row[column] ?? "Inconnu";
    stats[key] = (stats[key] || 0) + 1;
  }

  const out = Object.entries(stats)
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);

  res.json({ table, column, from, to, stats: out });
});

// ✅ get_pv
app.get("/get_pv", async (req, res) => {
  const { table, agent, limit } = req.query;
  if (!table || !agent) {
    return res.status(400).json({ error: "Paramètres requis : table, agent" });
  }

  let query = supabase.from(table).select("*").eq("agent_nom", agent);
  if (limit) query = query.limit(parseInt(limit) || 100);
  else query = query.limit(100);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json({ table, agent, count: data.length, data });
});

// ✅ Démarrage Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ MCP DTcentre prêt sur le port ${PORT}`));
