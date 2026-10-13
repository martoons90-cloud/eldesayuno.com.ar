// Cloudflare Pages Functions - Native Edge API for /api/d1/sync-push

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

    const { settings } = body;

    // Persist settings if present
    if (settings && typeof settings === 'object') {
      const sql = `INSERT OR REPLACE INTO trust_settings (
        id, house_name, location, wifi_ssid, wifi_password, check_in_time, check_out_time,
        auto_cleaning_buffer_hours, cancellation_min_days, max_guests_limit, emergency_address,
        logo_url, cbu, alias_bancario, cuit_fideicomiso, banco_nombre, titular_cuenta,
        wifi_coverage_notes, slogan, updated_at
      ) VALUES ('default_settings', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

      const params = [
        settings.houseName || 'Estancia El Desayuno',
        settings.location || '',
        settings.wifiSsid || '',
        settings.wifiPassword || '',
        settings.checkInTime || '14:00',
        settings.checkOutTime || '11:00',
        Number(settings.autoCleaningBufferHours || 24),
        Number(settings.cancellationMinDays || 7),
        Number(settings.maxGuestsLimit || 12),
        settings.emergencyAddress || '',
        settings.logoUrl || '',
        settings.cbu || '',
        settings.aliasBancario || '',
        settings.cuitFideicomiso || '',
        settings.bancoNombre || '',
        settings.titularCuenta || '',
        settings.wifiCoverageNotes || '',
        settings.slogan || 'Cuatro Partes, Un Mismo Objetivo',
        settings.updatedAt || new Date().toISOString(),
      ];

      if (env.DB) {
        try {
          await env.DB.prepare(sql).bind(...params).run();
        } catch (e) {
          console.warn('env.DB sync-push settings error:', e);
        }
      } else {
        const actId = body.accountId || env.CLOUDFLARE_ACCOUNT_ID || CF_ACCOUNT_ID;
        const dbId = body.databaseId || env.CLOUDFLARE_DATABASE_ID || CF_DATABASE_ID;
        const token = body.apiToken || env.CLOUDFLARE_API_TOKEN || CF_API_TOKEN;
        if (actId && dbId && token) {
          try {
            await fetch(
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
          } catch (e) {
            console.warn('REST D1 sync-push settings error:', e);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Datos sincronizados con Cloudflare D1.' }), {
      headers: CORS_HEADERS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: CORS_HEADERS });
  }
};
