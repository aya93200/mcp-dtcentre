// ==================================================
// 🔹 MCP DTcentre — Version compatible ChatGPT (SSE + REST)
// ==================================================
const { createClient } = require("@supabase/supabase-js");

// --------------------------------------------------
// 🔧 Variables d'environnement
// --------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ SUPABASE_URL ou SUPABASE_KEY manquant(s) dans les variables d'environnement");
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
// 🧠 Fonction utilitaire : manifest JSON pour ChatGPT
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
            table: { type: "string", description: "Nom de la table (pv_lci, pv_rd, ...)" },
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
            limit: { type: "integer", description: "Nombre maximal de résultats (par défaut 100)" },
          },
          required: ["table", "agent"],
        },
      },
    ],
  };
}

// --------------------------------------------------
// 🔀 Routing simplifié (compatible Netlify)
// --------------------------------------------------
exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    const path = event.path.replace("/.netlify/functions/api", "") || "/";
    const params = event.queryStringParameters || {};

    // ✅ Racine : santé du service
    if (path === "/") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ ok: true, service: "MCP DTcentre" }),
      };
    }

    // ✅ Manifest pour ChatGPT
    if (path === "/manifest.json") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(buildManifest(), null, 2),
      };
    }

    // ✅ Flux SSE (connexion MCP)
    if (path === "/sse") {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          ...corsHeaders,
        },
        body: `data: ${JSON.stringify({ ok: true, connected: true, service: "MCP DTcentre" })}\n\n`,
      };
    }

    // ✅ get_stats
    if (path === "/get_stats") {
      const { table, column, from, to } = params;
      if (!table || !column)
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Paramètres requis : table, column" }),
        };

      let query = supabase.from(table).select(`${column}, date_infraction`);
      if (from) query = query.gte("date_infraction", from);
      if (to) query = query.lte("date_infraction", to);

      const { data, error } = await query;
      if (error)
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };

      const stats = {};
      for (const row of data) {
        const key = row[column] ?? "Inconnu";
        stats[key] = (stats[key] || 0) + 1;
      }

      const out = Object.entries(stats)
        .map(([label, total]) => ({ label, total }))
        .sort((a, b) => b.total - a.total);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ table, column, from, to, stats: out }),
      };
    }

    // ✅ get_pv
    if (path === "/get_pv") {
      const { table, agent, limit } = params;
      if (!table || !agent)
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Paramètres requis : table, agent" }),
        };

      let query = supabase.from(table).select("*").eq("agent_nom", agent);
      if (limit) query = query.limit(parseInt(limit, 10) || 100);
      else query = query.limit(100);

      const { data, error } = await query;
      if (error)
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ table, agent, count: data.length, data }),
      };
    }

    // ❌ Inconnu
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: `Unknown endpoint: ${path}` }),
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(err) }) };
  }
};
