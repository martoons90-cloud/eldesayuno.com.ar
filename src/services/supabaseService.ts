import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
  lastSyncedAt?: string;
}

const SUPABASE_CONFIG_KEY = 'el_desayuno_supabase_config_v1';

export const DEFAULT_SUPABASE_CONFIG: SupabaseConfig = {
  url: 'https://zzfmsxrqhshmoiaysjtr.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6Zm1zeHJxaHNobW9pYXlzanRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5Nzk4MzAsImV4cCI6MjEwNzU1NTgzMH0.D3M9dPwdqMFos6HRmWOlTBSeLNSDnk0V3X9HQZnyoMY',
  enabled: true,
};

class SupabaseService {
  private config: SupabaseConfig;
  private client: SupabaseClient | null = null;

  constructor() {
    this.config = this.loadConfig();
    this.initClient();
  }

  private loadConfig(): SupabaseConfig {
    if (typeof window === 'undefined') return DEFAULT_SUPABASE_CONFIG;
    const raw = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (!raw) return DEFAULT_SUPABASE_CONFIG;
    try {
      return { ...DEFAULT_SUPABASE_CONFIG, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_SUPABASE_CONFIG;
    }
  }

  public getConfig(): SupabaseConfig {
    return { ...this.config };
  }

  public saveConfig(newConfig: Partial<SupabaseConfig>): SupabaseConfig {
    this.config = { ...this.config, ...newConfig };
    if (typeof window !== 'undefined') {
      localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(this.config));
    }
    this.initClient();
    return this.config;
  }

  private initClient() {
    if (this.config.url && this.config.anonKey) {
      try {
        this.client = createClient(this.config.url, this.config.anonKey, {
          auth: { persistSession: false },
        });
        this.config.enabled = true;
      } catch (err) {
        console.warn('[Supabase] Error inicializando cliente:', err);
        this.client = null;
        this.config.enabled = false;
      }
    } else {
      this.client = null;
      this.config.enabled = false;
    }
  }

  public isConnected(): boolean {
    return Boolean(this.client && this.config.url && this.config.anonKey);
  }

  public getClient(): SupabaseClient | null {
    return this.client;
  }

  public async testConnection(customUrl?: string, customKey?: string): Promise<{
    success: boolean;
    message: string;
    latencyMs?: number;
  }> {
    const url = customUrl || this.config.url;
    const key = customKey || this.config.anonKey;

    if (!url || !key) {
      return {
        success: false,
        message: 'Falta ingresar la URL del Proyecto y la clave Anon (API Key) de Supabase.',
      };
    }

    const startTime = Date.now();
    try {
      const tempClient = createClient(url, key, { auth: { persistSession: false } });
      // Ping Supabase RPC or rest endpoint
      const { error } = await tempClient.from('app_state').select('id').limit(1);

      // If table doesn't exist yet, it will return 42P01 (relation does not exist) or 200/empty, both prove successful connection
      const latencyMs = Date.now() - startTime;
      if (!error || error.code === 'PGRST116' || error.code === '42P01') {
        return {
          success: true,
          message: `¡Conexión exitosa con Supabase! Latencia: ${latencyMs}ms.`,
          latencyMs,
        };
      }

      return {
        success: false,
        message: `Error al conectar con Supabase: ${error.message} (Código: ${error.code})`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `No se pudo conectar a la URL de Supabase: ${err.message || 'Error de red'}`,
      };
    }
  }

  // Save/Push complete app state to Supabase JSON table 'app_state'
  public async pushDataToSupabase(payload: Record<string, any>): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!this.client) {
      return { success: false, message: 'Supabase no está configurado.' };
    }

    try {
      const row = {
        id: 'default_app_state',
        data: payload,
        updated_at: new Date().toISOString(),
      };

      const { error } = await this.client.from('app_state').upsert(row, { onConflict: 'id' });

      if (error) {
        // If table doesn't exist, provide SQL query instructions
        if (error.code === '42P01') {
          return {
            success: false,
            message: 'La tabla "app_state" no existe en Supabase. Ejecutá la consulta de inicialización en el SQL Editor de Supabase.',
          };
        }
        return { success: false, message: `Error guardando en Supabase: ${error.message}` };
      }

      this.saveConfig({ lastSyncedAt: new Date().toISOString() });
      return { success: true, message: '¡Datos sincronizados exitosamente en Supabase!' };
    } catch (err: any) {
      return { success: false, message: `Error en la solicitud: ${err.message}` };
    }
  }

  // Pull complete app state from Supabase JSON table 'app_state'
  public async pullDataFromSupabase(): Promise<{
    success: boolean;
    data?: Record<string, any>;
    message: string;
  }> {
    if (!this.client) {
      return { success: false, message: 'Supabase no está configurado.' };
    }

    try {
      const { data, error } = await this.client
        .from('app_state')
        .select('data, updated_at')
        .eq('id', 'default_app_state')
        .single();

      if (error) {
        return { success: false, message: `Error leyendo de Supabase: ${error.message}` };
      }

      return {
        success: true,
        data: data?.data,
        message: '¡Datos descargados correctamente desde Supabase!',
      };
    } catch (err: any) {
      return { success: false, message: `Error descargando de Supabase: ${err.message}` };
    }
  }
}

export const supabaseService = new SupabaseService();
