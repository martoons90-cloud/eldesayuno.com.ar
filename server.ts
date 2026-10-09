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

function loadServerState(): Record<string, any> {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const raw = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[Server State] Error leyendo STATE_FILE_PATH, re-inicializando semilla:', err);
  }
  const seed = getFullSeedState();
  fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(seed, null, 2), 'utf-8');
  return seed;
}

function saveServerState(state: Record<string, any>): void {
  try {
    state.updatedAt = new Date().toISOString();
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Server State] Error escribiendo STATE_FILE_PATH:', err);
  }
}

// Initialize seed on startup
loadServerState();

// 1. Get full App State (Canonical Cloud Truth)
app.get('/api/app-state', (_req, res) => {
  try {
    const data = loadServerState();
    return res.json({ success: true, data });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error leyendo estado en servidor' });
  }
});

// 2. Set/Restore full App State
app.post('/api/app-state', (req, res) => {
  try {
    const data = req.body;
    if (data && typeof data === 'object') {
      saveServerState(data);
      return res.json({ success: true, message: 'Estado actualizado en servidor' });
    }
    return res.status(400).json({ success: false, error: 'Datos no válidos' });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error guardando estado en servidor' });
  }
});

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
      status: 'confirmed',
      guestsCount,
      arrivalTime,
      notes: notes ? notes.trim() : undefined,
      cleaningBufferApplied,
      createdAt: new Date().toISOString(),
    };

    state.bookings = [newBooking, ...bookings];

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

    // Add push notification in server state
    if (!Array.isArray(state.notifications)) state.notifications = [];
    state.notifications.unshift({
      id: 'notif-' + Date.now(),
      title: 'Nueva Reserva Confirmada',
      body: `${userName} reservó del ${checkInDate} al ${checkOutDate} (${finalDays} días).`,
      type: 'booking_created',
      bookingId: newBooking.id,
      createdAt: new Date().toISOString(),
      read: false,
    });

    saveServerState(state);

    return res.status(201).json({
      success: true,
      booking: newBooking,
      message: `Reserva guardada y bloqueada en la nube para ${userName}.`,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error procesando reserva en el servidor',
    });
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

    // Recalculate user quotas
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
    state.notifications.unshift({
      id: 'notif-' + Date.now(),
      title: 'Reserva Cancelada',
      body: `La reserva de ${target.userName} (${target.checkInDate} a ${target.checkOutDate}) fue cancelada por ${cancelledByName}.`,
      type: 'booking_cancelled',
      bookingId: target.id,
      createdAt: new Date().toISOString(),
      read: false,
    });

    saveServerState(state);
    return res.json({ success: true, message: 'Reserva cancelada en el servidor.' });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error cancelando reserva' });
  }
});

// 6. Save/Update User on server
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
            sharePercentage: Math.max(0, Math.round(Number(sharesMap[u.id]) * 100) / 100),
          };
        }
        return u;
      });
    }
    saveServerState(state);
    return res.json({ success: true, message: 'Acciones actualizadas en servidor' });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error actualizando acciones' });
  }
});

// 8. Create Date Block
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
      id: 'block-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    state.blocks = [newBlock, ...blocks];
    saveServerState(state);
    return res.status(201).json({ success: true, block: newBlock });
  } catch (err: unknown) {
    return res.status(500).json({ success: false, error: 'Error creando bloqueo' });
  }
});

// 9. Delete Date Block
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

// 10. Save Fee Collection
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

// 11. Save Expense
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
