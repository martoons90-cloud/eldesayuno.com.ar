// Cloudflare Pages Functions - Native Edge API for /api/d1/status

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
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export const onRequestOptions = async () => new Response(null, { status: 204, headers: CORS_HEADERS });

export const onRequestGet = async (context: any) => {
  const { env } = context;

  if (env.DB) {
    try {
      const res = await env.DB.prepare('SELECT 1 as ping, datetime("now") as server_time;').first();
      return new Response(
        JSON.stringify({
          configured: true,
          connected: true,
          durationMs: 1,
          message: 'Conexión activa con Cloudflare D1 (Native Edge Binding)',
          serverTime: res?.server_time,
        }),
        { headers: CORS_HEADERS }
      );
    } catch (e: any) {
      console.warn('env.DB ping failed:', e);
    }
  }

  const actId = env.CLOUDFLARE_ACCOUNT_ID || CF_ACCOUNT_ID;
  const dbId = env.CLOUDFLARE_DATABASE_ID || CF_DATABASE_ID;
  const token = env.CLOUDFLARE_API_TOKEN || CF_API_TOKEN;

  if (actId && dbId && token) {
    try {
      const startTime = Date.now();
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${actId}/d1/database/${dbId}/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sql: 'SELECT 1 as ping, datetime("now") as server_time;' }),
        }
      );
      const data: any = await res.json();
      const durationMs = Date.now() - startTime;
      if (data.success) {
        return new Response(
          JSON.stringify({
            configured: true,
            connected: true,
            durationMs,
            message: 'Conexión activa con Cloudflare D1 (Edge REST API)',
          }),
          { headers: CORS_HEADERS }
        );
      }
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          configured: true,
          connected: false,
          error: err.message,
        }),
        { headers: CORS_HEADERS }
      );
    }
  }

  return new Response(
    JSON.stringify({ configured: false, connected: false, message: 'D1 no configurado' }),
    { headers: CORS_HEADERS }
  );
};
