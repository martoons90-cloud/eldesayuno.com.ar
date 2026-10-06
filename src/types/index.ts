export type UserRole = 'owner' | 'admin';

export interface User {
  id: string;
  name: string;
  username?: string; // e.g. "efrain.rodriguez"
  email: string;
  role: UserRole;
  partName: string; // e.g. "Cabeza 1 - Parte I (25%)"
  cabezaNumber?: number; // 1, 2, 3, 4
  annualQuotaDays: number;
  usedDays: number;
  pendingDays: number;
  color: string; // Hex color for calendar
  avatarInitials: string;
  phone: string;
  password?: string; // 6-character non-predictable alphanumeric password (e.g. G93TO5)
  active: boolean;
  createdAt: string;
}

export type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed';

export interface Booking {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  partName: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  totalDays: number;
  status: BookingStatus;
  guestsCount: number;
  arrivalTime: string;
  notes?: string;
  cleaningBufferApplied: boolean;
  cleaningBufferEndDate?: string; // Next day YYYY-MM-DD
  createdAt: string;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
}

export type BlockReason = 'maintenance' | 'repairs' | 'deep_cleaning' | 'seasonal_prep' | 'extraordinary';

export interface DateBlock {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalDays: number;
  reason: BlockReason;
  title: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface HouseRule {
  id: string;
  category: 'horarios' | 'capacidad' | 'mascotas' | 'quincho' | 'pileta' | 'convivencia';
  title: string;
  description: string;
  iconName: string;
}

export interface UsefulContact {
  id: string;
  category: 'emergencia' | 'seguridad' | 'personal' | 'servicios';
  name: string;
  role: string;
  phone: string;
  availableHours: string;
  notes?: string;
  isEmergency?: boolean;
}

export interface DocumentItem {
  id: string;
  title: string;
  category: 'contrato' | 'acta' | 'reglamento' | 'mantenimiento' | 'manual';
  version: string;
  date: string;
  fileSize: string;
  description: string;
  downloadUrl?: string;
}

export type InventoryCategory =
  | 'living_galeria'
  | 'cocina_vajilla'
  | 'suites_dormitorios'
  | 'quincho_asador'
  | 'piscina_parque'
  | 'blanqueria_ropa'
  | 'equipamiento_tecnico';

export type InventoryCondition = 'excelente' | 'bueno' | 'regular' | 'requiere_reparacion' | 'faltante';

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  locationRoom: string; // e.g. "Quincho", "Suite Principal", "Cocina"
  quantity: number;
  unit: string; // "unidades", "juegos", "piezas", "bolsas"
  condition: InventoryCondition;
  notes?: string;
  imageUrl?: string;
  lastCheckedDate: string;
}

export type IncidentUrgency = 'baja' | 'media' | 'alta' | 'urgente';
export type IncidentStatus = 'pendiente' | 'en_revision' | 'en_reparacion' | 'resuelto' | 'desestimado';

export interface IncidentReport {
  id: string;
  bookingId?: string;
  reporterUserId: string;
  reporterName: string;
  reporterPartName: string;
  title: string;
  description: string;
  location: string;
  category: 'rotura' | 'faltante' | 'desperfecto_tecnico' | 'limpieza' | 'mantenimiento' | 'otro';
  urgency: IncidentUrgency;
  status: IncidentStatus;
  photoUrl?: string;
  createdAt: string;
  adminResponse?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface NotificationPush {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  type: 'booking_created' | 'booking_cancelled' | 'block_added' | 'quota_updated' | 'incident_reported' | 'incident_resolved' | 'system';
  targetUserId?: string; // null means all users or admins
  bookingId?: string;
  incidentId?: string;
}

export interface TrustSettings {
  houseName: string;
  slogan?: string;
  location: string;
  googleMapsUrl?: string;
  wifiSsid: string;
  wifiPassword: string;
  secondaryWifiSsid?: string;
  secondaryWifiPassword?: string;
  checkInTime: string; // "14:00"
  checkOutTime: string; // "11:00"
  autoCleaningBufferHours: number; // 24
  cancellationMinDays: number; // 7
  maxGuestsLimit: number; // 12
  maxConsecutiveDays?: number; // 14
  maxActiveBookingsPerOwner?: number; // 3
  emergencyAddress: string;
  caretakerName?: string;
  caretakerPhone?: string;
  allowPets?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  logoUrl?: string;
  cbu?: string;
  aliasBancario?: string;
  cuitFideicomiso?: string;
  bancoNombre?: string;
  titularCuenta?: string;
}

// -------------------------------------------------------------
// COBRANZAS, EXPENSAS Y DISTRIBUCIÓN DE GASTOS
// -------------------------------------------------------------
export type DistributionMode = 'equal_cabezas' | 'equal_owners' | 'percentage' | 'custom_amount';

export type RecurrenceType = 'monthly' | 'days_45' | 'days_60' | 'custom_days' | 'one_time';

export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'overdue';

export interface OwnerFeeAllocation {
  userId: string;
  userName: string;
  partName: string; // e.g. "Cabeza 1"
  cabezaNumber?: number;
  percentage: number; // % assigned
  assignedAmount: number; // $ assigned
  paidAmount: number; // $ paid so far
  status: PaymentStatus;
  paidAt?: string; // YYYY-MM-DD
  paymentMethod?: 'transfer' | 'cash' | 'check' | 'mercadopago' | 'other';
  receiptUrl?: string; // Photo voucher in R2
  notes?: string;
}

export interface FeeCollection {
  id: string;
  concept: string; // e.g. "Expensas Mantenimiento General & Servicios"
  category: 'expensas_ordinarias' | 'obras_extraordinarias' | 'servicios' | 'mantenimiento' | 'impuestos' | 'otro';
  totalAmount: number;
  currency: 'ARS' | 'USD';
  recurrence: RecurrenceType;
  customRecurrenceDays?: number;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  distributionMode: DistributionMode;
  allocations: OwnerFeeAllocation[];
  status: 'active' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: string;
  notes?: string;
}
