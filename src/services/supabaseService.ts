import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Booking, DateBlock, DocumentItem, IncidentReport, NotificationPush } from '../types';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
  lastSyncedAt?: string;
}

const DEFAULT_EXPENSE_CATEGORIES: Array<{ id: string; name: string }> = [];
const DEFAULT_CASHFLOW_CATEGORIES: Array<{ id: string; name: string }> = [];
const DEFAULT_FEE_CATEGORIES: Array<{ id: string; name: string }> = [];
const DEFAULT_INVENTORY_CATEGORIES: Array<{ id: string; name: string }> = [];

const SUPABASE_CONFIG_KEY = 'el_desayuno_supabase_config_v1';
const LEGACY_SUPABASE_URL = 'https://zzfmsxrqhshmoiaysjtr.supabase.co';

export const DEFAULT_SUPABASE_CONFIG: SupabaseConfig = {
  url: 'https://doixvzuomaqplmypjmga.supabase.co',
  anonKey: 'sb_publishable_kkozpUJhQelYWD1mGAtUMw_LtJJorUv',
  enabled: true,
};

class SupabaseService {
  private config: SupabaseConfig;
  private client: SupabaseClient | null = null;
  private pullInFlight: Promise<{ success: boolean; data?: Record<string, any>; message: string }> | null = null;

  constructor() {
    this.config = this.loadConfig();
    this.initClient();
  }

  private loadConfig(): SupabaseConfig {
    if (typeof window === 'undefined') return DEFAULT_SUPABASE_CONFIG;
    const raw = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (!raw) return DEFAULT_SUPABASE_CONFIG;
    try {
      const savedConfig = JSON.parse(raw) as Partial<SupabaseConfig>;
      // Actualiza automáticamente las sesiones que todavía apuntaban a la base saturada.
      if (savedConfig.url === LEGACY_SUPABASE_URL) {
        localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(DEFAULT_SUPABASE_CONFIG));
        return DEFAULT_SUPABASE_CONFIG;
      }
      return { ...DEFAULT_SUPABASE_CONFIG, ...savedConfig };
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
          // La base es la fuente de verdad: nunca reutilizar una respuesta HTTP anterior.
          global: {
            fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              Pragma: 'no-cache',
            },
          },
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

  private async deleteRow(table: string, id: string): Promise<boolean> {
    if (!this.client) return false;
    const { data, error } = await this.client
      .from(table)
      .delete()
      .eq('id', id)
      .select('id');
    if (error || !data?.some((row: { id: string }) => row.id === id)) {
      console.error(`Error eliminando ${table} de Supabase:`, error || 'La base de datos no confirmó la eliminación.');
      return false;
    }
    return true;
  }

  private async upsertRow(table: string, row: Record<string, any>): Promise<boolean> {
    if (!this.client) return false;
    const { data, error } = await this.client
      .from(table)
      .upsert(row, { onConflict: 'id' })
      .select('id');
    if (error || !data?.some((saved: { id: string }) => saved.id === row.id)) {
      console.error(`Error guardando ${table} en Supabase:`, error || 'La base de datos no confirmó el guardado.');
      return false;
    }
    return true;
  }

  private async deleteAllRows(table: string): Promise<boolean> {
    console.warn(`[Supabase Shield] Operación destructiva masiva 'deleteAllRows' bloqueada para la tabla '${table}' para blindar los datos.`);
    return false;
  }

  public async getSettingsFromSupabase(): Promise<Record<string, any> | null> {
    if (!this.client) return null;
    const { data, error } = await this.client.from('settings').select('*').limit(1);
    if (error || !data?.[0]) return null;
    const settings = data[0] as any;
    return {
      houseName: settings.house_name,
      slogan: settings.slogan,
      cuitFideicomiso: settings.cuit_fideicomiso,
      titularCuenta: settings.titular_cuenta,
      cbu: settings.cbu,
      aliasBancario: settings.alias_bancario,
      bancoNombre: settings.banco_nombre,
      location: settings.location,
      checkInTime: settings.check_in_time,
      checkOutTime: settings.check_out_time,
      logoUrl: settings.logo_url,
      wifiSsid: settings.wifi_ssid,
      wifiPassword: settings.wifi_password,
      updatedAt: settings.updated_at,
    };
  }

  /** Lee únicamente los rótulos de Gastos desde la base central. */
  public async fetchExpenseCategories(): Promise<{ success: boolean; categories: Array<{ id: string; name: string }> }> {
    if (!this.client) return { success: false, categories: [] };

    const [expenseCategoriesResult, operationalCategoriesResult] = await Promise.all([
      this.client.from('expense_categories').select('id, name'),
      this.client.from('operational_categories').select('id, name, type').eq('type', 'expense'),
    ]);

    if (expenseCategoriesResult.error && operationalCategoriesResult.error) {
      console.error('Error leyendo categorías de gastos de Supabase:', expenseCategoriesResult.error, operationalCategoriesResult.error);
      return { success: false, categories: [] };
    }

    const categoriesById = new Map<string, { id: string; name: string }>();
    for (const category of expenseCategoriesResult.data || []) {
      categoriesById.set(String(category.id), { id: String(category.id), name: String(category.name || category.id) });
    }
    for (const category of operationalCategoriesResult.data || []) {
      const id = String(category.id);
      if (!categoriesById.has(id)) {
        categoriesById.set(id, { id, name: String(category.name || category.id) });
      }
    }

    return { success: true, categories: Array.from(categoriesById.values()) };
  }

  /** Consulta liviana usada sólo por la pantalla de Categorías Operativas. */
  public async fetchAllOperationalCategories(): Promise<{
    success: boolean;
    categories: Record<'expense' | 'cashflow' | 'fee' | 'inventory', Array<{ id: string; name: string }>>;
  }> {
    const empty = { expense: [], cashflow: [], fee: [], inventory: [] } as Record<'expense' | 'cashflow' | 'fee' | 'inventory', Array<{ id: string; name: string }>>;
    if (!this.client) return { success: false, categories: empty };

    const [expenseResult, cashFlowResult, feeResult, inventoryResult, operationalResult] = await Promise.all([
      this.client.from('expense_categories').select('id, name'),
      this.client.from('cashflow_categories').select('id, name'),
      this.client.from('fee_categories').select('id, name'),
      this.client.from('inventory_categories').select('id, name'),
      this.client.from('operational_categories').select('id, name, type'),
    ]);

    const results = [expenseResult, cashFlowResult, feeResult, inventoryResult, operationalResult];
    if (results.every((result) => result.error)) {
      console.error('Error leyendo categorías operativas de Supabase:', results.map((result) => result.error));
      return { success: false, categories: empty };
    }

    const addCategories = (type: 'expense' | 'cashflow' | 'fee' | 'inventory', rows: Array<{ id: string; name: string }> | null, overwrite = true) => {
      for (const row of rows || []) {
        const item = { id: String(row.id), name: String(row.name || row.id) };
        const currentIndex = empty[type].findIndex((category) => category.id === item.id);
        if (currentIndex < 0) empty[type].push(item);
        else if (overwrite) empty[type][currentIndex] = item;
      }
    };

    addCategories('expense', expenseResult.data);
    addCategories('cashflow', cashFlowResult.data);
    addCategories('fee', feeResult.data);
    addCategories('inventory', inventoryResult.data);
    for (const row of operationalResult.data || []) {
      const type = row.type as 'expense' | 'cashflow' | 'fee' | 'inventory';
      if (type in empty) addCategories(type, [{ id: row.id, name: row.name }], false);
    }

    return { success: true, categories: empty };
  }

  public async saveSettingsToSupabase(settings: Record<string, any>): Promise<Record<string, any>> {
    if (!this.client) throw new Error('Supabase no está configurado.');
    const { data, error } = await this.client
      .from('settings')
      .upsert({
        id: 'default', house_name: settings.houseName || '', slogan: settings.slogan || '',
        cuit_fideicomiso: settings.cuitFideicomiso || '', titular_cuenta: settings.titularCuenta || '',
        cbu: settings.cbu || '', alias_bancario: settings.aliasBancario || '', banco_nombre: settings.bancoNombre || '',
        location: settings.location || '', check_in_time: settings.checkInTime || '', check_out_time: settings.checkOutTime || '',
        logo_url: settings.logoUrl || '', wifi_ssid: settings.wifiSsid || '', wifi_password: settings.wifiPassword || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message || 'La base de datos no confirmó los ajustes.');
    return (await this.getSettingsFromSupabase()) || {};
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
      // Ping Supabase rest endpoint
      const { error } = await tempClient.from('settings').select('id').limit(1);

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

  // Save/Push state into normalized Supabase tables
  public async pushDataToSupabase(payload: Record<string, any>): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!this.client) {
      return { success: false, message: 'Supabase no está configurado.' };
    }

    try {
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
          password: u.password !== undefined ? u.password : '',
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
          invoice_number: e.invoiceNumber || '',
          status: e.status || 'paid',
          paid_at: e.paidAt || null,
          payment_method: e.paymentMethod || 'cash',
          receipt_url: e.receiptUrl || '',
          period_month: e.periodMonth || '',
          notes: e.notes || '',
          created_by: e.createdBy || '',
          user_id: e.userId || null,
          user_name: e.userName || '',
          part_name: e.partName || '',
          approval_status: e.approvalStatus || 'approved',
          approved_at: e.approvedAt || null,
          approved_by: e.approvedBy || '',
          rejection_reason: e.rejectionReason || '',
          // Los gastos anteriores al flujo de adelantos se consideran pagos
          // desde Caja/Banco. Solo la pantalla de Gastos marca explícitamente
          // un adelanto personal como unpaid/partial/fully_repaid.
          reimbursement_status: e.reimbursementStatus || 'not_applicable',
          reimbursed_amount: e.reimbursedAmount || 0,
          transferred_to_fee_collection_id: e.transferredToFeeCollectionId || null,
          transferred_percentage: e.transferredPercentage ?? null,
          transferred_installments: e.transferredInstallments ?? null,
          created_at: e.createdAt || new Date().toISOString(),
        }));
        const { error: expError } = await this.client.from('expenses').upsert(expRows, { onConflict: 'id' });
        if (expError) {
          console.error('[Supabase] Error guardando expenses:', expError.message);
          return { success: false, message: `Error guardando gastos en Supabase: ${expError.message}` };
        }
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

        // Push categories to dedicated Supabase tables
        if (Array.isArray(s.expenseCategories) && s.expenseCategories.length > 0) {
          const expRows = s.expenseCategories.map((c: any) => ({ id: String(c.id), name: String(c.name) }));
          try { await this.client.from('expense_categories').upsert(expRows, { onConflict: 'id' }); } catch {}
        }
        if (Array.isArray(s.cashFlowCategories) && s.cashFlowCategories.length > 0) {
          const cfRows = s.cashFlowCategories.map((c: any) => ({ id: String(c.id), name: String(c.name) }));
          try { await this.client.from('cashflow_categories').upsert(cfRows, { onConflict: 'id' }); } catch {}
        }
        if (Array.isArray(s.feeCategories) && s.feeCategories.length > 0) {
          const feeRows = s.feeCategories.map((c: any) => ({ id: String(c.id), name: String(c.name) }));
          try { await this.client.from('fee_categories').upsert(feeRows, { onConflict: 'id' }); } catch {}
        }
        if (Array.isArray(s.inventoryCategories) && s.inventoryCategories.length > 0) {
          const invRows = s.inventoryCategories.map((c: any) => ({ id: String(c.id), name: String(c.name) }));
          try { await this.client.from('inventory_categories').upsert(invRows, { onConflict: 'id' }); } catch {}
        }

        // Also push to operational_categories for fallback
        const catRows: Array<{ id: string; name: string; type: string }> = [];
        if (Array.isArray(s.expenseCategories)) {
          s.expenseCategories.forEach((c: any) => catRows.push({ id: String(c.id), name: String(c.name), type: 'expense' }));
        }
        if (Array.isArray(s.cashFlowCategories)) {
          s.cashFlowCategories.forEach((c: any) => catRows.push({ id: String(c.id), name: String(c.name), type: 'cashflow' }));
        }
        if (Array.isArray(s.feeCategories)) {
          s.feeCategories.forEach((c: any) => catRows.push({ id: String(c.id), name: String(c.name), type: 'fee' }));
        }
        if (Array.isArray(s.inventoryCategories)) {
          s.inventoryCategories.forEach((c: any) => catRows.push({ id: String(c.id), name: String(c.name), type: 'inventory' }));
        }

        if (catRows.length > 0) {
          try { await this.client.from('operational_categories').upsert(catRows, { onConflict: 'id' }); } catch (e) { console.warn('Supabase operational_categories push error:', e); }
        }
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

      if (Array.isArray(payload.blocks) && payload.blocks.length > 0) {
        const blkRows = payload.blocks.map((b: any) => ({
          id: b.id,
          start_date: b.startDate || b.start_date || null,
          end_date: b.endDate || b.end_date || null,
          total_days: b.totalDays || b.total_days || 0,
          reason: b.reason || '',
          title: b.title || '',
          notes: b.notes || '',
          created_by: b.createdBy || b.created_by || '',
          created_at: b.createdAt || b.created_at || new Date().toISOString(),
        }));
        try { await this.client.from('blocks').upsert(blkRows, { onConflict: 'id' }); } catch {}
      }

      if (Array.isArray(payload.rules) && payload.rules.length > 0) {
        const ruleRows = payload.rules.map((r: any) => ({
          id: r.id,
          title: r.title || '',
          description: r.description || '',
          category: r.category || '',
          icon: r.icon || '',
          priority: r.priority || 0,
          created_at: r.createdAt || r.created_at || new Date().toISOString(),
        }));
        try { await this.client.from('rules').upsert(ruleRows, { onConflict: 'id' }); } catch {}
      }

      this.saveConfig({ lastSyncedAt: new Date().toISOString() });
      return { success: true, message: '¡Datos sincronizados exitosamente en las tablas de Supabase!' };
    } catch (err: any) {
      return { success: false, message: `Error en la solicitud: ${err.message}` };
    }
  }

  // Pull complete app state directly from Supabase relational tables. Todas las
  // vistas comparten la misma consulta en curso para evitar decenas de lecturas
  // simultáneas al abrir la aplicación.
  public pullDataFromSupabase(scopes?: string[]): Promise<{
    success: boolean;
    data?: Record<string, any>;
    message: string;
  }> {
    // Sólo se comparte la descarga completa. Las actualizaciones por módulo
    // son chicas e independientes para no bloquearse ni bajar toda la base.
    if (scopes?.length) return this.pullDataFromSupabaseOnce(scopes);
    if (!this.pullInFlight) {
      this.pullInFlight = this.pullDataFromSupabaseOnce().finally(() => {
        this.pullInFlight = null;
      });
    }
    return this.pullInFlight;
  }

  public async getSyncChanges(afterRevision?: number): Promise<{ success: boolean; changes: Array<{ revision: number; scope: string }> }> {
    if (!this.client) return { success: false, changes: [] };
    let query = this.client
      .from('app_sync_events')
      .select('revision, scope')
      .order('revision', { ascending: true })
      .limit(50);
    if (typeof afterRevision === 'number') query = query.gt('revision', afterRevision);
    const { data, error } = await query;
    if (error) return { success: false, changes: [] };
    return {
      success: true,
      changes: (data || []).map((row: any) => ({ revision: Number(row.revision) || 0, scope: String(row.scope || '') })),
    };
  }

  private async pullDataFromSupabaseOnce(scopes?: string[]): Promise<{
    success: boolean;
    data?: Record<string, any>;
    message: string;
  }> {
    if (!this.client) {
      return { success: false, message: 'Supabase no está configurado.' };
    }

    try {
      const requested = new Set(scopes || []);
      const wants = (scope: string) => requested.size === 0 || requested.has(scope);
      const none = { data: null, error: null } as any;
      const [
        usersRes,
        expensesRes,
        cashFlowRes,
        feesRes,
        bookingsRes,
        inventoryRes,
        incidentsRes,
        settingsRes,
        expCatRes,
        cfCatRes,
        feeCatRes,
        invCatRes,
        opCatsRes,
        blocksRes,
        rulesRes,
        contactsRes,
        documentsRes,
        notificationsRes,
      ] = await Promise.all([
        wants('users') ? this.client.from('users').select('*') : Promise.resolve(none),
        wants('expenses') ? this.client.from('expenses').select('*') : Promise.resolve(none),
        wants('cash_flow') ? this.client.from('cash_flow').select('*') : Promise.resolve(none),
        wants('fee_collections') ? this.client.from('fee_collections').select('*') : Promise.resolve(none),
        wants('bookings') ? this.client.from('bookings').select('*') : Promise.resolve(none),
        wants('inventory') ? this.client.from('inventory').select('*') : Promise.resolve(none),
        wants('incidents') ? this.client.from('incidents').select('*') : Promise.resolve(none),
        (wants('settings') || wants('expense_categories') || wants('cashflow_categories') || wants('fee_categories') || wants('inventory_categories') || wants('operational_categories')) ? this.client.from('settings').select('*').limit(1) : Promise.resolve(none),
        (wants('settings') || wants('expense_categories') || wants('operational_categories')) ? this.client.from('expense_categories').select('*') : Promise.resolve(none),
        (wants('settings') || wants('cashflow_categories') || wants('operational_categories')) ? this.client.from('cashflow_categories').select('*') : Promise.resolve(none),
        (wants('settings') || wants('fee_categories') || wants('operational_categories')) ? this.client.from('fee_categories').select('*') : Promise.resolve(none),
        (wants('settings') || wants('inventory_categories') || wants('operational_categories')) ? this.client.from('inventory_categories').select('*') : Promise.resolve(none),
        (wants('settings') || wants('operational_categories') || wants('expense_categories') || wants('cashflow_categories') || wants('fee_categories') || wants('inventory_categories')) ? this.client.from('operational_categories').select('*') : Promise.resolve(none),
        wants('blocks') ? this.client.from('blocks').select('*') : Promise.resolve(none),
        wants('rules') ? this.client.from('rules').select('*') : Promise.resolve(none),
        wants('contacts') ? this.client.from('contacts').select('*') : Promise.resolve(none),
        wants('documents') ? this.client.from('documents').select('*') : Promise.resolve(none),
        wants('notifications') ? this.client
          .from('notifications')
          .select('id,title,body,type,read,read_by_user_ids,dismissed_by_user_ids,created_at,target_user_id,booking_id,booking_user_id,booking_user_name,booking_part_name,check_in_date,check_out_date,total_days')
          .order('created_at', { ascending: false })
          .limit(7) : Promise.resolve(none),
      ]);

      const essentialFailures = [
        ['usuarios', wants('users') && usersRes.error],
        ['gastos', wants('expenses') && expensesRes.error],
        ['caja', wants('cash_flow') && cashFlowRes.error],
        ['cobranzas', wants('fee_collections') && feesRes.error],
        ['reservas', wants('bookings') && bookingsRes.error],
        ['inventario', wants('inventory') && inventoryRes.error],
        ['incidentes', wants('incidents') && incidentsRes.error],
        ['ajustes', wants('settings') && settingsRes.error],
      ].filter(([, error]) => Boolean(error));
      if (essentialFailures.length > 0) {
        const detail = essentialFailures
          .map(([name, error]) => `${name}: ${(error as { message?: string })?.message || 'sin detalle'}`)
          .join(' | ');
        return {
          success: false,
          message: `No se reemplazó la pantalla porque Supabase no confirmó una lectura completa. ${detail}`,
        };
      }

      const data: Record<string, any> = {};

      if (!usersRes.error && Array.isArray(usersRes.data)) {
        data.users = usersRes.data.map((u: any) => ({
          id: u.id,
          name: u.name || '',
          username: u.username || '',
          email: u.email || '',
          phone: u.phone || '',
          role: u.role || 'owner',
          isFiduciante: u.role === 'fiduciante',
          isCabezaDeEquipo: Boolean(u.is_cabeza_de_equipo),
          cabezaNumber: Number(u.cabeza_number) || 0,
          partName: u.part_name || '',
          color: u.color || '',
          active: u.active ?? false,
          annualQuotaDays: Number(u.annual_quota_days) || 0,
          pendingDays: Number(u.pending_days) || 0,
          usedDays: Number(u.used_days) || 0,
          sharePercentage: Number(u.share_percentage) || 0,
          avatarInitials: u.avatar_initials || '',
          createdAt: u.created_at || '',
          password: u.password || '',
        }));
      }
      if (!expensesRes.error && Array.isArray(expensesRes.data)) {
        data.expenses = expensesRes.data.map((e: any) => ({
          id: e.id,
          date: e.date || '',
          concept: e.concept || '',
          amount: Number(e.amount) || 0,
          currency: e.currency || 'ARS',
          category: e.category || 'otro',
          provider: e.provider || '',
          invoiceNumber: e.invoice_number || '',
          status: e.status || 'paid',
          paidAt: e.paid_at || undefined,
          createdBy: e.created_by || '',
          receiptUrl: e.receipt_url || '',
          paymentMethod: e.payment_method || 'transfer',
          periodMonth: e.period_month || '',
          notes: e.notes || '',
          createdAt: e.created_at,
          userId: e.user_id || null,
          userName: e.user_name || '',
          partName: e.part_name || '',
          approvalStatus: e.approval_status || 'approved',
          approvedAt: e.approved_at || null,
          approvedBy: e.approved_by || '',
          rejectionReason: e.rejection_reason || '',
          reimbursementStatus: e.reimbursement_status || 'not_applicable',
          reimbursedAmount: Number(e.reimbursed_amount) || 0,
          transferredToFeeCollectionId: e.transferred_to_fee_collection_id || undefined,
          transferredPercentage: e.transferred_percentage === null || e.transferred_percentage === undefined ? undefined : Number(e.transferred_percentage),
          transferredInstallments: e.transferred_installments === null || e.transferred_installments === undefined ? undefined : Number(e.transferred_installments),
        }));
      }
      if (!cashFlowRes.error && Array.isArray(cashFlowRes.data)) {
        data.cashFlow = cashFlowRes.data.map((transaction: any) => ({
          id: transaction.id, type: transaction.type, category: transaction.category, concept: transaction.concept || '',
          amount: Number(transaction.amount) || 0, currency: transaction.currency || 'ARS', date: transaction.date || '',
          userId: transaction.user_id || undefined, userName: transaction.user_name || '', partName: transaction.part_name || '',
          expenseId: transaction.expense_id || undefined, notes: transaction.notes || '', createdBy: transaction.created_by || '',
          createdAt: transaction.created_at || '',
        }));
      }
      if (!feesRes.error && Array.isArray(feesRes.data)) {
        data.fees = feesRes.data.map((fee: any) => ({
          id: fee.id, concept: fee.concept || '', category: fee.category || 'otro', totalAmount: Number(fee.total_amount) || 0,
          currency: fee.currency || 'ARS', recurrence: fee.recurrence || 'one_time', issueDate: fee.issue_date || '',
          dueDate: fee.due_date || '', distributionMode: fee.distribution_mode || 'share_percentage',
          allocations: Array.isArray(fee.allocations) ? fee.allocations : (() => {
            try { return JSON.parse(fee.allocations || '[]'); } catch { return []; }
          })(),
          status: fee.status || 'active', createdBy: fee.created_by || '', createdAt: fee.created_at || '', notes: fee.notes || '',
          installmentsCount: Number(fee.installments_count) || 1, installmentNumber: Number(fee.installment_number) || 1,
          originalExpenseId: fee.original_expense_id || undefined,
        }));
      }
      if (!bookingsRes.error && Array.isArray(bookingsRes.data)) {
        data.bookings = bookingsRes.data.map((b: any) => ({
          id: b.id, userId: b.user_id, userName: b.user_name || '', userColor: b.user_color || '',
          partName: b.part_name || '', checkInDate: b.check_in_date, checkOutDate: b.check_out_date,
          totalDays: Number(b.total_days) || 0, guestsCount: Number(b.guests_count) || 0,
          status: b.status, arrivalTime: b.arrival_time || '', notes: b.notes || '',
          cleaningBufferApplied: Boolean(b.cleaning_buffer_applied), cleaningBufferEndDate: b.cleaning_buffer_end_date || undefined,
          cancellationReason: b.cancellation_reason || undefined, cancelledAt: b.cancelled_at || undefined,
          cancelledBy: b.cancelled_by || undefined, createdAt: b.created_at || '',
        }));
      }
      if (!inventoryRes.error && Array.isArray(inventoryRes.data)) {
        data.inventory = inventoryRes.data.map((item: any) => ({
          id: item.id, name: item.name || '', category: item.category, locationRoom: item.location_room || '', unitPrice: Number(item.unit_price) || 0,
          quantity: Number(item.quantity) || 0, unit: item.unit || '', condition: item.condition,
          notes: item.notes || '', imageUrl: item.image_url || undefined, lastCheckedDate: item.last_checked_date || '',
        }));
      }
      if (!incidentsRes.error && Array.isArray(incidentsRes.data)) {
        const urgencyBySeverity: Record<string, string> = { low: 'baja', medium: 'media', high: 'alta', critical: 'urgente', urgent: 'urgente' };
        const statusByDatabaseStatus: Record<string, string> = { open: 'pendiente', pending: 'pendiente', in_review: 'en_revision', in_progress: 'en_reparacion', resolved: 'resuelto', dismissed: 'desestimado' };
        data.incidents = incidentsRes.data.map((incident: any) => ({
          id: incident.id, bookingId: incident.booking_id || undefined, reporterUserId: incident.reporter_user_id || '',
          reporterName: incident.reported_by || incident.reporter_name || '', reporterPartName: incident.reporter_part_name || '',
          title: incident.title || '', description: incident.description || '', location: incident.location || '',
          category: incident.category || 'otro', urgency: urgencyBySeverity[incident.severity] || incident.urgency || 'media',
          status: statusByDatabaseStatus[incident.status] || incident.status || 'pendiente', photoUrl: incident.photo_url || undefined,
          createdAt: incident.created_at || '', adminResponse: incident.admin_response || undefined,
          resolvedAt: incident.resolved_at || undefined, resolvedBy: incident.resolved_by || undefined,
        }));
      }

      if (!settingsRes.error && Array.isArray(settingsRes.data) && settingsRes.data[0]) {
        const s = settingsRes.data[0];
        data.settings = {
          houseName: s.house_name,
          slogan: s.slogan,
          cuitFideicomiso: s.cuit_fideicomiso,
          titularCuenta: s.titular_cuenta,
          cbu: s.cbu,
          aliasBancario: s.alias_bancario,
          bancoNombre: s.banco_nombre,
          location: s.location,
          checkInTime: s.check_in_time,
          checkOutTime: s.check_out_time,
          logoUrl: s.logo_url,
          wifiSsid: s.wifi_ssid,
          wifiPassword: s.wifi_password,
        };
      }

      if (!settingsRes.error && !data.settings) data.settings = {};

      // Parse dedicated category tables first
      const expCats: Array<{ id: string; name: string }> = [];
      const cfCats: Array<{ id: string; name: string }> = [];
      const feeCats: Array<{ id: string; name: string }> = [];
      const invCats: Array<{ id: string; name: string }> = [];

      if (!expCatRes.error && Array.isArray(expCatRes.data) && expCatRes.data.length > 0) {
        expCatRes.data.forEach((c: any) => expCats.push({ id: c.id, name: c.name || c.id }));
      }
      if (!cfCatRes.error && Array.isArray(cfCatRes.data) && cfCatRes.data.length > 0) {
        cfCatRes.data.forEach((c: any) => cfCats.push({ id: c.id, name: c.name || c.id }));
      }
      if (!feeCatRes.error && Array.isArray(feeCatRes.data) && feeCatRes.data.length > 0) {
        feeCatRes.data.forEach((c: any) => feeCats.push({ id: c.id, name: c.name || c.id }));
      }
      if (!invCatRes.error && Array.isArray(invCatRes.data) && invCatRes.data.length > 0) {
        invCatRes.data.forEach((c: any) => invCats.push({ id: c.id, name: c.name || c.id }));
      }

      // Fallback from operational_categories table if dedicated tables are empty
      if (!opCatsRes.error && Array.isArray(opCatsRes.data) && opCatsRes.data.length > 0) {
        opCatsRes.data.forEach((c: any) => {
          const item = { id: c.id, name: c.name || c.id };
          if (c.type === 'expense' && !expCats.some(x => x.id === item.id)) expCats.push(item);
          else if (c.type === 'cashflow' && !cfCats.some(x => x.id === item.id)) cfCats.push(item);
          else if (c.type === 'fee' && !feeCats.some(x => x.id === item.id)) feeCats.push(item);
          else if (c.type === 'inventory' && !invCats.some(x => x.id === item.id)) invCats.push(item);
        });
      }

      // Cada familia de categorías se confirma por separado. Si una tabla no
      // está disponible, no debe ocultar las categorías de Gastos que sí se
      // recibieron correctamente.
      if (data.settings) {
        if (wants('settings') || wants('expense_categories') || wants('operational_categories')) {
          data.settings.expenseCategories = expCats.length > 0 ? expCats : DEFAULT_EXPENSE_CATEGORIES;
        }
        if (wants('settings') || wants('cashflow_categories') || wants('operational_categories')) {
          data.settings.cashFlowCategories = cfCats.length > 0 ? cfCats : DEFAULT_CASHFLOW_CATEGORIES;
        }
        if (wants('settings') || wants('fee_categories') || wants('operational_categories')) {
          data.settings.feeCategories = feeCats.length > 0 ? feeCats : DEFAULT_FEE_CATEGORIES;
        }
        if (wants('settings') || wants('inventory_categories') || wants('operational_categories')) {
          data.settings.inventoryCategories = invCats.length > 0 ? invCats : DEFAULT_INVENTORY_CATEGORIES;
        }
      }

      if (!blocksRes.error && Array.isArray(blocksRes.data)) {
        data.blocks = blocksRes.data.map((block: any) => ({
          id: block.id, startDate: block.start_date, endDate: block.end_date, totalDays: Number(block.total_days) || 0,
          reason: block.reason, title: block.title || '', notes: block.notes || '', createdBy: block.created_by || '', createdAt: block.created_at || '',
        }));
      }
      if (!rulesRes.error && Array.isArray(rulesRes.data)) {
        data.rules = rulesRes.data.map((rule: any) => ({
          id: rule.id, title: rule.title || '', description: rule.description || '', category: rule.category,
          iconName: rule.icon || rule.icon_name || '',
        }));
      }
      if (!contactsRes.error && Array.isArray(contactsRes.data)) {
        data.contacts = contactsRes.data.map((contact: any) => ({
          id: contact.id, name: contact.name || '', role: contact.role || '', phone: contact.phone || '',
          category: contact.category, isEmergency: Boolean(contact.is_emergency), availableHours: contact.available_hours || '', notes: contact.notes || '',
        }));
      }
      if (!documentsRes.error && Array.isArray(documentsRes.data)) {
        data.documents = documentsRes.data.map((document: any) => {
          let metadata: Record<string, any> = {};
          try {
            const parsed = JSON.parse(document.file_type || '{}');
            if (parsed && typeof parsed === 'object') metadata = parsed;
          } catch {
            metadata = { mimeType: document.file_type || '' };
          }

          const attachmentUrl = document.file_url || undefined;
          const attachmentMimeType = metadata.mimeType || metadata.type || '';
          return {
            id: document.id,
            title: document.title || 'Documento sin título',
            category: document.category || 'acta',
            version: metadata.version || 'Documento oficial',
            date: metadata.date || (document.uploaded_at ? new Date(document.uploaded_at).toLocaleDateString('es-AR') : ''),
            fileSize: metadata.fileSize || '',
            description: metadata.description || '',
            downloadUrl: attachmentUrl,
            attachmentUrl,
            attachmentName: metadata.fileName || '',
            attachmentMimeType,
            // Compatibilidad con las fotos cargadas antes de esta mejora.
            photoUrl: attachmentMimeType.startsWith('image/') ? attachmentUrl : undefined,
          };
        });
      }
      if (!notificationsRes.error && Array.isArray(notificationsRes.data)) {
        data.notifications = notificationsRes.data.map((notification: any) => ({
          id: notification.id,
          title: notification.title || '',
          body: notification.body || '',
          type: notification.type || 'system',
          read: Boolean(notification.read),
          readByUserIds: Array.isArray(notification.read_by_user_ids) ? notification.read_by_user_ids : [],
          dismissedByUserIds: Array.isArray(notification.dismissed_by_user_ids) ? notification.dismissed_by_user_ids : [],
          timestamp: notification.created_at || notification.timestamp || '',
          targetUserId: notification.target_user_id || null,
          bookingId: notification.booking_id || null,
          bookingUserId: notification.booking_user_id || null,
          bookingUserName: notification.booking_user_name || null,
          bookingPartName: notification.booking_part_name || null,
          checkInDate: notification.check_in_date || null,
          checkOutDate: notification.check_out_date || null,
          totalDays: notification.total_days ?? null,
        }));
      }

      return {
        success: true,
        data,
        message: '¡Datos descargados correctamente desde las tablas relacionales de Supabase!',
      };
    } catch (err: any) {
      return { success: false, message: `Error descargando de Supabase: ${err.message}` };
    }
  }

  public async saveCategoryToTable(
    categoryType: 'expense' | 'cashflow' | 'fee' | 'inventory',
    category: { id: string; name: string }
  ): Promise<boolean> {
    if (!this.client) return false;
    try {
      const tableName = `${categoryType === 'cashflow' ? 'cashflow' : categoryType}_categories`;
      await this.client.from(tableName).upsert({ id: String(category.id), name: String(category.name) }, { onConflict: 'id' });
      await this.client.from('operational_categories').upsert({ id: String(category.id), name: String(category.name), type: categoryType }, { onConflict: 'id' });
      return true;
    } catch (err) {
      console.error('Error guardando categoría en Supabase:', err);
      return false;
    }
  }

  public async deleteCategoryFromTable(
    categoryType: 'expense' | 'cashflow' | 'fee' | 'inventory',
    categoryId: string
  ): Promise<boolean> {
    if (!this.client) return false;
    const tableName = `${categoryType === 'cashflow' ? 'cashflow' : categoryType}_categories`;
    const { error } = await this.client.from(tableName).delete().eq('id', categoryId);
    if (error) {
      console.error('Error eliminando categoría de Supabase:', error);
      return false;
    }
    const { error: operationalError } = await this.client.from('operational_categories').delete().eq('id', categoryId);
    if (operationalError) console.warn('No se pudo eliminar la categoría duplicada:', operationalError);
    return true;
  }

  public async deleteOperationalCategory(categoryId: string): Promise<boolean> {
    return this.deleteCategoryFromTable('expense', categoryId);
  }

  public async deleteUser(userId: string): Promise<boolean> {
    return this.deleteRow('users', userId);
  }

  public async deleteExpense(expenseId: string): Promise<boolean> {
    return this.deleteRow('expenses', expenseId);
  }

  public async saveExpense(expense: Record<string, any>): Promise<boolean> {
    const result = await this.pushDataToSupabase({ expenses: [expense] });
    if (!result.success) {
      console.error('Error guardando gasto de Supabase:', result.message);
    }
    return result.success;
  }

  public async saveUser(user: Record<string, any>): Promise<boolean> {
    return this.upsertRow('users', {
      id: user.id,
      name: user.name || '',
      username: user.username || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'owner',
      is_cabeza_de_equipo: Boolean(user.isCabezaDeEquipo),
      cabeza_number: Number(user.cabezaNumber) || 0,
      part_name: user.partName || '',
      color: user.color || '#000000',
      active: user.active ?? true,
      annual_quota_days: Number(user.annualQuotaDays) || 0,
      pending_days: Number(user.pendingDays) || 0,
      used_days: Number(user.usedDays) || 0,
      share_percentage: Number(user.sharePercentage) || 0,
      avatar_initials: user.avatarInitials || '',
      created_at: user.createdAt || new Date().toISOString(),
      password: user.password !== undefined ? user.password : '',
    });
  }

  public async saveUsers(users: Record<string, any>[]): Promise<boolean> {
    const results = await Promise.all(users.map((user) => this.saveUser(user)));
    return results.every(Boolean);
  }

  public async saveInventoryItem(item: Record<string, any>): Promise<boolean> {
    return this.upsertRow('inventory', {
      id: item.id, name: item.name || '', category: item.category || '', quantity: Number(item.quantity) || 0,
      unit: item.unit || 'unidades', condition: item.condition || 'bueno', location_room: item.locationRoom || '',
      unit_price: Math.max(0, Number(item.unitPrice) || 0), last_checked_date: item.lastCheckedDate || null,
    });
  }

  public async saveCashFlowTransaction(transaction: Record<string, any>): Promise<boolean> {
    return this.upsertRow('cash_flow', {
      id: transaction.id, type: transaction.type || 'ingreso', category: transaction.category || 'otro_ingreso',
      concept: transaction.concept || '', amount: Number(transaction.amount) || 0, currency: transaction.currency || 'ARS',
      date: transaction.date || null, user_id: transaction.userId || null, user_name: transaction.userName || '',
      part_name: transaction.partName || '', expense_id: transaction.expenseId || null, notes: transaction.notes || '',
      created_by: transaction.createdBy || '', created_at: transaction.createdAt || new Date().toISOString(),
    });
  }

  /** Notificaciones compartidas: se persisten para que cada usuario las reciba al ingresar. */
  public async saveNotification(notification: NotificationPush): Promise<boolean> {
    return this.upsertRow('notifications', {
      id: notification.id,
      title: notification.title || '',
      body: notification.body || '',
      type: notification.type || 'system',
      booking_id: notification.bookingId || null,
      target_user_id: notification.targetUserId || null,
      booking_user_id: notification.bookingUserId || null,
      booking_user_name: notification.bookingUserName || null,
      booking_part_name: notification.bookingPartName || null,
      check_in_date: notification.checkInDate || null,
      check_out_date: notification.checkOutDate || null,
      total_days: notification.totalDays ?? null,
      read: false,
      read_by_user_ids: notification.readByUserIds || [],
      dismissed_by_user_ids: notification.dismissedByUserIds || [],
      created_at: notification.timestamp || new Date().toISOString(),
    });
  }

  private notificationRow(notification: NotificationPush, changes: Partial<NotificationPush> = {}) {
    const merged = { ...notification, ...changes };
    return {
      id: merged.id,
      title: merged.title || '',
      body: merged.body || '',
      type: merged.type || 'system',
      booking_id: merged.bookingId || null,
      target_user_id: merged.targetUserId || null,
      booking_user_id: merged.bookingUserId || null,
      booking_user_name: merged.bookingUserName || null,
      booking_part_name: merged.bookingPartName || null,
      check_in_date: merged.checkInDate || null,
      check_out_date: merged.checkOutDate || null,
      total_days: merged.totalDays ?? null,
      read: merged.read,
      read_by_user_ids: merged.readByUserIds || [],
      dismissed_by_user_ids: merged.dismissedByUserIds || [],
      created_at: merged.timestamp || new Date().toISOString(),
    };
  }

  public async markNotificationsAsReadForUser(notifications: NotificationPush[], userId: string): Promise<boolean> {
    const results = await Promise.all(notifications.map((notification) => {
      const readByUserIds = [...new Set([...(notification.readByUserIds || []), userId])];
      return this.upsertRow('notifications', this.notificationRow(notification, { readByUserIds }));
    }));
    return results.every(Boolean);
  }

  public async dismissNotificationsForUser(notifications: NotificationPush[], userId: string): Promise<boolean> {
    const results = await Promise.all(notifications.map((notification) => {
      const dismissedByUserIds = [...new Set([...(notification.dismissedByUserIds || []), userId])];
      return this.upsertRow('notifications', this.notificationRow(notification, { dismissedByUserIds }));
    }));
    return results.every(Boolean);
  }

  public async saveFeeCollection(collection: Record<string, any>): Promise<boolean> {
    return this.upsertRow('fee_collections', {
      id: collection.id, concept: collection.concept || '', category: collection.category || 'otro',
      total_amount: Number(collection.totalAmount) || 0, currency: collection.currency || 'ARS',
      recurrence: collection.recurrence || 'one_time', issue_date: collection.issueDate || null, due_date: collection.dueDate || null,
      distribution_mode: collection.distributionMode || 'share_percentage', allocations: JSON.stringify(collection.allocations || []),
      status: collection.status || 'active', created_by: collection.createdBy || '',
      created_at: collection.createdAt || new Date().toISOString(), notes: collection.notes || '',
      installments_count: Number(collection.installmentsCount) || 1, installment_number: Number(collection.installmentNumber) || 1,
      original_expense_id: collection.originalExpenseId || null,
    });
  }

  /** Novedades: lectura directa desde la base, sin pasar por localStorage. */
  public async fetchIncidents(): Promise<IncidentReport[]> {
    if (!this.client) return [];
    const { data, error } = await this.client
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) {
      console.error('Error leyendo novedades de Supabase:', error);
      return [];
    }

    const urgencyBySeverity: Record<string, IncidentReport['urgency']> = {
      low: 'baja', medium: 'media', high: 'alta', critical: 'urgente', urgent: 'urgente',
      baja: 'baja', media: 'media', alta: 'alta', urgente: 'urgente',
    };
    const statusByDatabaseStatus: Record<string, IncidentReport['status']> = {
      open: 'pendiente', pending: 'pendiente', in_review: 'en_revision', in_progress: 'en_reparacion',
      resolved: 'resuelto', dismissed: 'desestimado', pendiente: 'pendiente', en_revision: 'en_revision',
      en_reparacion: 'en_reparacion', resuelto: 'resuelto', desestimado: 'desestimado',
    };
    return data.map((incident: Record<string, any>) => ({
      id: incident.id,
      bookingId: incident.booking_id || undefined,
      reporterUserId: incident.reporter_user_id || '',
      reporterName: incident.reported_by || '',
      reporterPartName: incident.reporter_part_name || '',
      title: incident.title || '',
      description: incident.description || '',
      location: incident.location || '',
      category: incident.category || 'otro',
      urgency: urgencyBySeverity[incident.severity] || 'media',
      status: statusByDatabaseStatus[incident.status] || 'pendiente',
      photoUrl: incident.photo_url || undefined,
      createdAt: incident.created_at || '',
      adminResponse: incident.admin_response || undefined,
      resolvedAt: incident.resolved_at || undefined,
      resolvedBy: incident.resolved_by || undefined,
    }));
  }

  /** Novedades: el alta y las actualizaciones se confirman en Supabase. */
  public async saveIncident(incident: IncidentReport): Promise<boolean> {
    const severityByUrgency: Record<IncidentReport['urgency'], string> = {
      baja: 'low', media: 'medium', alta: 'high', urgente: 'critical',
    };
    const statusByAppStatus: Record<IncidentReport['status'], string> = {
      pendiente: 'pending', en_revision: 'in_review', en_reparacion: 'in_progress',
      resuelto: 'resolved', desestimado: 'dismissed',
    };
    return this.upsertRow('incidents', {
      id: incident.id,
      booking_id: incident.bookingId || null,
      reporter_user_id: incident.reporterUserId || null,
      reported_by: incident.reporterName || '',
      reporter_part_name: incident.reporterPartName || '',
      title: incident.title || '',
      description: incident.description || '',
      location: incident.location || '',
      category: incident.category || 'otro',
      severity: severityByUrgency[incident.urgency],
      status: statusByAppStatus[incident.status],
      photo_url: incident.photoUrl || null,
      admin_response: incident.adminResponse || null,
      resolved_at: incident.resolvedAt || null,
      resolved_by: incident.resolvedBy || null,
      created_at: incident.createdAt || new Date().toISOString(),
    });
  }

  public async deleteCashFlowTransaction(txId: string): Promise<boolean> {
    return this.deleteRow('cash_flow', txId);
  }

  public async deleteFeeCollection(feeId: string): Promise<boolean> {
    return this.deleteRow('fee_collections', feeId);
  }

  public async deleteBlock(blockId: string): Promise<boolean> {
    return this.deleteRow('blocks', blockId);
  }

  public async deleteNotification(notificationId: string): Promise<boolean> {
    return this.deleteRow('notifications', notificationId);
  }

  public async markNotificationsAsRead(notificationIds: string[]): Promise<boolean> {
    const ids = [...new Set(notificationIds.filter(Boolean))];
    if (ids.length === 0) return true;
    if (!this.client) return false;
    const { data, error } = await this.client
      .from('notifications')
      .update({ read: true })
      .in('id', ids)
      .select('id');
    if (error || (data?.length || 0) !== ids.length) {
      console.error('Error marcando notificaciones como leídas:', error || 'La base no confirmó todos los avisos.');
      return false;
    }
    return true;
  }

  /** Los bloqueos operativos se confirman primero en la base central. */
  public async saveBlock(block: DateBlock): Promise<boolean> {
    return this.upsertRow('blocks', {
      id: block.id,
      start_date: block.startDate,
      end_date: block.endDate,
      total_days: block.totalDays,
      reason: block.reason,
      title: block.title,
      notes: block.notes || null,
      created_by: block.createdBy,
      created_at: block.createdAt,
    });
  }

  /** Una reserva sólo se considera creada o modificada cuando la base central la confirma. */
  public async saveBooking(booking: Booking): Promise<boolean> {
    return this.upsertRow('bookings', {
      id: booking.id,
      user_id: booking.userId,
      user_name: booking.userName,
      check_in_date: booking.checkInDate,
      check_out_date: booking.checkOutDate,
      total_days: booking.totalDays,
      guests_count: booking.guestsCount,
      status: booking.status,
      user_color: booking.userColor,
      part_name: booking.partName,
      arrival_time: booking.arrivalTime || '',
      cancellation_reason: booking.cancellationReason || '',
      cancelled_at: booking.cancelledAt || null,
      cancelled_by: booking.cancelledBy || '',
      created_at: booking.createdAt,
    });
  }

  public async deleteRule(ruleId: string): Promise<boolean> {
    return this.deleteRow('rules', ruleId);
  }

  public async deleteContact(contactId: string): Promise<boolean> {
    return this.deleteRow('contacts', contactId);
  }

  /** Guarda la ficha del documento después de que el archivo quedó en R2. */
  public async saveDocument(document: DocumentItem): Promise<boolean> {
    const attachmentUrl = document.attachmentUrl || document.photoUrl || document.downloadUrl || '';
    return this.upsertRow('documents', {
      id: document.id,
      title: document.title || '',
      category: document.category || 'acta',
      file_url: attachmentUrl,
      // La tabla histórica tiene un único campo para tipo. Se conserva allí el
      // tipo y los datos de presentación sin duplicar el archivo en la base.
      file_type: JSON.stringify({
        mimeType: document.attachmentMimeType || '',
        fileName: document.attachmentName || '',
        version: document.version || '',
        date: document.date || '',
        fileSize: document.fileSize || '',
        description: document.description || '',
      }),
      uploaded_at: new Date().toISOString(),
    });
  }

  public async deleteDocument(documentId: string): Promise<boolean> {
    return this.deleteRow('documents', documentId);
  }

  public async deleteAllDocuments(): Promise<boolean> {
    return this.deleteAllRows('documents');
  }

  public async deleteInventoryItem(itemId: string): Promise<boolean> {
    return this.deleteRow('inventory', itemId);
  }

  public async deleteIncident(incidentId: string): Promise<boolean> {
    return this.deleteRow('incidents', incidentId);
  }

  /** Un reporte de novedad sólo puede borrarse si pertenece al usuario que lo creó. */
  public async deleteOwnedIncident(incidentId: string, reporterUserId: string): Promise<boolean> {
    if (!this.client || !reporterUserId) return false;
    const { data, error } = await this.client
      .from('incidents')
      .delete()
      .eq('id', incidentId)
      .eq('reporter_user_id', reporterUserId)
      .select('id');
    if (error || !data?.some((row: { id: string }) => row.id === incidentId)) {
      console.error('La base no autorizó eliminar esta novedad:', error || 'El reporte no pertenece al usuario.');
      return false;
    }
    return true;
  }
}

export const supabaseService = new SupabaseService();
