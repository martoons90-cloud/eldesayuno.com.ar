// Cloudflare Pages Functions - Native Edge API for /api/d1/query

interface Env {
  DB?: any;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_DATABASE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

const CF_ACCOUNT_ID = 'b36aef318f314d0aaaef32a2155d9841';
const CF_DATABASE_ID = 'f0474948-373a-4522-833b-36eb13858100';
const CF_API_TOKEN = '';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export const onRequestOptions = async () => new Response(null, { status: 204, headers: CORS_HEADERS });

export const onRequestPost = async (context: any) => {
  const { request, env } = context;

  try {
    const { accountId, databaseId, apiToken, sql, params = [] } = await request.json();

    if (!sql || typeof sql !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'SQL no válido' }), { status: 400, headers: CORS_HEADERS });
    }

    // 1. If env.DB is bound
    if (env.DB) {
      try {
        const stmt = env.DB.prepare(sql).bind(...params);
        const result = await stmt.all();
        return new Response(
          JSON.stringify({
            success: true,
            result: [{ results: result.results || [], success: true }],
          }),
          { headers: CORS_HEADERS }
        );
      } catch (dbErr: any) {
        console.warn('env.DB query error:', dbErr);
      }
    }

    // 2. Fallback to Cloudflare D1 REST API
    const actId = accountId || env.CLOUDFLARE_ACCOUNT_ID || CF_ACCOUNT_ID;
    const dbId = databaseId || env.CLOUDFLARE_DATABASE_ID || CF_DATABASE_ID;
    const token = apiToken || env.CLOUDFLARE_API_TOKEN || CF_API_TOKEN;

    if (actId && dbId && token) {
      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${actId}/d1/database/${dbId}/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sql, params }),
        }
      );
      const data = await cfRes.json();
      return new Response(JSON.stringify(data), { headers: CORS_HEADERS });
    }

    return new Response(JSON.stringify({ success: false, error: 'Credenciales de Cloudflare D1 no disponibles' }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: CORS_HEADERS });
  }
};
