import { User, Booking, BookingStatus, DateBlock, HouseRule, UsefulContact, DocumentItem, TrustSettings, NotificationPush } from '../types';

const USERS_KEY = 'el_desayuno_users_v2';
const BOOKINGS_KEY = 'el_desayuno_bookings_v2';
const BLOCKS_KEY = 'el_desayuno_blocks_v2';
const SETTINGS_KEY = 'el_desayuno_settings_v2';
const NOTIFICATIONS_KEY = 'el_desayuno_notifications_v2';
const CURRENT_USER_KEY = 'el_desayuno_current_user_v2';

export const DEFAULT_USERS: User[] = [
  {
    id: 'user-admin',
    name: 'Martín Benítez',
    email: 'admin@eldesayuno.com',
    role: 'admin',
    partName: 'Fiduciario Administrador',
    annualQuotaDays: 0,
    usedDays: 0,
    pendingDays: 0,
    color: '#1B3B2B', // Forest dark green
    avatarInitials: 'MB',
    phone: '+54 9 11 4455-8899',
    active: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'user-part-1',
    name: 'Gonzalo Estrada',
    email: 'gonzalo@eldesayuno.com',
    role: 'owner',
    partName: 'Parte I (25% indiviso)',
    annualQuotaDays: 30,
    usedDays: 14,
    pendingDays: 0,
    color: '#264E36', // Deep hunter green
    avatarInitials: 'GE',
    phone: '+54 9 11 5566-7788',
    active: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'user-part-2',
    name: 'Florencia Albarracín',
    email: 'florencia@eldesayuno.com',
    role: 'owner',
    partName: 'Parte II (25% indiviso)',
    annualQuotaDays: 30,
    usedDays: 8,
    pendingDays: 0,
    color: '#8A4A28', // Terra cotta / warm leather
    avatarInitials: 'FA',
    phone: '+54 9 11 6677-8899',
    active: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'user-part-3',
    name: 'Santiago Madero',
    email: 'santiago@eldesayuno.com',
    role: 'owner',
    partName: 'Parte III (25% indiviso)',
    annualQuotaDays: 30,
    usedDays: 12,
    pendingDays: 0,
    color: '#275270', // Deep slate navy
    avatarInitials: 'SM',
    phone: '+54 9 11 7788-9900',
    active: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'user-part-4',
    name: 'Mariana De La Peña',
    email: 'mariana@eldesayuno.com',
    role: 'owner',
    partName: 'Parte IV (25% indiviso)',
    annualQuotaDays: 30,
    usedDays: 6,
    pendingDays: 0,
    color: '#6E456E', // Noble plum
    avatarInitials: 'MD',
    phone: '+54 9 11 8899-0011',
    active: true,
    createdAt: '2026-01-01',
  },
];

export const DEFAULT_SETTINGS: TrustSettings = {
  houseName: 'Estancia El Desayuno',
  location: 'Ruta Provincial 41, Km 82, San Antonio de Areco / Mercedes, Bs. As.',
  wifiSsid: 'ElDesayuno_Casa_5G',
  wifiPassword: 'sociedad_cuatro_partes',
  checkInTime: '14:00',
  checkOutTime: '11:00',
  autoCleaningBufferHours: 24,
  cancellationMinDays: 7,
  maxGuestsLimit: 12,
  emergencyAddress: 'Estancia El Desayuno, Acceso Principal Tranquera Verde, Coordenadas: -34.4820, -59.4120',
};

export const DEFAULT_BOOKINGS: Booking[] = [
  // Past booking
  {
    id: 'book-101',
    userId: 'user-part-1',
    userName: 'Gonzalo Estrada',
    userColor: '#264E36',
    partName: 'Parte I (25%)',
    checkInDate: '2026-08-10',
    checkOutDate: '2026-08-17',
    totalDays: 7,
    status: 'completed',
    guestsCount: 6,
    arrivalTime: '15:00',
    notes: 'Vacaciones de invierno familiares. Todo en perfecto orden.',
    cleaningBufferApplied: true,
    cleaningBufferEndDate: '2026-08-18',
    createdAt: '2026-07-01',
  },
  // Upcoming booking 1
  {
    id: 'book-102',
    userId: 'user-part-1',
    userName: 'Gonzalo Estrada',
    userColor: '#264E36',
    partName: 'Parte I (25%)',
    checkInDate: '2026-10-16',
    checkOutDate: '2026-10-23',
    totalDays: 7,
    status: 'confirmed',
    guestsCount: 8,
    arrivalTime: '14:00',
    notes: 'Festejo de cumpleaños familiar. Asado en quincho.',
    cleaningBufferApplied: true,
    cleaningBufferEndDate: '2026-10-24',
    createdAt: '2026-09-02',
  },
  // Upcoming booking 2
  {
    id: 'book-103',
    userId: 'user-part-2',
    userName: 'Florencia Albarracín',
    userColor: '#8A4A28',
    partName: 'Parte II (25%)',
    checkInDate: '2026-11-05',
    checkOutDate: '2026-11-13',
    totalDays: 8,
    status: 'confirmed',
    guestsCount: 5,
    arrivalTime: '16:00',
    notes: 'Fin de semana largo y semana de descanso.',
    cleaningBufferApplied: true,
    cleaningBufferEndDate: '2026-11-14',
    createdAt: '2026-09-15',
  },
  // Upcoming booking 3
  {
    id: 'book-104',
    userId: 'user-part-3',
    userName: 'Santiago Madero',
    userColor: '#275270',
    partName: 'Parte III (25%)',
    checkInDate: '2026-12-01',
    checkOutDate: '2026-12-08',
    totalDays: 7,
    status: 'confirmed',
    guestsCount: 10,
    arrivalTime: '14:30',
    notes: 'Fin de año anticipado con la familia Madero.',
    cleaningBufferApplied: true,
    cleaningBufferEndDate: '2026-12-09',
    createdAt: '2026-09-20',
  },
  // Upcoming booking 4
  {
    id: 'book-105',
    userId: 'user-part-4',
    userName: 'Mariana De La Peña',
    userColor: '#6E456E',
    partName: 'Parte IV (25%)',
    checkInDate: '2026-12-23',
    checkOutDate: '2026-12-29',
    totalDays: 6,
    status: 'confirmed',
    guestsCount: 9,
    arrivalTime: '12:00',
    notes: 'Festejo de Navidad en el campo.',
    cleaningBufferApplied: true,
    cleaningBufferEndDate: '2026-12-30',
    createdAt: '2026-09-22',
  },
];

export const DEFAULT_BLOCKS: DateBlock[] = [
  {
    id: 'block-201',
    startDate: '2026-10-26',
    endDate: '2026-10-29',
    totalDays: 4,
    reason: 'maintenance',
    title: 'Mantenimiento Preventivo de Caldera y Calefacción',
    notes: 'Service oficial Ariston y revisión de bombas presurizadoras de agua.',
    createdBy: 'Martín Benítez (Administrador)',
    createdAt: '2026-09-10',
  },
  {
    id: 'block-202',
    startDate: '2026-11-18',
    endDate: '2026-11-21',
    totalDays: 4,
    reason: 'seasonal_prep',
    title: 'Apertura de Temporada de Piscina y Deck',
    notes: 'Pintura caucho clorado, hidrolavado de solárium y tratamiento de pastizales.',
    createdBy: 'Martín Benítez (Administrador)',
    createdAt: '2026-09-12',
  },
];

export const DEFAULT_HOUSE_RULES: HouseRule[] = [
  {
    id: 'rule-1',
    category: 'horarios',
    title: 'Horarios de Entrada y Salida',
    description: 'Check-in a partir de las 14:00 hs. Check-out improrrogable a las 11:00 hs para permitir la sanitización y acondicionamiento del servicio de mucama para la siguiente familia.',
    iconName: 'Clock',
  },
  {
    id: 'rule-2',
    category: 'capacidad',
    title: 'Límite Máximo de Huéspedes',
    description: 'Capacidad máxima de pernocte: 12 personas distribuidas en las 4 suites principales. No está permitido armar carpas ni alojar grupos superiores sin autorización previa del Administrador.',
    iconName: 'Users',
  },
  {
    id: 'rule-3',
    category: 'mascotas',
    title: 'Política de Mascotas (Pet Friendly Responsable)',
    description: 'Se permite el ingreso de hasta 2 perros educados. Prohibido su ingreso a la piscina y subir a camas o sillones. Todo desecho debe ser recogido por el propietario antes del check-out.',
    iconName: 'Dog',
  },
  {
    id: 'rule-4',
    category: 'pileta',
    title: 'Seguridad en Piscina y Parque',
    description: 'El cerco perimetral de seguridad de la piscina debe permanecer cerrado con traba en todo momento. Menores siempre acompañados por un adulto responsable. La bomba cuenta con temporizador automático.',
    iconName: 'Waves',
  },
  {
    id: 'rule-5',
    category: 'quincho',
    title: 'Quincho, Parrilla y Horno a Leña',
    description: 'Cerrar llave de gas al finalizar. Nunca dejar brasas encendidas sin supervisión. La leña seca se encuentra en el cobertizo norte; reponer el stock usado informando al casero Don Raúl.',
    iconName: 'Flame',
  },
  {
    id: 'rule-6',
    category: 'convivencia',
    title: 'Ruidos Molestos y Convivencia',
    description: 'Horario de descanso nocturno de 23:00 a 08:30 hs. La música al aire libre debe mantenerse a volumen moderado para respetar la paz del campo y las propiedades linderas.',
    iconName: 'Volume2',
  },
];

export const DEFAULT_CONTACTS: UsefulContact[] = [
  {
    id: 'cnt-1',
    category: 'emergencia',
    name: 'Hospital Municipal San Antonio de Areco',
    role: 'Guardia Médica y Ambulancia',
    phone: '107 / (02326) 45-2012',
    availableHours: '24 horas / Los 365 días',
    notes: 'A 18 km de la tranquera principal.',
    isEmergency: true,
  },
  {
    id: 'cnt-2',
    category: 'emergencia',
    name: 'Bomberos Voluntarios',
    role: 'Emergencias de Incendio y Rescate',
    phone: '100 / (02326) 45-2222',
    availableHours: '24 horas',
    isEmergency: true,
  },
  {
    id: 'cnt-3',
    category: 'seguridad',
    name: 'Comisaría Rural y Patrulla',
    role: 'Seguridad Rural',
    phone: '911 / (02326) 45-3100',
    availableHours: '24 horas',
    isEmergency: true,
  },
  {
    id: 'cnt-4',
    category: 'personal',
    name: 'Don Raúl Gómez',
    role: 'Casero y Encargado de Mantenimiento',
    phone: '+54 9 2326 42-8811',
    availableHours: '07:00 a 19:00 hs (Urgencias 24h)',
    notes: 'Reside en la casa de caseros (ala sur). Llaves maestras, leña, tractor, caldera y bombas.',
  },
  {
    id: 'cnt-5',
    category: 'personal',
    name: 'Estela Morales',
    role: 'Encargada de Limpieza, Blancos y Cocina',
    phone: '+54 9 2326 49-5533',
    availableHours: 'Lunes a Sábado 08:00 a 16:00 hs',
    notes: 'Coordina cambio de sábanas, toallas y sanitización post estadía.',
  },
  {
    id: 'cnt-6',
    category: 'servicios',
    name: 'Martín Benítez',
    role: 'Fiduciario Administrador',
    phone: '+54 9 11 4455-8899',
    availableHours: '09:00 a 19:00 hs',
    notes: 'Consultas sobre cupos, reglamento y aprobaciones especiales.',
  },
  {
    id: 'cnt-7',
    category: 'servicios',
    name: 'Dr. Facundo Varela',
    role: 'Veterinaria de Campo Areco',
    phone: '+54 9 2326 43-1122',
    availableHours: 'Lunes a Domingo 08:00 a 20:00 hs',
    notes: 'Atención domiciliaria en caso de urgencia canina.',
  },
];

export const DEFAULT_DOCUMENTS: DocumentItem[] = [
  {
    id: 'doc-1',
    title: 'Contrato de Fideicomiso "El Desayuno Sociedad"',
    category: 'contrato',
    version: 'v3.2 Consolidada',
    date: '15/03/2024',
    fileSize: '3.4 MB',
    description: 'Instrumento constitutivo del Fideicomiso, derechos de los beneficiarios de las 4 partes indivisas, cuotas y cláusulas fiduciarias.',
  },
  {
    id: 'doc-2',
    title: 'Acta Notarial de Asignación de Cupos y Temporadas 2026',
    category: 'acta',
    version: 'Período 2026',
    date: '10/01/2026',
    fileSize: '1.2 MB',
    description: 'Resolución fiduciaria que distribuye 30 días anuales por copropietario y define el esquema equitativo de temporada alta.',
  },
  {
    id: 'doc-3',
    title: 'Reglamento Interno de Uso, Convivencia y Mantenimiento',
    category: 'reglamento',
    version: 'Edición 2025/2026',
    date: '01/11/2025',
    fileSize: '890 KB',
    description: 'Protocolo de cuidado edilicio, inventario de vajilla y blancos, pautas de pileta y penalidades por incumplimiento.',
  },
  {
    id: 'doc-4',
    title: 'Manual Operativo de Equipamiento del Campo',
    category: 'manual',
    version: 'v1.4 Actualizado',
    date: '05/02/2026',
    fileSize: '4.8 MB',
    description: 'Guía paso a paso: Grupo electrógeno diésel automático, sistema de filtrado de pileta, riego y caldera dual.',
  },
  {
    id: 'doc-5',
    title: 'Protocolo Sanitario y Check-list de Inventario de Salida',
    category: 'mantenimiento',
    version: 'v2.0',
    date: '15/05/2026',
    fileSize: '540 KB',
    description: 'Planilla de verificación que el casero y personal de limpieza revisan en cada recambio de turno.',
  },
];

export const DEFAULT_NOTIFICATIONS: NotificationPush[] = [
  {
    id: 'notif-1',
    title: 'Reserva Confirmada',
    body: 'Gonzalo Estrada confirmó su estadía del 16/10 al 23/10 (7 días). Cupo actualizado.',
    timestamp: '2026-09-02T14:30:00Z',
    read: false,
    type: 'booking_created',
    bookingId: 'book-102',
  },
  {
    id: 'notif-2',
    title: 'Mantenimiento Programado',
    body: 'Se programó bloqueo de caldera del 26/10 al 29/10 por servicio técnico oficial.',
    timestamp: '2026-09-10T10:15:00Z',
    read: true,
    type: 'block_added',
  },
  {
    id: 'notif-3',
    title: 'Reserva Confirmada',
    body: 'Florencia Albarracín reservó del 05/11 al 13/11 (8 días). Margen de limpieza aplicado.',
    timestamp: '2026-09-15T18:45:00Z',
    read: false,
    type: 'booking_created',
    bookingId: 'book-103',
  },
];

// Helper to calculate days used per user from active bookings
function recalculateUsersUsedDays(users: User[], bookings: Booking[]): User[] {
  return users.map((user) => {
    if (user.role === 'admin') return user;
    const userBookings = bookings.filter(
      (b) => b.userId === user.id && (b.status === 'confirmed' || b.status === 'completed')
    );
    const used = userBookings.reduce((sum, b) => sum + b.totalDays, 0);
    return {
      ...user,
      usedDays: used,
    };
  });
}

// Storage Class
class StorageService {
  private listeners: Array<() => void> = [];

  constructor() {
    this.init();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', () => {
        this.notify();
      });
    }
  }

  private init() {
    if (typeof window === 'undefined') return;

    if (!localStorage.getItem(USERS_KEY)) {
      localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
    }
    if (!localStorage.getItem(BOOKINGS_KEY)) {
      localStorage.setItem(BOOKINGS_KEY, JSON.stringify(DEFAULT_BOOKINGS));
    }
    if (!localStorage.getItem(BLOCKS_KEY)) {
      localStorage.setItem(BLOCKS_KEY, JSON.stringify(DEFAULT_BLOCKS));
    }
    if (!localStorage.getItem(SETTINGS_KEY)) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    }
    if (!localStorage.getItem(NOTIFICATIONS_KEY)) {
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(DEFAULT_NOTIFICATIONS));
    }
    // Recompute quotas on initial load
    const users = this.getUsers();
    const bookings = this.getBookings();
    const updatedUsers = recalculateUsersUsedDays(users, bookings);
    localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Current User / Auth
  public getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      // Refresh user data from users list
      const all = this.getUsers();
      return all.find((u) => u.id === parsed.id) || parsed;
    } catch {
      return null;
    }
  }

  public setCurrentUser(user: User | null) {
    if (typeof window === 'undefined') return;
    if (!user) {
      localStorage.removeItem(CURRENT_USER_KEY);
    } else {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    }
    this.notify();
  }

  public login(email: string, _password: string): { success: boolean; user?: User; error?: string } {
    const users = this.getUsers();
    const cleanEmail = email.trim().toLowerCase();
    const found = users.find((u) => u.email.toLowerCase() === cleanEmail && u.active);
    if (!found) {
      return { success: false, error: 'Credenciales inválidas o usuario no habilitado en el fideicomiso.' };
    }
    this.setCurrentUser(found);
    return { success: true, user: found };
  }

  public logout() {
    this.setCurrentUser(null);
  }

  // Users
  public getUsers(): User[] {
    if (typeof window === 'undefined') return DEFAULT_USERS;
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_USERS;
  }

  public saveUser(user: User) {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === user.id);
    let updated: User[];
    if (index >= 0) {
      updated = [...users];
      updated[index] = user;
    } else {
      updated = [...users, user];
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(updated));
    this.notify();
  }

  public deleteUser(userId: string) {
    const users = this.getUsers().filter((u) => u.id !== userId);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    this.notify();
  }

  // Bookings
  public getBookings(): Booking[] {
    if (typeof window === 'undefined') return DEFAULT_BOOKINGS;
    const raw = localStorage.getItem(BOOKINGS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_BOOKINGS;
  }

  public createBooking(booking: Omit<Booking, 'id' | 'createdAt'>): Booking {
    const bookings = this.getBookings();
    const newBooking: Booking = {
      ...booking,
      id: 'book-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    const updated = [newBooking, ...bookings];
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(updated));

    // Update user quota
    const users = this.getUsers();
    const recalculated = recalculateUsersUsedDays(users, updated);
    localStorage.setItem(USERS_KEY, JSON.stringify(recalculated));

    // Add push notification
    this.addNotification({
      title: 'Nueva Reserva Confirmada',
      body: `${newBooking.userName} reservó del ${newBooking.checkInDate} al ${newBooking.checkOutDate} (${newBooking.totalDays} días).`,
      type: 'booking_created',
      bookingId: newBooking.id,
    });

    this.notify();
    return newBooking;
  }

  public cancelBooking(bookingId: string, reason: string, cancelledByName: string) {
    const bookings = this.getBookings();
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const updated = bookings.map((b) => {
      if (b.id === bookingId) {
        return {
          ...b,
          status: 'cancelled' as BookingStatus,
          cancellationReason: reason,
          cancelledAt: new Date().toISOString(),
          cancelledBy: cancelledByName,
        };
      }
      return b;
    });

    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(updated));

    // Update quotas
    const users = this.getUsers();
    const recalculated = recalculateUsersUsedDays(users, updated);
    localStorage.setItem(USERS_KEY, JSON.stringify(recalculated));

    // Add push notification
    this.addNotification({
      title: 'Reserva Cancelada',
      body: `La reserva de ${booking.userName} (${booking.checkInDate} a ${booking.checkOutDate}) fue cancelada por ${cancelledByName}.`,
      type: 'booking_cancelled',
      bookingId: booking.id,
    });

    this.notify();
  }

  // Blocks
  public getBlocks(): DateBlock[] {
    if (typeof window === 'undefined') return DEFAULT_BLOCKS;
    const raw = localStorage.getItem(BLOCKS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_BLOCKS;
  }

  public createBlock(block: Omit<DateBlock, 'id' | 'createdAt'>): DateBlock {
    const blocks = this.getBlocks();
    const newBlock: DateBlock = {
      ...block,
      id: 'block-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    const updated = [newBlock, ...blocks];
    localStorage.setItem(BLOCKS_KEY, JSON.stringify(updated));

    this.addNotification({
      title: 'Nuevo Bloqueo de Fechas',
      body: `Se bloquearon fechas del ${newBlock.startDate} al ${newBlock.endDate}: ${newBlock.title}`,
      type: 'block_added',
    });

    this.notify();
    return newBlock;
  }

  public deleteBlock(blockId: string) {
    const blocks = this.getBlocks().filter((b) => b.id !== blockId);
    localStorage.setItem(BLOCKS_KEY, JSON.stringify(blocks));
    this.notify();
  }

  // Settings
  public getSettings(): TrustSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_SETTINGS;
  }

  public saveSettings(settings: TrustSettings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    this.notify();
  }

  // Notifications
  public getNotifications(): NotificationPush[] {
    if (typeof window === 'undefined') return DEFAULT_NOTIFICATIONS;
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_NOTIFICATIONS;
  }

  public addNotification(notif: Omit<NotificationPush, 'id' | 'timestamp' | 'read'>): NotificationPush {
    const list = this.getNotifications();
    const newNotif: NotificationPush = {
      ...notif,
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      read: false,
    };
    const updated = [newNotif, ...list].slice(0, 50); // Keep last 50
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    return newNotif;
  }

  public markNotificationAsRead(id: string) {
    const list = this.getNotifications();
    const updated = list.map((n) => (n.id === id ? { ...n, read: true } : n));
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    this.notify();
  }

  public markAllNotificationsAsRead() {
    const list = this.getNotifications();
    const updated = list.map((n) => ({ ...n, read: true }));
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    this.notify();
  }

  // Reset to default data if needed
  public resetToDefault() {
    localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(DEFAULT_BOOKINGS));
    localStorage.setItem(BLOCKS_KEY, JSON.stringify(DEFAULT_BLOCKS));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(DEFAULT_NOTIFICATIONS));
    const recalculated = recalculateUsersUsedDays(DEFAULT_USERS, DEFAULT_BOOKINGS);
    localStorage.setItem(USERS_KEY, JSON.stringify(recalculated));
    this.notify();
  }
}

export const storageService = new StorageService();
