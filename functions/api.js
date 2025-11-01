// ==================================================
// 🔹 MCP DTcentre — Version finale stable pour Netlify
// ==================================================
const { createClient } = require("@supabase/supabase-js");

// --------------------------------------------------
// 🌍 CORS headers (autorisations pour ChatGPT)
// --------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=600" // 10 min cache
};

// --------------------------------------------------
// 🔐 Connexion Supabase
// --------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Variables d'environnement Supabase manquantes !");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --------------------------------------------------
// 🧾 Manifest MCP
// --------------------------------------------------
function buildManifest() {
  return {
    name: "DTcentre",
    version: "1.0.0",
    description: "Accès à la base Supabase PVManager pour la DT Centre",
    tools: [
      {
        name: "get_stats",
        description: "Récupère des statistiques par colonne (compte/agrégat) sur une période",
        parameters: {
          type: "object",
          properties: {
            table: { type: "string", description: "Nom de la table (pv_lci, pv_rd, ...)" },
            column: { type: "string", description: "Colonne à agréger (ex: agent_nom, code_natinf)" },
            from: { type: "string", description: "Date min (AAAA-MM-JJ), optionnelle" },
            to:   { type: "string", description: "Date max (AAAA-MM-JJ), optionnelle" }
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
            agent: { type: "string", description: "Nom (agent_nom) ou matricule si adapté" },
            limit: { type: "integer", description: "Nombre max de lignes (par défaut 100)" }
          },
          required: ["table", "agent"]
        }
      }
    ]
  };
}

// --------------------------------------------------
// 🧩 Utilitaire : extrait le sous-chemin après /api
// --------------------------------------------------
function subpath(event) {
  const base = "/.netlify/functions/api";
  const i = event.path.indexOf(base);
  return i >= 0 ? event.path.slice(i + base.length) || "/" : "/";
}

// --------------------------------------------------
// 🚀 Handler principal Netlify
// --------------------------------------------------
exports.handler = async (event) => {
  try {
    // Préflight CORS
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    const sp = subpath(event);
    const q = event.queryStringParameters || {};

    // 1️⃣ Santé
    if (sp === "/") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ ok: true, service: "MCP DTcentre" })
      };
    }

    // 2️⃣ Manifest JSON
    if (sp === "/manifest.json") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(buildManifest())
      };
    }

    // 3️⃣ get_stats
    if (sp === "/get_stats") {
      const { table, column, from, to } = q;
      if (!table || !column) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Paramètres requis : table, column" }) };
      }

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

      const out = Object.entries(stats)
        .map(([label, total]) => ({ label, total }))
        .sort((a, b) => b.total - a.total);

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ table, column, from, to, stats: out }) };
    }

    // 4️⃣ get_pv
    if (sp === "/get_pv") {
      const { table, agent, limit } = q;
      if (!table || !agent) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Paramètres requis : table, agent" }) };
      }

      let query = supabase.from(table).select("*").eq("agent_nom", agent);
      query = query.limit(parseInt(limit || 100, 10));

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ table, agent, count: data.length, data }) };
    }

    // 5️⃣ Route inconnue
    return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: `Unknown endpoint ${sp}` }) };

  } catch (e) {
    console.error("❌ Erreur serveur :", e);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message || String(e) }) };
  }
};
