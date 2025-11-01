// ==================================================
// ✅ MCP DTcentre - Version Express compatible Render
// ==================================================
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

// --------------------------------------------------
// 🔐 Connexion Supabase
// --------------------------------------------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Variables d'environnement Supabase manquantes");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --------------------------------------------------
// ✅ Vérification du service
// --------------------------------------------------
app.get("/", (_req, res) => {
  res.json({ ok: true, service: "MCP DTcentre" });
});

// --------------------------------------------------
// 🧾 Manifest MCP
// --------------------------------------------------
app.get("/manifest.json", (_req, res) => {
  res.json({
    name: "DTcentre",
    version: "1.0.0",
    description: "Accès à la base Supabase PVManager pour la DT Centre",
    tools: [
      {
        name: "get_stats",
        description: "Récupère des statistiques par colonne",
        parameters: {
          type: "object",
          properties: {
            table: { type: "string" },
            column: { type: "string" },
            from: { type: "string" },
            to: { type: "string" }
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
            table: { type: "string" },
            agent: { type: "string" },
            limit: { type: "integer" }
          },
          required: ["table", "agent"]
        }
      }
    ]
  });
});

// --------------------------------------------------
// 📈 get_stats
// --------------------------------------------------
app.get("/get_stats", async (req, res) => {
  const { table, column, from, to } = req.query;
  if (!table || !column)
    return res.status(400).json({ error: "Paramètres requis : table, column" });

  try {
    let query = supabase.from(table).select(`${column}, date_infraction`);
    if (from) query = query.gte("date_infraction", from);
    if (to) query = query.lte("date_infraction", to);

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });

    const stats = {};
    for (const row of data) {
      const key = row[column] || "Inconnu";
      stats[key] = (stats[key] || 0) + 1;
    }

    res.json({ table, column, from, to, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------
// 📋 get_pv
// --------------------------------------------------
app.get("/get_pv", async (req, res) => {
  const { table, agent, limit } = req.query;
  if (!table || !agent)
    return res.status(400).json({ error: "Paramètres requis : table, agent" });

  try {
    let query = supabase.from(table).select("*").eq("agent_nom", agent);
    if (limit) query = query.limit(parseInt(limit));
    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ count: data.length, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------
// 🚀 Démarrage du serveur (important pour Render)
// --------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ MCP DTcentre running on port ${PORT}`);
});
