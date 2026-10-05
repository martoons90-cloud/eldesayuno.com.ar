export type UserRole = 'owner' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  partName: string; // e.g. "Parte I (25%)", "Parte II (25%)"
  annualQuotaDays: number;
  usedDays: number;
  pendingDays: number;
  color: string; // Hex color for calendar
  avatarInitials: string;
  phone: string;
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

export interface NotificationPush {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  type: 'booking_created' | 'booking_cancelled' | 'block_added' | 'quota_updated' | 'system';
  targetUserId?: string; // null means all users or admins
  bookingId?: string;
}

export interface TrustSettings {
  houseName: string;
  location: string;
  wifiSsid: string;
  wifiPassword: string;
  checkInTime: string; // "14:00"
  checkOutTime: string; // "11:00"
  autoCleaningBufferHours: number; // 24
  cancellationMinDays: number; // 7
  maxGuestsLimit: number; // 12
  emergencyAddress: string;
}
