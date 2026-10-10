// Cloudflare Pages Functions - Native Edge API for /api/d1/sync-pull

interface Env {
  DB?: any;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_DATABASE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

const CF_ACCOUNT_ID = 'b36aef318f314d0aaaef32a2155d9841';
const CF_DATABASE_ID = 'f0474948-373a-4522-833b-36eb13858100';
const CF_API_TOKEN = 'cfat_eAr1X7lzTtl0Mbov4nGM0l1F8BCW61SrNWNQqEVA34a6cee2';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export const onRequestOptions = async () => new Response(null, { status: 204, headers: CORS_HEADERS });

export const onRequestPost = async (context: any) => {
  const { request, env } = context;

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const actId = body.accountId || env.CLOUDFLARE_ACCOUNT_ID || CF_ACCOUNT_ID;
    const dbId = body.databaseId || env.CLOUDFLARE_DATABASE_ID || CF_DATABASE_ID;
    const token = body.apiToken || env.CLOUDFLARE_API_TOKEN || CF_API_TOKEN;

    if (env.DB) {
      try {
        const [usersRes, bookingsRes, blocksRes, settingsRes] = await Promise.all([
          env.DB.prepare('SELECT * FROM users;').all(),
          env.DB.prepare('SELECT * FROM bookings;').all(),
          env.DB.prepare('SELECT * FROM date_blocks;').all(),
          env.DB.prepare("SELECT * FROM trust_settings WHERE id = 'default_settings' LIMIT 1;").first(),
        ]);
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              users: usersRes.results || [],
              bookings: bookingsRes.results || [],
              blocks: blocksRes.results || [],
              settings: settingsRes || {},
            },
          }),
          { headers: CORS_HEADERS }
        );
      } catch (e: any) {
        console.warn('env.DB sync-pull error:', e);
      }
    }

    if (actId && dbId && token) {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${actId}/d1/database/${dbId}/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sql: `
              SELECT * FROM users;
              SELECT * FROM bookings;
              SELECT * FROM date_blocks;
              SELECT * FROM trust_settings WHERE id = 'default_settings' LIMIT 1;
            `,
          }),
        }
      );
      const data: any = await res.json();
      const results = data?.result || [];
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            users: results[0]?.results || [],
            bookings: results[1]?.results || [],
            blocks: results[2]?.results || [],
            settings: results[3]?.results?.[0] || {},
          },
        }),
        { headers: CORS_HEADERS }
      );
    }

    return new Response(JSON.stringify({ success: false, error: 'Credenciales requeridas' }), { status: 400, headers: CORS_HEADERS });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: CORS_HEADERS });
  }
};
