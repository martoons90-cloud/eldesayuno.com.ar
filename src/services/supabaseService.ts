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

      // Sync relational tables directly
      if (Array.isArray(payload.users) && payload.users.length > 0) {
        const userRows = payload.users.map((u: any) => ({
          id: u.id,
          name: u.name || '',
          username: u.username || '',
          email: u.email || '',
          phone: u.phone || '',
          role: u.role || 'owner',
          cabeza_number: u.cabezaNumber || 0,
          part_name: u.partName || '',
          color: u.color || '#000000',
          active: u.active ?? true,
          annual_quota_days: u.annualQuotaDays || 30,
          pending_days: u.pendingDays || 0,
          used_days: u.usedDays || 0,
          share_percentage: typeof u.sharePercentage === 'number' ? u.sharePercentage : (parseFloat(u.sharePercentage) || 0),
          avatar_initials: u.avatarInitials || '',
          created_at: u.createdAt || new Date().toISOString(),
        }));
        try { await this.client.from('users').upsert(userRows, { onConflict: 'id' }); } catch {}
      }

      if (Array.isArray(payload.expenses) && payload.expenses.length > 0) {
        const expRows = payload.expenses.map((e: any) => ({
          id: e.id,
          date: e.date || null,
          concept: e.concept || '',
          amount: e.amount || 0,
          currency: e.currency || 'ARS',
          category: e.category || 'otro',
          provider: e.provider || '',
          status: e.status || 'paid',
          created_by: e.createdBy || '',
          receipt_url: e.receiptUrl || '',
          payment_method: e.paymentMethod || 'cash',
          period_month: e.periodMonth || '',
          notes: e.notes || '',
          created_at: e.createdAt || new Date().toISOString(),
        }));
        try { await this.client.from('expenses').upsert(expRows, { onConflict: 'id' }); } catch {}
      }

      if (Array.isArray(payload.cashFlow) && payload.cashFlow.length > 0) {
        const cfRows = payload.cashFlow.map((cf: any) => ({
          id: cf.id,
          type: cf.type || 'ingreso',
          category: cf.category || 'otro_ingreso',
          concept: cf.concept || '',
          amount: cf.amount || 0,
          currency: cf.currency || 'ARS',
          date: cf.date || null,
          user_id: cf.userId || null,
          user_name: cf.userName || '',
          part_name: cf.partName || '',
          expense_id: cf.expenseId || null,
          notes: cf.notes || '',
          created_by: cf.createdBy || '',
          created_at: cf.createdAt || new Date().toISOString(),
        }));
        try { await this.client.from('cash_flow').upsert(cfRows, { onConflict: 'id' }); } catch {}
      }

      if (Array.isArray(payload.fees) && payload.fees.length > 0) {
        const feeRows = payload.fees.map((f: any) => ({
          id: f.id,
          concept: f.concept || '',
          category: f.category || 'expensas_ordinarias',
          total_amount: f.totalAmount || 0,
          currency: f.currency || 'ARS',
          recurrence: f.recurrence || 'mensual',
          issue_date: f.issueDate || null,
          due_date: f.dueDate || null,
          distribution_mode: f.distributionMode || 'proporcional',
          allocations: f.allocations ? JSON.stringify(f.allocations) : '[]',
          status: f.status || 'active',
          created_by: f.createdBy || '',
          created_at: f.createdAt || new Date().toISOString(),
          notes: f.notes || '',
          installments_count: f.installmentsCount || 1,
          installment_number: f.installmentNumber || 1,
          original_expense_id: f.originalExpenseId || null,
        }));
        try { await this.client.from('fee_collections').upsert(feeRows, { onConflict: 'id' }); } catch {}
      }

      if (payload.settings && typeof payload.settings === 'object') {
        const s = payload.settings;
        const sRow = {
          id: 'default',
          house_name: s.houseName || '',
          slogan: s.slogan || '',
          cuit_fideicomiso: s.cuitFideicomiso || '',
          titular_cuenta: s.titularCuenta || '',
          cbu: s.cbu || '',
          alias_bancario: s.aliasBancario || '',
          banco_nombre: s.bancoNombre || '',
          location: s.location || '',
          check_in_time: s.checkInTime || '',
          check_out_time: s.checkOutTime || '',
          logo_url: s.logoUrl || '',
          wifi_ssid: s.wifiSsid || '',
          wifi_password: s.wifiPassword || '',
          updated_at: new Date().toISOString(),
        };
        try { await this.client.from('settings').upsert(sRow, { onConflict: 'id' }); } catch {}
      }

      if (Array.isArray(payload.bookings) && payload.bookings.length > 0) {
        const bRows = payload.bookings.map((b: any) => ({
          id: b.id,
          user_id: b.userId || '',
          user_name: b.userName || '',
          check_in_date: b.checkInDate || null,
          check_out_date: b.checkOutDate || null,
          total_days: b.totalDays || 0,
          guests_count: b.guestsCount || 1,
          status: b.status || 'confirmed',
          user_color: b.userColor || '',
          part_name: b.partName || '',
          arrival_time: b.arrivalTime || '',
          cancellation_reason: b.cancellationReason || '',
          cancelled_at: b.cancelledAt || null,
          cancelled_by: b.cancelledBy || '',
          created_at: b.createdAt || new Date().toISOString(),
        }));
        try { await this.client.from('bookings').upsert(bRows, { onConflict: 'id' }); } catch {}
      }

      if (Array.isArray(payload.inventory) && payload.inventory.length > 0) {
        const invRows = payload.inventory.map((inv: any) => ({
          id: inv.id,
          name: inv.name || '',
          category: inv.category || '',
          quantity: inv.quantity || 0,
          unit: inv.unit || 'unidades',
          condition: inv.condition || 'bueno',
          location_room: inv.locationRoom || '',
          last_checked_date: inv.lastCheckedDate || null,
        }));
        try { await this.client.from('inventory').upsert(invRows, { onConflict: 'id' }); } catch {}
      }

      if (Array.isArray(payload.incidents) && payload.incidents.length > 0) {
        const incRows = payload.incidents.map((inc: any) => ({
          id: inc.id,
          title: inc.title || '',
          description: inc.description || '',
          severity: inc.severity || 'baja',
          status: inc.status || 'abierto',
          location: inc.location || '',
          reported_by: inc.reportedBy || '',
          created_at: inc.createdAt || new Date().toISOString(),
        }));
        try { await this.client.from('incidents').upsert(incRows, { onConflict: 'id' }); } catch {}
      }

      this.saveConfig({ lastSyncedAt: new Date().toISOString() });
      return { success: true, message: '¡Datos sincronizados exitosamente en Supabase (app_state y tablas relacionales)!' };
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

  public async deleteUser(userId: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.from('users').delete().eq('id', userId);
      return true;
    } catch (err) {
      console.error('Error eliminando usuario de Supabase:', err);
      return false;
    }
  }

  public async deleteExpense(expenseId: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.from('expenses').delete().eq('id', expenseId);
      return true;
    } catch (err) {
      console.error('Error eliminando gasto de Supabase:', err);
      return false;
    }
  }

  public async deleteCashFlowTransaction(txId: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.from('cash_flow').delete().eq('id', txId);
      return true;
    } catch (err) {
      console.error('Error eliminando transacción de caja de Supabase:', err);
      return false;
    }
  }

  public async deleteFeeCollection(feeId: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.from('fee_collections').delete().eq('id', feeId);
      return true;
    } catch (err) {
      console.error('Error eliminando cobranza de Supabase:', err);
      return false;
    }
  }
}

export const supabaseService = new SupabaseService();
