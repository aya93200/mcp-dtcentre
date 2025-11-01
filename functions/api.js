// ==================================================
// 🚀 MCP DTcentre - Version finale compatible ChatGPT (SDK officiel)
// ==================================================
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "@modelcontextprotocol/sdk/server.js";

// --------------------------------------------------
// 🔐 Supabase
// --------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --------------------------------------------------
// 🚀 Création du serveur MCP
// --------------------------------------------------
const app = express();
const server = createServer(app);

// --------------------------------------------------
// 🧭 Déclaration du manifest MCP
// --------------------------------------------------
server.setManifest({
  name: "DTcentre",
  description: "Accès à la base Supabase PVManager pour la DT Centre",
  version: "1.0.0",
  tools: [
    {
      name: "get_stats",
      description: "Récupère les statistiques PV sur une période donnée",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", description: "Nom de la table (pv_lci, pv_rd, ...)" },
          column: { type: "string", description: "Colonne à agréger (agent_nom, code_natinf...)" },
          from: { type: "string", description: "Date début (AAAA-MM-JJ)" },
          to: { type: "string", description: "Date fin (AAAA-MM-JJ)" }
        },
        required: ["table", "column"]
      }
    },
    {
      name: "get_pv",
      description: "Récupère les PV d’un agent donné",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", description: "Nom de la table (pv_lci, pv_rd, ...)" },
          agent: { type: "string", description: "Nom de l’agent ou matricule" },
          limit: { type: "integer", description: "Nombre max de lignes (défaut 100)" }
        },
        required: ["table", "agent"]
      }
    }
  ]
});

// --------------------------------------------------
// 🧮 Tool 1 : get_stats
// --------------------------------------------------
server.tool("get_stats", async ({ table, column, from, to }) => {
  let query = supabase.from(table).select(`${column}, date_infraction`);
  if (from) query = query.gte("date_infraction", from);
  if (to) query = query.lte("date_infraction", to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const stats = {};
  for (const row of data) {
    const key = row[column] ?? "Inconnu";
    stats[key] = (stats[key] || 0) + 1;
  }

  return Object.entries(stats)
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
});

// --------------------------------------------------
// 📋 Tool 2 : get_pv
// --------------------------------------------------
server.tool("get_pv", async ({ table, agent, limit = 100 }) => {
  let query = supabase.from(table).select("*").eq("agent_nom", agent).limit(limit);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
});

// --------------------------------------------------
// 🩺 Endpoint santé
// --------------------------------------------------
app.get("/", (_req, res) => res.json({ ok: true, service: "MCP DTcentre (SDK officiel)" }));

// --------------------------------------------------
// 🚀 Démarrage serveur Render
// --------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ MCP DTcentre (SDK officiel) running on port ${PORT}`);
});
