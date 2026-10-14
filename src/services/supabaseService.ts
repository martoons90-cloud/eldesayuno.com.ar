import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
  lastSyncedAt?: string;
}

const DEFAULT_EXPENSE_CATEGORIES = [{ id: 'mantenimiento', name: 'Mantenimiento' }, { id: 'servicios', name: 'Servicios' }, { id: 'impuestos', name: 'Impuestos' }, { id: 'reparaciones', name: 'Reparaciones' }, { id: 'otro', name: 'Otro' }];
const DEFAULT_CASHFLOW_CATEGORIES = [{ id: 'ingreso_cuota', name: 'Ingreso Cuota' }, { id: 'pago_gasto', name: 'Pago de Gasto' }, { id: 'otro_ingreso', name: 'Otro Ingreso' }];
const DEFAULT_FEE_CATEGORIES = [{ id: 'expensas_ordinarias', name: 'Expensas Ordinarias' }, { id: 'expensas_extraordinarias', name: 'Expensas Extraordinarias' }, { id: 'fondo_reserva', name: 'Fondo de Reserva' }];
const DEFAULT_INVENTORY_CATEGORIES = [{ id: 'general', name: 'General' }, { id: 'cocina', name: 'Cocina' }, { id: 'limpieza', name: 'Limpieza' }, { id: 'herramientas', name: 'Herramientas' }];

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

  // Pull complete app state directly from Supabase relational tables
  public async pullDataFromSupabase(): Promise<{
    success: boolean;
    data?: Record<string, any>;
    message: string;
  }> {
    if (!this.client) {
      return { success: false, message: 'Supabase no está configurado.' };
    }

    try {
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
      ] = await Promise.all([
        this.client.from('users').select('*'),
        this.client.from('expenses').select('*'),
        this.client.from('cash_flow').select('*'),
        this.client.from('fee_collections').select('*'),
        this.client.from('bookings').select('*'),
        this.client.from('inventory').select('*'),
        this.client.from('incidents').select('*'),
        this.client.from('settings').select('*').limit(1),
        this.client.from('expense_categories').select('*'),
        this.client.from('cashflow_categories').select('*'),
        this.client.from('fee_categories').select('*'),
        this.client.from('inventory_categories').select('*'),
        this.client.from('operational_categories').select('*'),
        this.client.from('blocks').select('*'),
        this.client.from('rules').select('*'),
      ]);

      const data: Record<string, any> = {};

      if (!usersRes.error && Array.isArray(usersRes.data)) data.users = usersRes.data;
      if (!expensesRes.error && Array.isArray(expensesRes.data)) data.expenses = expensesRes.data;
      if (!cashFlowRes.error && Array.isArray(cashFlowRes.data)) data.cashFlow = cashFlowRes.data;
      if (!feesRes.error && Array.isArray(feesRes.data)) data.fees = feesRes.data;
      if (!bookingsRes.error && Array.isArray(bookingsRes.data)) data.bookings = bookingsRes.data;
      if (!inventoryRes.error && Array.isArray(inventoryRes.data)) data.inventory = inventoryRes.data;
      if (!incidentsRes.error && Array.isArray(incidentsRes.data)) data.incidents = incidentsRes.data;

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

      if (!data.settings) data.settings = {};

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

      data.settings.expenseCategories = expCats.length > 0 ? expCats : (DEFAULT_EXPENSE_CATEGORIES);
      data.settings.cashFlowCategories = cfCats.length > 0 ? cfCats : (DEFAULT_CASHFLOW_CATEGORIES);
      data.settings.feeCategories = feeCats.length > 0 ? feeCats : (DEFAULT_FEE_CATEGORIES);
      data.settings.inventoryCategories = invCats.length > 0 ? invCats : (DEFAULT_INVENTORY_CATEGORIES);

      if (!blocksRes.error && Array.isArray(blocksRes.data)) data.blocks = blocksRes.data;
      if (!rulesRes.error && Array.isArray(rulesRes.data)) data.rules = rulesRes.data;

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
    try {
      const tableName = `${categoryType === 'cashflow' ? 'cashflow' : categoryType}_categories`;
      await this.client.from(tableName).delete().eq('id', categoryId);
      await this.client.from('operational_categories').delete().eq('id', categoryId);
      return true;
    } catch (err) {
      console.error('Error eliminando categoría de Supabase:', err);
      return false;
    }
  }

  public async deleteOperationalCategory(categoryId: string): Promise<boolean> {
    return this.deleteCategoryFromTable('expense', categoryId);
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
