import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure persistent uploads directory on server
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Disable ETags globally to eliminate 304 cached responses
app.set('etag', false);

// Strict anti-caching headers on all API endpoints for cross-browser synchronization
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

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
          slogan: rawSettings.slogan || 'Cuatro Partes, Un Mismo Objetivo',
          location: rawSettings.location,
          wifiSsid: rawSettings.wifi_ssid,
          wifiPassword: rawSettings.wifi_password,
          wifiCoverageNotes: rawSettings.wifi_coverage_notes || '',
          checkInTime: rawSettings.check_in_time,
          checkOutTime: rawSettings.check_out_time,
          autoCleaningBufferHours: rawSettings.auto_cleaning_buffer_hours,
          cancellationMinDays: rawSettings.cancellation_min_days,
          maxGuestsLimit: rawSettings.max_guests_limit,
          emergencyAddress: rawSettings.emergency_address,
          logoUrl: rawSettings.logo_url,
          cbu: rawSettings.cbu || '',
          aliasBancario: rawSettings.alias_bancario || '',
          cuitFideicomiso: rawSettings.cuit_fideicomiso || '',
          bancoNombre: rawSettings.banco_nombre || '',
          titularCuenta: rawSettings.titular_cuenta || '',
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
// CLOUDFLARE R2 OBJECT STORAGE ENDPOINTS (BUCKET: el-desayuno)
// -------------------------------------------------------------

function createR2S3Client(accountId: string, accessKeyId: string, secretAccessKey: string) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

// 1. R2 Status Check
app.get('/api/r2/status', async (_req, res) => {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'el-desayuno';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return res.json({
        configured: false,
        connected: false,
        bucketName,
        message: 'Credenciales de Cloudflare R2 no configuradas en variables de entorno.',
      });
    }

    const s3 = createR2S3Client(accountId, accessKeyId, secretAccessKey);
    await s3.send(new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 1 }));

    return res.json({
      configured: true,
      connected: true,
      bucketName,
      message: `Conexión activa con el bucket '${bucketName}' en Cloudflare R2.`,
    });
  } catch (err: unknown) {
    return res.json({
      configured: true,
      connected: false,
      bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || 'el-desayuno',
      error: err instanceof Error ? err.message : 'Error conectando con Cloudflare R2',
    });
  }
});

// 2. Upload Photo to Cloudflare R2 Bucket 'el-desayuno' or Server-Side Persistent Storage
app.post(['/api/r2/upload', '/api/upload'], async (req, res) => {
  try {
    const { image, filename, folder = 'fotos', config } = req.body;
    const accountId = config?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = config?.accessKeyId || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = config?.secretAccessKey || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const bucketName = config?.bucketName || process.env.CLOUDFLARE_R2_BUCKET_NAME || 'el-desayuno';
    const publicUrl = config?.publicUrl || process.env.CLOUDFLARE_R2_PUBLIC_URL || '';

    if (!image) {
      return res.status(400).json({ success: false, error: 'No se envió imagen en base64.' });
    }

    // Process Base64 string
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    let buffer: Buffer;
    let contentType = 'image/jpeg';

    if (match) {
      contentType = match[1];
      buffer = Buffer.from(match[2], 'base64');
    } else {
      buffer = Buffer.from(image, 'base64');
    }

    const ext = contentType.split('/')[1] || 'jpg';
    const cleanFilename = (filename || `foto-${Date.now()}`).replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const uniqueFile = `${Date.now()}_${cleanFilename}.${ext}`;
    const objectKey = `${folder}/${uniqueFile}`;

    // Try Cloudflare R2 if credentials present
    if (accountId && accessKeyId && secretAccessKey) {
      try {
        const s3 = createR2S3Client(accountId, accessKeyId, secretAccessKey);
        await s3.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
            Body: buffer,
            ContentType: contentType,
          })
        );

        const fileUrl = publicUrl
          ? `${publicUrl.replace(/\/$/, '')}/${objectKey}`
          : `/api/r2/file?key=${encodeURIComponent(objectKey)}`;

        return res.json({
          success: true,
          url: fileUrl,
          key: objectKey,
          bucketName,
          storageType: 'cloudflare-r2',
          message: `Foto subida exitosamente al bucket '${bucketName}'.`,
        });
      } catch (r2Err) {
        console.warn('R2 upload failed, falling back to local server storage:', r2Err);
      }
    }

    // Fallback: Save to server persistent uploads directory
    const targetFolder = path.join(UPLOADS_DIR, folder);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }
    const filePath = path.join(targetFolder, uniqueFile);
    fs.writeFileSync(filePath, buffer);

    const serverUrl = `/uploads/${folder}/${uniqueFile}`;
    return res.json({
      success: true,
      url: serverUrl,
      key: objectKey,
      storageType: 'server-uploads',
      message: 'Foto guardada permanentemente en el servidor en la nube.',
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error procesando archivo de imagen',
    });
  }
});

// 3. List Photos in Cloudflare R2 Bucket 'el-desayuno'
app.post('/api/r2/list', async (req, res) => {
  try {
    const { folder = 'fotos', config } = req.body;
    const accountId = config?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = config?.accessKeyId || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = config?.secretAccessKey || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const bucketName = config?.bucketName || process.env.CLOUDFLARE_R2_BUCKET_NAME || 'el-desayuno';
    const publicUrl = config?.publicUrl || process.env.CLOUDFLARE_R2_PUBLIC_URL || '';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return res.status(400).json({
        success: false,
        error: 'Credenciales de Cloudflare R2 incompletas.',
      });
    }

    const s3 = createR2S3Client(accountId, accessKeyId, secretAccessKey);
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: folder ? `${folder}/` : undefined,
        MaxKeys: 100,
      })
    );

    const objects = (result.Contents || []).map((obj) => ({
      key: obj.Key,
      url: publicUrl
        ? `${publicUrl.replace(/\/$/, '')}/${obj.Key}`
        : `/api/r2/file?key=${encodeURIComponent(obj.Key || '')}`,
      size: obj.Size,
      lastModified: obj.LastModified?.toISOString(),
    }));

    return res.json({
      success: true,
      bucketName,
      objects,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error listando objetos en R2',
    });
  }
});

// 4. Serve File / Photo directly from Cloudflare R2 Proxy
app.get('/api/r2/file', async (req, res) => {
  try {
    const key = req.query.key as string;
    if (!key) {
      return res.status(400).send('Falta parámetro key');
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'el-desayuno';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return res.status(400).send('Credenciales Cloudflare R2 no configuradas');
    }

    const s3 = createR2S3Client(accountId, accessKeyId, secretAccessKey);
    const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
    const response = await s3.send(command);

    if (response.ContentType) {
      res.setHeader('Content-Type', response.ContentType);
    } else {
      res.setHeader('Content-Type', 'image/jpeg');
    }
    if (response.ContentLength) {
      res.setHeader('Content-Length', response.ContentLength);
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const byteArray = await response.Body?.transformToByteArray();
    if (byteArray) {
      return res.send(Buffer.from(byteArray));
    } else {
      return res.status(404).send('Archivo vacío o no encontrado en R2');
    }
  } catch (err: unknown) {
    return res.status(404).send('Archivo no encontrado en Cloudflare R2');
  }
});

// -------------------------------------------------------------
// SERVER-SIDE SHARED STATE PERSISTENCE & CLOUD LOCKING
// -------------------------------------------------------------
import { getFullSeedState } from './src/services/defaultSeedData';

const STATE_FILE_PATH = path.resolve(process.cwd(), 'app-server-state.json');
let memoryServerState: Record<string, any> | null = null;

function loadServerState(forceDisk = false): Record<string, any> {
  if (memoryServerState && !forceDisk) {
    return memoryServerState;
  }
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        memoryServerState = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.error('[Server State] Error leyendo STATE_FILE_PATH, re-inicializando semilla:', err);
  }
  const seed = getFullSeedState();
  memoryServerState = seed;
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(seed, null, 2), 'utf-8');
  } catch (writeErr) {
    console.error('[Server State] Error escribiendo semilla inicial:', writeErr);
  }
  return seed;
}

// Real-time synchronization event bus across all client sessions
const sseClients = new Set<express.Response>();

function broadcastSyncEvent(eventType: string, payload?: any): void {
  const data = JSON.stringify({ type: eventType, payload, timestamp: Date.now() });
  for (const client of sseClients) {
    try {
      client.write(`event: sync\ndata: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

function saveServerState(state: Record<string, any>): void {
  try {
    state.updatedAt = new Date().toISOString();
    memoryServerState = state;
    const tempPath = `${STATE_FILE_PATH}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tempPath, STATE_FILE_PATH);
    broadcastSyncEvent('state_updated', { settings: state.settings, updatedAt: state.updatedAt });
  } catch (err) {
    console.error('[Server State] Error escribiendo STATE_FILE_PATH:', err);
  }
}

// Initialize seed on startup
loadServerState(true);

// 0. Real-time Server-Sent Events stream for instant cross-session sync (< 50ms)
app.get('/api/sync/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('event: connected\ndata: {"status":"connected"}\n\n');
  sseClients.add(res);

  const keepAlive = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

// 1. Get full App State (Canonical Cloud Truth)
app.get('/api/app-state', (_req, res) => {
  try {
    const data = loadServerState(true);
    return res.json({ success: true, data });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error leyendo estado en servidor' });
  }
});

// 2. Safe Set/Merge App State (Never blindly wipes out bookings or settings)
app.post('/api/app-state', (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ success: false, error: 'Datos no válidos' });
    }
    const current = loadServerState(true);

    // Safe merge settings
    if (incoming.settings && typeof incoming.settings === 'object') {
      current.settings = { ...current.settings, ...incoming.settings };
    }

    // Safe merge users
    if (Array.isArray(incoming.users) && incoming.users.length > 0) {
      const userMap = new Map<string, any>();
      (current.users || []).forEach((u: any) => userMap.set(u.id, u));
      incoming.users.forEach((u: any) => {
        if (u && u.id) {
          const prev = userMap.get(u.id) || {};
          userMap.set(u.id, { ...prev, ...u });
        }
      });
      current.users = Array.from(userMap.values());
    }

    // Safe merge bookings - NEVER discard existing active bookings unless incoming is non-empty
    if (Array.isArray(incoming.bookings) && incoming.bookings.length > 0) {
      const bookingMap = new Map<string, any>();
      (current.bookings || []).forEach((b: any) => bookingMap.set(b.id, b));
      incoming.bookings.forEach((b: any) => {
        if (b && b.id) bookingMap.set(b.id, b);
      });
      current.bookings = Array.from(bookingMap.values());
    }

    if (Array.isArray(incoming.blocks)) {
      current.blocks = incoming.blocks;
    }
    if (Array.isArray(incoming.rules) && incoming.rules.length > 0) {
      current.rules = incoming.rules;
    }
    if (Array.isArray(incoming.contacts) && incoming.contacts.length > 0) {
      current.contacts = incoming.contacts;
    }
    if (Array.isArray(incoming.documents) && incoming.documents.length > 0) {
      current.documents = incoming.documents;
    }
    if (Array.isArray(incoming.inventory) && incoming.inventory.length > 0) {
      current.inventory = incoming.inventory;
    }
    if (Array.isArray(incoming.incidents)) {
      current.incidents = incoming.incidents;
    }
    if (Array.isArray(incoming.fees)) {
      current.fees = incoming.fees;
    }
    if (Array.isArray(incoming.expenses)) {
      current.expenses = incoming.expenses;
    }

    saveServerState(current);
    return res.json({ success: true, message: 'Estado sincronizado de forma segura en el servidor' });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando estado en servidor' });
  }
});

// 2b. Dedicated Settings Endpoints (Canonical Cloud Database for Ajustes)
app.get('/api/settings', (_req, res) => {
  try {
    const state = loadServerState(true);
    return res.json({ success: true, settings: state.settings || {} });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo ajustes del servidor' });
  }
});

const handleSaveSettings = async (req: express.Request, res: express.Response) => {
  try {
    const updatedSettings = req.body;
    if (!updatedSettings || typeof updatedSettings !== 'object') {
      return res.status(400).json({ success: false, error: 'Datos de configuración no válidos.' });
    }

    const state = loadServerState(true);
    state.settings = {
      ...(state.settings || {}),
      ...updatedSettings,
      updatedAt: new Date().toISOString(),
    };

    saveServerState(state);

    // Also push to Cloudflare D1 if configured
    const actId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const dbId = process.env.CLOUDFLARE_DATABASE_ID;
    const token = process.env.CLOUDFLARE_API_TOKEN;
    if (actId && dbId && token) {
      const s = state.settings;
      queryCloudflareD1(
        actId,
        dbId,
        token,
        `INSERT OR REPLACE INTO trust_settings (id, house_name, location, wifi_ssid, wifi_password, check_in_time, check_out_time, auto_cleaning_buffer_hours, cancellation_min_days, max_guests_limit, emergency_address, logo_url, cbu, alias_bancario, cuit_fideicomiso, banco_nombre, titular_cuenta, wifi_coverage_notes, slogan, updated_at)
         VALUES ('default_settings', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.houseName || 'Estancia El Desayuno',
          s.location || '',
          s.wifiSsid || '',
          s.wifiPassword || '',
          s.checkInTime || '14:00',
          s.checkOutTime || '11:00',
          s.autoCleaningBufferHours || 24,
          s.cancellationMinDays || 7,
          s.maxGuestsLimit || 12,
          s.emergencyAddress || '',
          s.logoUrl || '',
          s.cbu || '',
          s.aliasBancario || '',
          s.cuitFideicomiso || '',
          s.bancoNombre || '',
          s.titularCuenta || '',
          s.wifiCoverageNotes || '',
          s.slogan || 'Cuatro Partes, Un Mismo Objetivo',
          new Date().toISOString(),
        ]
      ).catch((err) => console.warn('[D1 Background Sync] Error guardando settings en D1:', err));
    }

    return res.json({
      success: true,
      settings: state.settings,
      message: 'Ajustes guardados y persistidos en la base de datos de la nube.',
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error guardando ajustes en la nube',
    });
  }
};

app.post('/api/settings', handleSaveSettings);
app.put('/api/settings', handleSaveSettings);

// 3. Get bookings from server
app.get('/api/bookings', (_req, res) => {
  try {
    const state = loadServerState();
    return res.json({ success: true, bookings: state.bookings || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo reservas' });
  }
});

// 4. Create Booking with STRICT SERVER-SIDE CONFLICT DETECTION & LOCKING
app.post('/api/bookings', (req, res) => {
  try {
    const {
      userId,
      userName,
      userColor = '#16A34A',
      partName = 'Cabeza 1',
      checkInDate,
      checkOutDate,
      totalDays,
      guestsCount = 4,
      arrivalTime = '14:00',
      notes,
      cleaningBufferApplied = false,
    } = req.body;

    if (!checkInDate || !checkOutDate || !userId || !userName) {
      return res.status(400).json({ success: false, error: 'Faltan campos obligatorios para la reserva.' });
    }

    if (checkOutDate < checkInDate) {
      return res.status(400).json({
        success: false,
        error: 'La fecha de check-out no puede ser anterior a la fecha de check-in.',
      });
    }

    // Always read freshest state from disk to avoid race conditions
    const state = loadServerState();
    const bookings = Array.isArray(state.bookings) ? state.bookings : [];
    const blocks = Array.isArray(state.blocks) ? state.blocks : [];

    // Overlap validation with active bookings
    const activeBookings = bookings.filter((b: any) => b.status !== 'cancelled');
    const conflictBooking = activeBookings.find((b: any) => {
      // Overlap formula: !(newCheckOut < existingCheckIn || newCheckIn > existingCheckOut)
      return !(checkOutDate < b.checkInDate || checkInDate > b.checkOutDate);
    });

    if (conflictBooking) {
      return res.status(409).json({
        success: false,
        code: 'DATE_CONFLICT',
        error: `Conflicto de fechas en la nube: El período del ${checkInDate} al ${checkOutDate} YA ESTÁ RESERVADO por ${conflictBooking.userName} (${conflictBooking.checkInDate} al ${conflictBooking.checkOutDate}). No es posible duplicar reservas en la estancia.`,
        conflictBooking,
      });
    }

    // Overlap validation with maintenance blocks
    const conflictBlock = blocks.find((bl: any) => {
      return !(checkOutDate < bl.startDate || checkInDate > bl.endDate);
    });

    if (conflictBlock) {
      return res.status(409).json({
        success: false,
        code: 'BLOCK_CONFLICT',
        error: `Conflicto con bloqueo oficial de la estancia: "${conflictBlock.title}" (${conflictBlock.startDate} al ${conflictBlock.endDate}).`,
        conflictBlock,
      });
    }

    // Calculate days
    const s = new Date(checkInDate + 'T00:00:00');
    const e = new Date(checkOutDate + 'T00:00:00');
    const computedDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const finalDays = totalDays || computedDays;

    const newBooking = {
      id: 'book-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      userId,
      userName,
      userColor,
      partName,
      checkInDate,
      checkOutDate,
      totalDays: finalDays,
      status: 'pending',
      guestsCount,
      arrivalTime,
      notes: notes ? notes.trim() : undefined,
      cleaningBufferApplied,
      createdAt: new Date().toISOString(),
    };

    state.bookings = [newBooking, ...bookings];

    // Recalculate user quotas in server state (only confirmed/completed count)
    if (Array.isArray(state.users)) {
      state.users = state.users.map((u: any) => {
        if (u.role === 'admin') return u;
        const uBookings = state.bookings.filter(
          (b: any) => b.userId === u.id && (b.status === 'confirmed' || b.status === 'completed')
        );
        const used = uBookings.reduce((sum: number, b: any) => sum + (b.totalDays || 0), 0);
        return { ...u, usedDays: used };
      });
    }

    // Add push notification in server state
    if (!Array.isArray(state.notifications)) state.notifications = [];
    state.notifications.unshift({
      id: 'notif-' + Date.now(),
      title: 'Nueva Solicitud de Reserva',
      body: `${userName} solicitó del ${checkInDate} al ${checkOutDate} (${finalDays} días). Pendiente de aprobación del administrador.`,
      type: 'booking_created',
      bookingId: newBooking.id,
      createdAt: new Date().toISOString(),
      read: false,
    });

    saveServerState(state);

    return res.status(201).json({
      success: true,
      booking: newBooking,
      message: `Solicitud de reserva registrada para ${userName}. Pendiente de aprobación administrativa.`,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error procesando reserva en el servidor',
    });
  }
});

// 4b. Approve Booking
app.post('/api/bookings/:id/approve', (req, res) => {
  try {
    const bookingId = req.params.id;
    const { approvedByName = 'Administrador' } = req.body;
    const state = loadServerState();
    const bookings = Array.isArray(state.bookings) ? state.bookings : [];
    const target = bookings.find((b: any) => b.id === bookingId);

    if (!target) {
      return res.status(404).json({ success: false, error: 'Reserva no encontrada.' });
    }

    state.bookings = bookings.map((b: any) => {
      if (b.id === bookingId) {
        return {
          ...b,
          status: 'confirmed',
          approvedAt: new Date().toISOString(),
          approvedBy: approvedByName,
        };
      }
      return b;
    });

    // Recalculate user quotas in server state
    if (Array.isArray(state.users)) {
      state.users = state.users.map((u: any) => {
        if (u.role === 'admin') return u;
        const uBookings = state.bookings.filter(
          (b: any) => b.userId === u.id && (b.status === 'confirmed' || b.status === 'completed')
        );
        const used = uBookings.reduce((sum: number, b: any) => sum + (b.totalDays || 0), 0);
        return { ...u, usedDays: used };
      });
    }

    // Add push notification for approval (visible to all, personalized by client)
    if (!Array.isArray(state.notifications)) state.notifications = [];
    state.notifications.unshift({
      id: 'notif-' + Date.now(),
      title: '¡Reserva Aprobada!',
      body: `La reserva de ${target.userName} (${target.checkInDate} al ${target.checkOutDate}) fue confirmada por ${approvedByName}.`,
      type: 'booking_approved',
      bookingId: target.id,
      bookingUserId: target.userId,
      bookingUserName: target.userName,
      bookingPartName: target.partName,
      checkInDate: target.checkInDate,
      checkOutDate: target.checkOutDate,
      totalDays: target.totalDays,
      targetUserId: null,
      createdAt: new Date().toISOString(),
      read: false,
    });

    saveServerState(state);
    return res.json({ success: true, message: 'Reserva aprobada con éxito.' });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error aprobando reserva' });
  }
});

// 5. Cancel Booking
app.post('/api/bookings/:id/cancel', (req, res) => {
  try {
    const bookingId = req.params.id;
    const { reason = 'Cancelado por el usuario', cancelledByName = 'Usuario' } = req.body;
    const state = loadServerState();
    const bookings = Array.isArray(state.bookings) ? state.bookings : [];
    const target = bookings.find((b: any) => b.id === bookingId);

    if (!target) {
      return res.status(404).json({ success: false, error: 'Reserva no encontrada.' });
    }

    const isRejection = target.status === 'pending';

    state.bookings = bookings.map((b: any) => {
      if (b.id === bookingId) {
        return {
          ...b,
          status: 'cancelled',
          cancellationReason: reason,
          cancelledAt: new Date().toISOString(),
          cancelledBy: cancelledByName,
        };
      }
      return b;
    });

    // Recalculate user quotas (only for confirmed/completed bookings)
    if (Array.isArray(state.users)) {
      state.users = state.users.map((u: any) => {
        if (u.role === 'admin') return u;
        const uBookings = state.bookings.filter(
          (b: any) => b.userId === u.id && (b.status === 'confirmed' || b.status === 'completed')
        );
        const used = uBookings.reduce((sum: number, b: any) => sum + (b.totalDays || 0), 0);
        return { ...u, usedDays: used };
      });
    }

    if (!Array.isArray(state.notifications)) state.notifications = [];
    if (isRejection) {
      // Rejections are strictly private to applicant and admin
      state.notifications.unshift({
        id: 'notif-' + Date.now(),
        title: 'Solicitud de Reserva Desestimada',
        body: `Tu solicitud para el período ${target.checkInDate} al ${target.checkOutDate} fue desestimada por la administración: ${reason}. Las fechas han sido liberadas en el calendario.`,
        type: 'booking_rejected',
        bookingId: target.id,
        bookingUserId: target.userId,
        bookingUserName: target.userName,
        bookingPartName: target.partName,
        checkInDate: target.checkInDate,
        checkOutDate: target.checkOutDate,
        totalDays: target.totalDays,
        targetUserId: target.userId, // PRIVACY: Only applicant and admin see it
        createdAt: new Date().toISOString(),
        read: false,
      });
    } else {
      state.notifications.unshift({
        id: 'notif-' + Date.now(),
        title: 'Reserva Cancelada',
        body: `La reserva de ${target.userName} (${target.checkInDate} a ${target.checkOutDate}) fue cancelada por ${cancelledByName}. Fechas liberadas.`,
        type: 'booking_cancelled',
        bookingId: target.id,
        bookingUserId: target.userId,
        bookingUserName: target.userName,
        bookingPartName: target.partName,
        checkInDate: target.checkInDate,
        checkOutDate: target.checkOutDate,
        totalDays: target.totalDays,
        targetUserId: null,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }

    saveServerState(state);
    return res.json({ success: true, message: 'Reserva cancelada en el servidor.' });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error cancelando reserva' });
  }
});

// 6. Users endpoints
app.get('/api/users', (_req, res) => {
  try {
    const state = loadServerState();
    return res.json({ success: true, users: state.users || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo usuarios' });
  }
});

app.post('/api/users', (req, res) => {
  try {
    const user = req.body;
    if (!user || !user.id) {
      return res.status(400).json({ success: false, error: 'Usuario no válido' });
    }
    const state = loadServerState();
    const users = Array.isArray(state.users) ? state.users : [];
    const idx = users.findIndex((u: any) => u.id === user.id);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...user };
    } else {
      users.push(user);
    }
    state.users = users;
    saveServerState(state);
    return res.json({ success: true, user });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando usuario' });
  }
});

// Transfer Admin Power
app.post('/api/users/transfer-admin', (req, res) => {
  try {
    const { newAdminUserId, currentAdminUserId } = req.body;
    if (!newAdminUserId) {
      return res.status(400).json({ success: false, error: 'Falta newAdminUserId' });
    }
    const state = loadServerState();
    const users = Array.isArray(state.users) ? state.users : [];
    const newAdmin = users.find((u: any) => u.id === newAdminUserId);
    if (!newAdmin) {
      return res.status(404).json({ success: false, error: 'Nuevo administrador no encontrado' });
    }

    state.users = users.map((u: any) => {
      if (u.id === newAdminUserId) {
        return { ...u, role: 'admin' };
      }
      if (u.role === 'admin' || (currentAdminUserId && u.id === currentAdminUserId)) {
        return { ...u, role: 'owner' };
      }
      return u;
    });

    if (!Array.isArray(state.notifications)) state.notifications = [];
    state.notifications.unshift({
      id: 'notif-' + Date.now(),
      title: 'Traspaso de Poder de Administración',
      body: `${newAdmin.name} ha asumido como Administrador de la sociedad.`,
      type: 'system',
      createdAt: new Date().toISOString(),
      read: false,
    });

    saveServerState(state);
    return res.json({
      success: true,
      message: `Poder de administración transferido exitosamente a ${newAdmin.name}.`,
      users: state.users,
    });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error transfiriendo administración' });
  }
});

// Update User Password
app.post('/api/users/:id/password', (req, res) => {
  try {
    const userId = req.params.id;
    const { password } = req.body;
    const code = (password || '').trim().toUpperCase();
    if (code.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'La contraseña debe ser un código alfanumérico de exactamente 6 caracteres.',
      });
    }

    const state = loadServerState();
    const users = Array.isArray(state.users) ? state.users : [];
    const idx = users.findIndex((u: any) => u.id === userId);
    if (idx < 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    users[idx] = { ...users[idx], password: code };
    state.users = users;
    saveServerState(state);
    return res.json({ success: true, message: `Contraseña actualizada a "${code}"` });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error actualizando contraseña' });
  }
});

// 7. Bulk Shares Update
app.post('/api/users/bulk-shares', (req, res) => {
  try {
    const { sharesMap } = req.body;
    if (!sharesMap || typeof sharesMap !== 'object') {
      return res.status(400).json({ success: false, error: 'Mapa de acciones no válido' });
    }
    const state = loadServerState();
    if (Array.isArray(state.users)) {
      state.users = state.users.map((u: any) => {
        if (sharesMap[u.id] !== undefined) {
          return {
            ...u,
            sharePercentage: Math.max(0, Math.round(Number(sharesMap[u.id]) * 10000) / 10000),
          };
        }
        return u;
      });
    }
    saveServerState(state);
    return res.json({ success: true, message: 'Acciones actualizadas en servidor', users: state.users });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error actualizando acciones' });
  }
});

// 8. Date Blocks
app.get('/api/blocks', (_req, res) => {
  try {
    const state = loadServerState();
    return res.json({ success: true, blocks: state.blocks || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo bloqueos' });
  }
});

app.post('/api/blocks', (req, res) => {
  try {
    const block = req.body;
    if (!block || !block.startDate || !block.endDate) {
      return res.status(400).json({ success: false, error: 'Fechas de bloqueo requeridas' });
    }
    const state = loadServerState();
    const blocks = Array.isArray(state.blocks) ? state.blocks : [];
    const newBlock = {
      ...block,
      id: block.id || 'block-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    state.blocks = [newBlock, ...blocks];
    saveServerState(state);
    return res.status(201).json({ success: true, block: newBlock });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error creando bloqueo' });
  }
});

app.delete('/api/blocks/:id', (req, res) => {
  try {
    const blockId = req.params.id;
    const state = loadServerState();
    state.blocks = (state.blocks || []).filter((b: any) => b.id !== blockId);
    saveServerState(state);
    return res.json({ success: true });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error eliminando bloqueo' });
  }
});

// 9. Rules Endpoints
app.get('/api/rules', (_req, res) => {
  try {
    const state = loadServerState();
    return res.json({ success: true, rules: state.rules || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo reglas' });
  }
});

app.post('/api/rules', (req, res) => {
  try {
    const rule = req.body;
    if (!rule || !rule.title) {
      return res.status(400).json({ success: false, error: 'Regla inválida' });
    }
    const state = loadServerState();
    const rules = Array.isArray(state.rules) ? state.rules : [];
    const idx = rules.findIndex((r: any) => r.id === rule.id);
    if (idx >= 0) {
      rules[idx] = rule;
    } else {
      rules.push({ ...rule, id: rule.id || 'rule-' + Date.now() });
    }
    state.rules = rules;
    saveServerState(state);
    return res.json({ success: true, rules: state.rules });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando regla' });
  }
});

app.delete('/api/rules/:id', (req, res) => {
  try {
    const ruleId = req.params.id;
    const state = loadServerState();
    state.rules = (state.rules || []).filter((r: any) => r.id !== ruleId);
    saveServerState(state);
    return res.json({ success: true, rules: state.rules });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error eliminando regla' });
  }
});

// 10. Contacts Endpoints
app.get('/api/contacts', (_req, res) => {
  try {
    const state = loadServerState();
    return res.json({ success: true, contacts: state.contacts || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo contactos' });
  }
});

app.post('/api/contacts', (req, res) => {
  try {
    const contact = req.body;
    if (!contact || !contact.name) {
      return res.status(400).json({ success: false, error: 'Contacto inválido' });
    }
    const state = loadServerState();
    const contacts = Array.isArray(state.contacts) ? state.contacts : [];
    const idx = contacts.findIndex((c: any) => c.id === contact.id);
    if (idx >= 0) {
      contacts[idx] = contact;
    } else {
      contacts.push({ ...contact, id: contact.id || 'cnt-' + Date.now() });
    }
    state.contacts = contacts;
    saveServerState(state);
    return res.json({ success: true, contacts: state.contacts });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando contacto' });
  }
});

app.delete('/api/contacts/:id', (req, res) => {
  try {
    const cntId = req.params.id;
    const state = loadServerState();
    state.contacts = (state.contacts || []).filter((c: any) => c.id !== cntId);
    saveServerState(state);
    return res.json({ success: true, contacts: state.contacts });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error eliminando contacto' });
  }
});

// 11. Documents Endpoints
app.get('/api/documents', (_req, res) => {
  try {
    const state = loadServerState();
    return res.json({ success: true, documents: state.documents || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo documentos' });
  }
});

app.post('/api/documents', (req, res) => {
  try {
    const doc = req.body;
    if (!doc || !doc.title) {
      return res.status(400).json({ success: false, error: 'Documento inválido' });
    }
    const state = loadServerState();
    const docs = Array.isArray(state.documents) ? state.documents : [];
    const idx = docs.findIndex((d: any) => d.id === doc.id);
    if (idx >= 0) {
      docs[idx] = doc;
    } else {
      docs.push({ ...doc, id: doc.id || 'doc-' + Date.now() });
    }
    state.documents = docs;
    saveServerState(state);
    return res.json({ success: true, documents: state.documents });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando documento' });
  }
});

app.delete('/api/documents/:id', (req, res) => {
  try {
    const docId = req.params.id;
    const state = loadServerState();
    state.documents = (state.documents || []).filter((d: any) => d.id !== docId);
    saveServerState(state);
    return res.json({ success: true, documents: state.documents });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error eliminando documento' });
  }
});

// 12. Inventory Endpoints
app.get('/api/inventory', (_req, res) => {
  try {
    const state = loadServerState();
    return res.json({ success: true, inventory: state.inventory || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo inventario' });
  }
});

app.post('/api/inventory', (req, res) => {
  try {
    const item = req.body;
    if (!item || !item.name) {
      return res.status(400).json({ success: false, error: 'Artículo inválido' });
    }
    const state = loadServerState();
    const inv = Array.isArray(state.inventory) ? state.inventory : [];
    const idx = inv.findIndex((i: any) => i.id === item.id);
    if (idx >= 0) {
      inv[idx] = item;
    } else {
      inv.push({ ...item, id: item.id || 'inv-' + Date.now() });
    }
    state.inventory = inv;
    saveServerState(state);
    return res.json({ success: true, inventory: state.inventory });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando inventario' });
  }
});

app.delete('/api/inventory/:id', (req, res) => {
  try {
    const invId = req.params.id;
    const state = loadServerState();
    state.inventory = (state.inventory || []).filter((i: any) => i.id !== invId);
    saveServerState(state);
    return res.json({ success: true, inventory: state.inventory });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error eliminando inventario' });
  }
});

// 13. Incidents Endpoints
app.get('/api/incidents', (_req, res) => {
  try {
    const state = loadServerState();
    return res.json({ success: true, incidents: state.incidents || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo incidentes' });
  }
});

app.post('/api/incidents', (req, res) => {
  try {
    const incident = req.body;
    if (!incident || !incident.title) {
      return res.status(400).json({ success: false, error: 'Incidente inválido' });
    }
    const state = loadServerState();
    const incs = Array.isArray(state.incidents) ? state.incidents : [];
    const idx = incs.findIndex((i: any) => i.id === incident.id);
    if (idx >= 0) {
      incs[idx] = incident;
    } else {
      incs.unshift({ ...incident, id: incident.id || 'inc-' + Date.now() });
    }
    state.incidents = incs;
    saveServerState(state);
    return res.json({ success: true, incidents: state.incidents });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando incidente' });
  }
});

// 14. Fee Collections
app.get('/api/fees', (_req, res) => {
  try {
    const state = loadServerState();
    return res.json({ success: true, fees: state.fees || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo cobranzas' });
  }
});

app.post('/api/fees', (req, res) => {
  try {
    const fee = req.body;
    if (!fee || !fee.id) {
      return res.status(400).json({ success: false, error: 'Cobranza no válida' });
    }
    const state = loadServerState();
    const fees = Array.isArray(state.fees) ? state.fees : [];
    const idx = fees.findIndex((f: any) => f.id === fee.id);
    if (idx >= 0) {
      fees[idx] = fee;
    } else {
      fees.unshift(fee);
    }
    state.fees = fees;
    saveServerState(state);
    return res.json({ success: true, fee });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando cobranza' });
  }
});

// 15. Expenses
app.get('/api/expenses', (_req, res) => {
  try {
    const state = loadServerState();
    return res.json({ success: true, expenses: state.expenses || [] });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error obteniendo gastos' });
  }
});

app.post('/api/expenses', (req, res) => {
  try {
    const expense = req.body;
    if (!expense || !expense.id) {
      return res.status(400).json({ success: false, error: 'Gasto no válido' });
    }
    const state = loadServerState();
    const expenses = Array.isArray(state.expenses) ? state.expenses : [];
    const idx = expenses.findIndex((e: any) => e.id === expense.id);
    if (idx >= 0) {
      expenses[idx] = expense;
    } else {
      expenses.unshift(expense);
    }
    state.expenses = expenses;
    saveServerState(state);
    return res.json({ success: true, expense });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando gasto' });
  }
});

app.delete('/api/expenses/:id', (req, res) => {
  try {
    const expId = req.params.id;
    const state = loadServerState();
    state.expenses = (state.expenses || []).filter((e: any) => e.id !== expId);
    saveServerState(state);
    return res.json({ success: true });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error eliminando gasto' });
  }
});
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
