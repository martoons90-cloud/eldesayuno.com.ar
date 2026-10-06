import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));

// Helper to query Cloudflare D1 REST API
async function queryCloudflareD1(
  accountId: string,
  databaseId: string,
  apiToken: string,
  sql: string,
  params: unknown[] = []
) {
  const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  const response = await fetch(cfUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql,
      params,
    }),
  });

  const data = await response.json();
  return data;
}

// -------------------------------------------------------------
// CLOUDFLARE D1 API PROXY ENDPOINTS
// -------------------------------------------------------------

// 0. Server-Side D1 Environment Status
app.get('/api/d1/status', async (req, res) => {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const databaseId = process.env.CLOUDFLARE_DATABASE_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !databaseId || !apiToken) {
      return res.json({
        configured: false,
        connected: false,
        message: 'Credenciales de Cloudflare D1 no configuradas en el servidor.',
      });
    }

    const testResult = await queryCloudflareD1(
      accountId,
      databaseId,
      apiToken,
      'SELECT 1 as ping, datetime("now") as server_time;'
    );

    return res.json({
      configured: true,
      connected: Boolean(testResult.success),
      accountId: accountId.slice(0, 6) + '...' + accountId.slice(-4),
      databaseId: databaseId.slice(0, 6) + '...' + databaseId.slice(-4),
      durationMs: testResult.result?.[0]?.meta?.duration || 1,
      message: testResult.success
        ? 'Conexión activa y verificada con Cloudflare D1'
        : 'Error autenticando con Cloudflare D1',
    });
  } catch (err: unknown) {
    return res.status(500).json({
      configured: false,
      connected: false,
      error: err instanceof Error ? err.message : 'Error verificando D1',
    });
  }
});

// 1. Check Server Config & Test Connection
app.post('/api/d1/test', async (req, res) => {
  try {
    const accountId = req.body.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    const databaseId = req.body.databaseId || process.env.CLOUDFLARE_DATABASE_ID;
    const apiToken = req.body.apiToken || process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !databaseId || !apiToken) {
      return res.status(400).json({
        success: false,
        error: 'Faltan credenciales: Account ID, Database ID o API Token de Cloudflare.',
      });
    }

    const testResult = await queryCloudflareD1(
      accountId,
      databaseId,
      apiToken,
      'SELECT 1 as ping, datetime("now") as server_time;'
    );

    if (testResult.success) {
      return res.json({
        success: true,
        message: 'Conexión con Cloudflare D1 establecida correctamente.',
        result: testResult.result,
      });
    } else {
      const errMsg =
        testResult.errors?.map((e: { message: string }) => e.message).join(', ') ||
        'Error de autenticación con Cloudflare D1.';
      return res.status(400).json({ success: false, error: errMsg });
    }
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error interno al conectar con D1',
    });
  }
});

// 2. Generic Query Endpoint
app.post('/api/d1/query', async (req, res) => {
  try {
    const { accountId, databaseId, apiToken, sql, params } = req.body;
    const actId = accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    const dbId = databaseId || process.env.CLOUDFLARE_DATABASE_ID;
    const token = apiToken || process.env.CLOUDFLARE_API_TOKEN;

    if (!actId || !dbId || !token) {
      return res.status(400).json({
        success: false,
        error: 'Credenciales de Cloudflare D1 requeridas.',
      });
    }

    const result = await queryCloudflareD1(actId, dbId, token, sql, params || []);
    return res.json(result);
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error ejecutando query',
    });
  }
});

// 3. Initialize Schema / DDL Migrations
app.post('/api/d1/init-schema', async (req, res) => {
  try {
    const { accountId, databaseId, apiToken, sql } = req.body;
    const actId = accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    const dbId = databaseId || process.env.CLOUDFLARE_DATABASE_ID;
    const token = apiToken || process.env.CLOUDFLARE_API_TOKEN;

    if (!actId || !dbId || !token) {
      return res.status(400).json({ success: false, error: 'Credenciales requeridas.' });
    }

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    const executed = [];
    for (const stmt of statements) {
      const r = await queryCloudflareD1(actId, dbId, token, stmt + ';');
      executed.push(r);
    }

    return res.json({
      success: true,
      message: 'Esquema de tablas D1 inicializado correctamente.',
      statementsCount: statements.length,
      executed,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error inicializando tablas en D1',
    });
  }
});

// 4. Sync Push: Insert or Update All Tables into D1
app.post('/api/d1/sync-push', async (req, res) => {
  try {
    const { accountId, databaseId, apiToken, users, bookings, blocks, settings, notifications } =
      req.body;
    const actId = accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    const dbId = databaseId || process.env.CLOUDFLARE_DATABASE_ID;
    const token = apiToken || process.env.CLOUDFLARE_API_TOKEN;

    if (!actId || !dbId || !token) {
      return res.status(400).json({ success: false, error: 'Credenciales requeridas.' });
    }

    // Push Users
    if (Array.isArray(users)) {
      for (const u of users) {
        await queryCloudflareD1(
          actId,
          dbId,
          token,
          `INSERT INTO users (id, name, email, role, part_name, annual_quota_days, used_days, pending_days, color, avatar_initials, phone, active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             email = excluded.email,
             part_name = excluded.part_name,
             annual_quota_days = excluded.annual_quota_days,
             used_days = excluded.used_days,
             color = excluded.color,
             phone = excluded.phone,
             active = excluded.active;`,
          [
            u.id,
            u.name,
            u.email,
            u.role || 'owner',
            u.partName || '',
            u.annualQuotaDays || 30,
            u.usedDays || 0,
            u.pendingDays || 0,
            u.color || '#264E36',
            u.avatarInitials || 'US',
            u.phone || '',
            u.active ? 1 : 0,
            u.createdAt || new Date().toISOString(),
          ]
        );
      }
    }

    // Push Bookings
    if (Array.isArray(bookings)) {
      for (const b of bookings) {
        await queryCloudflareD1(
          actId,
          dbId,
          token,
          `INSERT INTO bookings (id, user_id, user_name, user_color, part_name, check_in_date, check_out_date, total_days, status, guests_count, arrival_time, notes, cleaning_buffer_applied, cleaning_buffer_end_date, created_at, cancellation_reason, cancelled_at, cancelled_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             status = excluded.status,
             cancellation_reason = excluded.cancellation_reason,
             cancelled_at = excluded.cancelled_at,
             cancelled_by = excluded.cancelled_by;`,
          [
            b.id,
            b.userId,
            b.userName,
            b.userColor,
            b.partName || '',
            b.checkInDate,
            b.checkOutDate,
            b.totalDays,
            b.status,
            b.guestsCount || 4,
            b.arrivalTime || '14:00',
            b.notes || '',
            b.cleaningBufferApplied ? 1 : 0,
            b.cleaningBufferEndDate || '',
            b.createdAt || new Date().toISOString(),
            b.cancellationReason || '',
            b.cancelledAt || '',
            b.cancelledBy || '',
          ]
        );
      }
    }

    // Push Blocks
    if (Array.isArray(blocks)) {
      for (const bl of blocks) {
        await queryCloudflareD1(
          actId,
          dbId,
          token,
          `INSERT INTO date_blocks (id, start_date, end_date, total_days, reason, title, notes, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             notes = excluded.notes;`,
          [
            bl.id,
            bl.startDate,
            bl.endDate,
            bl.totalDays,
            bl.reason,
            bl.title,
            bl.notes || '',
            bl.createdBy || '',
            bl.createdAt || new Date().toISOString(),
          ]
        );
      }
    }

    // Push Settings
    if (settings) {
      await queryCloudflareD1(
        actId,
        dbId,
        token,
        `INSERT INTO trust_settings (id, house_name, location, wifi_ssid, wifi_password, check_in_time, check_out_time, auto_cleaning_buffer_hours, cancellation_min_days, max_guests_limit, emergency_address, logo_url, updated_at)
         VALUES ('default_settings', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           house_name = excluded.house_name,
           location = excluded.location,
           wifi_ssid = excluded.wifi_ssid,
           wifi_password = excluded.wifi_password,
           auto_cleaning_buffer_hours = excluded.auto_cleaning_buffer_hours,
           cancellation_min_days = excluded.cancellation_min_days,
           emergency_address = excluded.emergency_address,
           logo_url = excluded.logo_url,
           updated_at = excluded.updated_at;`,
        [
          settings.houseName || 'Estancia El Desayuno',
          settings.location || '',
          settings.wifiSsid || '',
          settings.wifiPassword || '',
          settings.checkInTime || '14:00',
          settings.checkOutTime || '11:00',
          settings.autoCleaningBufferHours || 24,
          settings.cancellationMinDays || 7,
          settings.maxGuestsLimit || 12,
          settings.emergencyAddress || '',
          settings.logoUrl || '',
          new Date().toISOString(),
        ]
      );
    }

    // Push Inventory
    const { inventory, incidents } = req.body;
    if (Array.isArray(inventory)) {
      for (const inv of inventory) {
        await queryCloudflareD1(
          actId,
          dbId,
          token,
          `INSERT INTO inventory (id, name, category, location_room, quantity, unit, condition, notes, image_url, last_checked_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             category = excluded.category,
             location_room = excluded.location_room,
             quantity = excluded.quantity,
             unit = excluded.unit,
             condition = excluded.condition,
             notes = excluded.notes,
             image_url = excluded.image_url,
             last_checked_date = excluded.last_checked_date;`,
          [
            inv.id,
            inv.name,
            inv.category || 'living_galeria',
            inv.locationRoom || '',
            inv.quantity || 1,
            inv.unit || 'unidades',
            inv.condition || 'excelente',
            inv.notes || '',
            inv.imageUrl || '',
            inv.lastCheckedDate || new Date().toISOString().split('T')[0],
          ]
        );
      }
    }

    // Push Incidents
    if (Array.isArray(incidents)) {
      for (const inc of incidents) {
        await queryCloudflareD1(
          actId,
          dbId,
          token,
          `INSERT INTO incident_reports (id, booking_id, reporter_user_id, reporter_name, reporter_part_name, title, description, location, category, urgency, status, photo_url, created_at, admin_response, resolved_at, resolved_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             description = excluded.description,
             location = excluded.location,
             category = excluded.category,
             urgency = excluded.urgency,
             status = excluded.status,
             photo_url = excluded.photo_url,
             admin_response = excluded.admin_response,
             resolved_at = excluded.resolved_at,
             resolved_by = excluded.resolved_by;`,
          [
            inc.id,
            inc.bookingId || '',
            inc.reporterUserId,
            inc.reporterName,
            inc.reporterPartName || '',
            inc.title,
            inc.description,
            inc.location || '',
            inc.category || 'rotura',
            inc.urgency || 'media',
            inc.status || 'pendiente',
            inc.photoUrl || '',
            inc.createdAt || new Date().toISOString(),
            inc.adminResponse || '',
            inc.resolvedAt || '',
            inc.resolvedBy || '',
          ]
        );
      }
    }

    return res.json({
      success: true,
      message: 'Sincronización con Cloudflare D1 completada.',
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error en push a D1',
    });
  }
});

// 5. Sync Pull: Query All Data from D1
app.post('/api/d1/sync-pull', async (req, res) => {
  try {
    const { accountId, databaseId, apiToken } = req.body;
    const actId = accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    const dbId = databaseId || process.env.CLOUDFLARE_DATABASE_ID;
    const token = apiToken || process.env.CLOUDFLARE_API_TOKEN;

    if (!actId || !dbId || !token) {
      return res.status(400).json({ success: false, error: 'Credenciales requeridas.' });
    }

    const usersRes = await queryCloudflareD1(actId, dbId, token, 'SELECT * FROM users ORDER BY name ASC;');
    const bookingsRes = await queryCloudflareD1(actId, dbId, token, 'SELECT * FROM bookings ORDER BY check_in_date DESC;');
    const blocksRes = await queryCloudflareD1(actId, dbId, token, 'SELECT * FROM date_blocks ORDER BY start_date DESC;');
    const settingsRes = await queryCloudflareD1(actId, dbId, token, 'SELECT * FROM trust_settings LIMIT 1;');
    const notifsRes = await queryCloudflareD1(actId, dbId, token, 'SELECT * FROM audit_notifications ORDER BY timestamp DESC LIMIT 30;');
    const inventoryRes = await queryCloudflareD1(actId, dbId, token, 'SELECT * FROM inventory ORDER BY name ASC;');
    const incidentsRes = await queryCloudflareD1(actId, dbId, token, 'SELECT * FROM incident_reports ORDER BY created_at DESC;');

    // Map snake_case to camelCase
    const users = (usersRes.result?.[0]?.results || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      partName: row.part_name,
      annualQuotaDays: row.annual_quota_days,
      usedDays: row.used_days,
      pendingDays: row.pending_days,
      color: row.color,
      avatarInitials: row.avatar_initials,
      phone: row.phone,
      active: Boolean(row.active),
      createdAt: row.created_at,
    }));

    const bookings = (bookingsRes.result?.[0]?.results || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userColor: row.user_color,
      partName: row.part_name,
      checkInDate: row.check_in_date,
      checkOutDate: row.check_out_date,
      totalDays: row.total_days,
      status: row.status,
      guestsCount: row.guests_count,
      arrivalTime: row.arrival_time,
      notes: row.notes,
      cleaningBufferApplied: Boolean(row.cleaning_buffer_applied),
      cleaningBufferEndDate: row.cleaning_buffer_end_date,
      createdAt: row.created_at,
      cancellationReason: row.cancellation_reason,
      cancelledAt: row.cancelled_at,
      cancelledBy: row.cancelled_by,
    }));

    const blocks = (blocksRes.result?.[0]?.results || []).map((row: any) => ({
      id: row.id,
      startDate: row.start_date,
      endDate: row.end_date,
      totalDays: row.total_days,
      reason: row.reason,
      title: row.title,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));

    const rawSettings = settingsRes.result?.[0]?.results?.[0] as any;
    const settings = rawSettings
      ? {
          houseName: rawSettings.house_name,
          location: rawSettings.location,
          wifiSsid: rawSettings.wifi_ssid,
          wifiPassword: rawSettings.wifi_password,
          checkInTime: rawSettings.check_in_time,
          checkOutTime: rawSettings.check_out_time,
          autoCleaningBufferHours: rawSettings.auto_cleaning_buffer_hours,
          cancellationMinDays: rawSettings.cancellation_min_days,
          maxGuestsLimit: rawSettings.max_guests_limit,
          emergencyAddress: rawSettings.emergency_address,
          logoUrl: rawSettings.logo_url,
        }
      : undefined;

    const notifications = (notifsRes.result?.[0]?.results || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      timestamp: row.timestamp,
      read: Boolean(row.read),
      type: row.type,
      targetUserId: row.target_user_id,
      bookingId: row.booking_id,
    }));

    const inventory = (inventoryRes.result?.[0]?.results || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      locationRoom: row.location_room,
      quantity: row.quantity,
      unit: row.unit,
      condition: row.condition,
      notes: row.notes,
      imageUrl: row.image_url,
      lastCheckedDate: row.last_checked_date,
    }));

    const incidents = (incidentsRes.result?.[0]?.results || []).map((row: any) => ({
      id: row.id,
      bookingId: row.booking_id,
      reporterUserId: row.reporter_user_id,
      reporterName: row.reporter_name,
      reporterPartName: row.reporter_part_name,
      title: row.title,
      description: row.description,
      location: row.location,
      category: row.category,
      urgency: row.urgency,
      status: row.status,
      photoUrl: row.photo_url,
      createdAt: row.created_at,
      adminResponse: row.admin_response,
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
    }));

    return res.json({
      success: true,
      data: {
        users,
        bookings,
        blocks,
        settings,
        notifications,
        inventory,
        incidents,
      },
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error en pull desde D1',
    });
  }
});

// -------------------------------------------------------------
// VITE DEV / PRODUCTION MIDDLEWARE
// -------------------------------------------------------------
async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[El Desayuno ERP] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

bootstrap();
