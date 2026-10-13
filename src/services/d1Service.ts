import { User, Booking, DateBlock, TrustSettings, NotificationPush, InventoryItem, IncidentReport } from '../types';

export interface D1Config {
  accountId: string;
  databaseId: string;
  apiToken: string;
  enabled: boolean;
  lastConnectedAt?: string;
  databaseName?: string;
}

export interface D1Response {
  success: boolean;
  result?: Array<{
    results: Record<string, unknown>[];
    success: boolean;
    meta?: {
      duration: number;
      rows_read?: number;
      rows_written?: number;
    };
  }>;
  errors?: Array<{ code: number; message: string }>;
}

const D1_CONFIG_KEY = 'el_desayuno_d1_config_v1';

export const D1_SCHEMA_SQL = `
-- TABLA DE USUARIOS Y COPROPIETARIOS
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  part_name TEXT NOT NULL,
  annual_quota_days INTEGER NOT NULL DEFAULT 30,
  used_days INTEGER NOT NULL DEFAULT 0,
  pending_days INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#264E36',
  avatar_initials TEXT NOT NULL,
  phone TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- TABLA DE RESERVAS Y ESTADÍAS
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_color TEXT NOT NULL,
  part_name TEXT NOT NULL,
  check_in_date TEXT NOT NULL,
  check_out_date TEXT NOT NULL,
  total_days INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  guests_count INTEGER NOT NULL DEFAULT 4,
  arrival_time TEXT NOT NULL DEFAULT '14:00',
  notes TEXT,
  cleaning_buffer_applied INTEGER NOT NULL DEFAULT 1,
  cleaning_buffer_end_date TEXT,
  created_at TEXT NOT NULL,
  cancellation_reason TEXT,
  cancelled_at TEXT,
  cancelled_by TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- TABLA DE BLOQUEOS DE MANTENIMIENTO Y OBRAS
CREATE TABLE IF NOT EXISTS date_blocks (
  id TEXT PRIMARY KEY,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  total_days INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT 'maintenance',
  title TEXT NOT NULL,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- TABLA DE PARÁMETROS DEL FIDEICOMISO
CREATE TABLE IF NOT EXISTS trust_settings (
  id TEXT PRIMARY KEY DEFAULT 'default_settings',
  house_name TEXT NOT NULL,
  location TEXT NOT NULL,
  wifi_ssid TEXT NOT NULL,
  wifi_password TEXT NOT NULL,
  check_in_time TEXT NOT NULL DEFAULT '14:00',
  check_out_time TEXT NOT NULL DEFAULT '11:00',
  auto_cleaning_buffer_hours INTEGER NOT NULL DEFAULT 24,
  cancellation_min_days INTEGER NOT NULL DEFAULT 7,
  max_guests_limit INTEGER NOT NULL DEFAULT 12,
  emergency_address TEXT NOT NULL,
  logo_url TEXT,
  updated_at TEXT NOT NULL
);

-- TABLA DE INVENTARIO Y STOCK DE LA CASA
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  location_room TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'unidades',
  condition TEXT NOT NULL DEFAULT 'excelente',
  notes TEXT,
  image_url TEXT,
  last_checked_date TEXT NOT NULL
);

-- TABLA DE NOVEDADES, DAÑOS Y REPORTES
CREATE TABLE IF NOT EXISTS incident_reports (
  id TEXT PRIMARY KEY,
  booking_id TEXT,
  reporter_user_id TEXT NOT NULL,
  reporter_name TEXT NOT NULL,
  reporter_part_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'rotura',
  urgency TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'pendiente',
  photo_url TEXT,
  created_at TEXT NOT NULL,
  admin_response TEXT,
  resolved_at TEXT,
  resolved_by TEXT
);

-- TABLA DE NOTIFICACIONES Y AUDITORÍA
CREATE TABLE IF NOT EXISTS audit_notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'system',
  target_user_id TEXT,
  booking_id TEXT
);
`;

class CloudflareD1Service {
  private config: D1Config;
  private serverConnected: boolean = false;
  private serverDurationMs: number = 0;

  constructor() {
    this.config = this.loadConfig();
    this.checkServerStatus();
  }

  public async checkServerStatus(): Promise<{ connected: boolean; latencyMs: number; message: string }> {
    try {
      const res = await fetch('/api/d1/status');
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          this.serverConnected = true;
          this.serverDurationMs = data.durationMs || 1;
          if (!this.config.accountId && data.accountId) {
            this.config.enabled = true;
            this.config.lastConnectedAt = new Date().toISOString();
          }
          return {
            connected: true,
            latencyMs: data.durationMs || 1,
            message: data.message || 'Conexión activa con Cloudflare D1.',
          };
        }
      }
    } catch {
      // server check failed or running in preview
    }
    this.serverConnected = false;
    return { connected: false, latencyMs: 0, message: 'Modo local sin enlace D1.' };
  }

  public loadConfig(): D1Config {
    const envAccountId =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDFLARE_ACCOUNT_ID) ||
      '';
    const envDatabaseId =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDFLARE_DATABASE_ID) ||
      '';
    const envApiToken =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDFLARE_API_TOKEN) ||
      '';

    if (typeof window === 'undefined') {
      return {
        accountId: envAccountId,
        databaseId: envDatabaseId,
        apiToken: envApiToken,
        enabled: Boolean(envAccountId && envDatabaseId && envApiToken),
      };
    }
    const raw = localStorage.getItem(D1_CONFIG_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return {
          accountId: parsed.accountId || envAccountId,
          databaseId: parsed.databaseId || envDatabaseId,
          apiToken: parsed.apiToken || envApiToken,
          enabled: true,
          lastConnectedAt: parsed.lastConnectedAt || new Date().toISOString(),
          databaseName: parsed.databaseName || 'el-desayuno-d1',
        };
      } catch {
        // fallback
      }
    }
    return {
      accountId: envAccountId,
      databaseId: envDatabaseId,
      apiToken: envApiToken,
      enabled: true,
      lastConnectedAt: new Date().toISOString(),
      databaseName: 'el-desayuno-d1',
    };
  }

  public saveConfig(config: D1Config) {
    this.config = config;
    if (typeof window !== 'undefined') {
      localStorage.setItem(D1_CONFIG_KEY, JSON.stringify(config));
    }
  }

  public getConfig(): D1Config {
    return { ...this.config };
  }

  public isConnected(): boolean {
    if (this.serverConnected) return true;
    return Boolean(
      this.config.enabled &&
        this.config.accountId &&
        this.config.databaseId &&
        this.config.apiToken
    );
  }

  // Execute SQL statement directly or via server-side proxy
  public async executeQuery(
    sql: string,
    params: Array<string | number | boolean | null> = []
  ): Promise<{ success: boolean; results: Record<string, unknown>[]; error?: string }> {
    const cfg = this.config;

    try {
      // First try via local server / worker endpoint (uses native env.DB)
      const serverRes = await fetch('/api/d1/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql,
          params,
        }),
      });

      if (serverRes.ok) {
        const data = await serverRes.json();
        if (data.success) {
          const rows = data.result?.[0]?.results || [];
          return { success: true, results: rows };
        } else {
          return { success: false, results: [], error: data.error || 'Error ejecutando query en D1' };
        }
      }

      // Fallback: direct Cloudflare REST API call if client credentials exist
      if (cfg.accountId && cfg.databaseId && cfg.apiToken) {
        const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/d1/database/${cfg.databaseId}/query`;
        const directRes = await fetch(cfUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sql,
            params,
          }),
        });

        const cfData: D1Response = await directRes.json();
        if (cfData.success && cfData.result && cfData.result.length > 0) {
          return {
            success: true,
            results: cfData.result[0].results || [],
          };
        } else {
          const errMsg = cfData.errors?.map((e) => e.message).join(', ') || 'Error en Cloudflare D1';
          return { success: false, results: [], error: errMsg };
        }
      }

      return {
        success: false,
        results: [],
        error: 'No se pudo contactar el servidor proxy de Cloudflare D1.',
      };
    } catch (err: unknown) {
      return {
        success: false,
        results: [],
        error: err instanceof Error ? err.message : 'Fallo en la comunicación con Cloudflare D1',
      };
    }
  }

  // Test connection
  public async testConnection(
    credentials?: { accountId: string; databaseId: string; apiToken: string }
  ): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    const accountId = credentials?.accountId || this.config.accountId;
    const databaseId = credentials?.databaseId || this.config.databaseId;
    const apiToken = credentials?.apiToken || this.config.apiToken;

    if (!accountId || !databaseId || !apiToken) {
      return {
        success: false,
        message: 'Debe ingresar Account ID, Database ID y API Token de Cloudflare.',
      };
    }

    const start = performance.now();
    try {
      // Test query
      const testRes = await fetch('/api/d1/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, databaseId, apiToken }),
      });

      const latencyMs = Math.round(performance.now() - start);

      if (testRes.ok) {
        const data = await testRes.json();
        if (data.success) {
          // Update config last connected
          this.saveConfig({
            ...this.config,
            accountId,
            databaseId,
            apiToken,
            enabled: true,
            lastConnectedAt: new Date().toISOString(),
          });
          return {
            success: true,
            message: `Conexión exitosa con Cloudflare D1 (${latencyMs}ms). Base de datos lista.`,
            latencyMs,
          };
        } else {
          return { success: false, message: data.error || 'No se pudo conectar a Cloudflare D1.' };
        }
      }

      return {
        success: false,
        message: 'Servicio D1 no respondió satisfactoriamente. Verifique los tokens.',
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Error al conectar con Cloudflare D1',
      };
    }
  }

  // Initialize SQLite tables in Cloudflare D1
  public async initializeSchema(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/d1/init-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: this.config.accountId,
          databaseId: this.config.databaseId,
          apiToken: this.config.apiToken,
          sql: D1_SCHEMA_SQL,
        }),
      });

      const data = await res.json();
      if (data.success) {
        return {
          success: true,
          message: 'Tablas (users, bookings, date_blocks, trust_settings, audit_notifications) creadas correctamente en Cloudflare D1.',
        };
      }
      return { success: false, message: data.error || 'Error al ejecutar las migraciones SQL en D1.' };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Error inicializando esquema D1',
      };
    }
  }

  // Push all local data into Cloudflare D1
  public async pushLocalDataToD1(payload: {
    users: User[];
    bookings: Booking[];
    blocks: DateBlock[];
    settings: TrustSettings;
    notifications: NotificationPush[];
    inventory?: InventoryItem[];
    incidents?: IncidentReport[];
  }): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/d1/sync-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: this.config.accountId,
          databaseId: this.config.databaseId,
          apiToken: this.config.apiToken,
          ...payload,
        }),
      });

      const data = await res.json();
      if (data.success) {
        return {
          success: true,
          message: `Sincronización completada: ${payload.users.length} usuarios, ${payload.bookings.length} reservas, ${payload.blocks.length} bloqueos y ${payload.inventory?.length || 0} ítems de inventario persistidos en Cloudflare D1.`,
        };
      }
      return { success: false, message: data.error || 'Error al enviar datos a Cloudflare D1' };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Error en la sincronización con D1',
      };
    }
  }

  // Pull all data from Cloudflare D1 into local application
  public async pullDataFromD1(): Promise<{
    success: boolean;
    data?: {
      users: User[];
      bookings: Booking[];
      blocks: DateBlock[];
      settings?: TrustSettings;
      notifications: NotificationPush[];
      inventory?: InventoryItem[];
      incidents?: IncidentReport[];
    };
    error?: string;
  }> {
    try {
      const res = await fetch('/api/d1/sync-pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          return { success: true, data: data.data };
        }
      }
    } catch {
      // Fallback to direct Cloudflare REST API below
    }

    // Direct Cloudflare D1 query fallback (essential for Cloudflare Pages static deployment)
    if (this.config.accountId && this.config.databaseId && this.config.apiToken) {
      try {
        const [usersRes, bookingsRes, blocksRes, settingsRes] = await Promise.all([
          this.executeQuery('SELECT * FROM users ORDER BY name ASC;'),
          this.executeQuery('SELECT * FROM bookings ORDER BY check_in_date DESC;'),
          this.executeQuery('SELECT * FROM date_blocks ORDER BY start_date DESC;'),
          this.executeQuery("SELECT * FROM trust_settings WHERE id = 'default_settings' LIMIT 1;"),
        ]);

        const users: User[] = (usersRes.results || []).map((row: any) => ({
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

        const bookings: Booking[] = (bookingsRes.results || []).map((row: any) => ({
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
        }));

        const blocks: DateBlock[] = (blocksRes.results || []).map((row: any) => ({
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

        const rawSettings = settingsRes.results?.[0] as any;
        const settings: TrustSettings | undefined = rawSettings
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

        return {
          success: true,
          data: {
            users,
            bookings,
            blocks,
            settings,
            notifications: [],
          },
        };
      } catch (directErr: any) {
        return { success: false, error: directErr.message || 'Error en consulta directa a D1' };
      }
    }

    return {
      success: false,
      error: 'No se pudo consultar Cloudflare D1 (sin conexión).',
    };
  }
}

export const d1Service = new CloudflareD1Service();
