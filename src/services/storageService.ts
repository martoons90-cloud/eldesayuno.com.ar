import {
  User,
  Booking,
  BookingStatus,
  DateBlock,
  HouseRule,
  UsefulContact,
  DocumentItem,
  TrustSettings,
  NotificationPush,
  InventoryItem,
  IncidentReport,
} from '../types';

const USERS_KEY = 'el_desayuno_users_v3';
const BOOKINGS_KEY = 'el_desayuno_bookings_v3';
const BLOCKS_KEY = 'el_desayuno_blocks_v3';
const SETTINGS_KEY = 'el_desayuno_settings_v3';
const RULES_KEY = 'el_desayuno_rules_v3';
const CONTACTS_KEY = 'el_desayuno_contacts_v3';
const DOCUMENTS_KEY = 'el_desayuno_documents_v3';
const INVENTORY_KEY = 'el_desayuno_inventory_v3';
const INCIDENTS_KEY = 'el_desayuno_incidents_v3';
const NOTIFICATIONS_KEY = 'el_desayuno_notifications_v3';
const CURRENT_USER_KEY = 'el_desayuno_current_user_v3';

export const DEFAULT_USERS: User[] = [
  // CABEZA 1 (Color Rojo)
  {
    id: 'user-c1-jose',
    name: 'José Casares',
    username: 'jose.casares',
    email: 'jose.casares@eldesayuno.com',
    role: 'owner',
    partName: 'Cabeza 1 (Parte I - 25%)',
    cabezaNumber: 1,
    annualQuotaDays: 30,
    usedDays: 14,
    pendingDays: 0,
    color: '#DC2626', // Rojo Cabeza 1
    avatarInitials: 'JC',
    phone: '+54 9 11 5566-7788',
    password: 'J8K2M9',
    active: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'user-c1-arturo',
    name: 'Arturo Casares',
    username: 'arturo.casares',
    email: 'arturo.casares@eldesayuno.com',
    role: 'owner',
    partName: 'Cabeza 1 (Parte I - 25%)',
    cabezaNumber: 1,
    annualQuotaDays: 30,
    usedDays: 0,
    pendingDays: 0,
    color: '#DC2626', // Rojo Cabeza 1
    avatarInitials: 'AC',
    phone: '+54 9 11 5566-7789',
    password: 'A4X7W2',
    active: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'user-c1-marcos',
    name: 'Marcos Montaldi',
    username: 'marcos.montaldi',
    email: 'marcos.montaldi@eldesayuno.com',
    role: 'owner',
    partName: 'Cabeza 1 (Parte I - 25%)',
    cabezaNumber: 1,
    annualQuotaDays: 30,
    usedDays: 0,
    pendingDays: 0,
    color: '#DC2626', // Rojo Cabeza 1
    avatarInitials: 'MM',
    phone: '+54 9 11 5566-7790',
    password: 'M9T3P8',
    active: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'user-c1-hugo',
    name: 'Hugo Tobchi',
    username: 'hugo.tobchi',
    email: 'hugo.tobchi@eldesayuno.com',
    role: 'owner',
    partName: 'Cabeza 1 (Parte I - 25%)',
    cabezaNumber: 1,
    annualQuotaDays: 30,
    usedDays: 0,
    pendingDays: 0,
    color: '#DC2626', // Rojo Cabeza 1
    avatarInitials: 'HT',
    phone: '+54 9 11 5566-7791',
    password: 'H6N8L4',
    active: true,
    createdAt: '2026-01-01',
  },

  // CABEZA 2 (Color Verde)
  {
    id: 'user-c2-alejandro',
    name: 'Alejandro Guerrero',
    username: 'alejandro.guerrero',
    email: 'alejandro.guerrero@eldesayuno.com',
    role: 'owner',
    partName: 'Cabeza 2 (Parte II - 25%)',
    cabezaNumber: 2,
    annualQuotaDays: 30,
    usedDays: 8,
    pendingDays: 0,
    color: '#16A34A', // Verde Cabeza 2
    avatarInitials: 'AG',
    phone: '+54 9 11 6677-8899',
    password: 'G3B9R7',
    active: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'user-c2-natalia',
    name: 'Natalia Guerrero',
    username: 'natalia.guerrero',
    email: 'natalia.guerrero@eldesayuno.com',
    role: 'owner',
    partName: 'Cabeza 2 (Parte II - 25%)',
    cabezaNumber: 2,
    annualQuotaDays: 30,
    usedDays: 0,
    pendingDays: 0,
    color: '#16A34A', // Verde Cabeza 2
    avatarInitials: 'NG',
    phone: '+54 9 11 6677-8800',
    password: 'N7W4K2',
    active: true,
    createdAt: '2026-01-01',
  },

  // CABEZA 3 (Color Azul)
  {
    id: 'user-c3-roberto',
    name: 'Roberto Condori',
    username: 'roberto.condori',
    email: 'roberto.condori@eldesayuno.com',
    role: 'owner',
    partName: 'Cabeza 3 (Parte III - 25%)',
    cabezaNumber: 3,
    annualQuotaDays: 30,
    usedDays: 7,
    pendingDays: 0,
    color: '#2563EB', // Azul Cabeza 3
    avatarInitials: 'RC',
    phone: '+54 9 11 7788-9900',
    password: 'R5D9V3',
    active: true,
    createdAt: '2026-01-01',
  },

  // CABEZA 4 (Color Amarillo / Ámbar Dorado)
  {
    id: 'user-c4-efrain',
    name: 'Efraín Rodríguez',
    username: 'efrain.rodriguez',
    email: 'efrain.rodriguez@eldesayuno.com',
    role: 'admin', // Administrador Actual
    partName: 'Cabeza 4 (Parte IV - 25%)',
    cabezaNumber: 4,
    annualQuotaDays: 30,
    usedDays: 6,
    pendingDays: 0,
    color: '#D97706', // Ámbar / Amarillo Cabeza 4
    avatarInitials: 'ER',
    phone: '+54 9 11 8899-0011',
    password: 'G93TO5',
    active: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'user-c4-rafael',
    name: 'Rafael Huespe',
    username: 'rafael.huespe',
    email: 'rafael.huespe@eldesayuno.com',
    role: 'owner',
    partName: 'Cabeza 4 (Parte IV - 25%)',
    cabezaNumber: 4,
    annualQuotaDays: 30,
    usedDays: 0,
    pendingDays: 0,
    color: '#D97706', // Ámbar / Amarillo Cabeza 4
    avatarInitials: 'RH',
    phone: '+54 9 11 8899-0012',
    password: 'H2X8Y5',
    active: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'user-c4-fairuz',
    name: 'Fairuz Kuncar',
    username: 'fairuz.kuncar',
    email: 'fairuz.kuncar@eldesayuno.com',
    role: 'owner',
    partName: 'Cabeza 4 (Parte IV - 25%)',
    cabezaNumber: 4,
    annualQuotaDays: 30,
    usedDays: 0,
    pendingDays: 0,
    color: '#D97706', // Ámbar / Amarillo Cabeza 4
    avatarInitials: 'FK',
    phone: '+54 9 11 8899-0013',
    password: 'F7M4Z9',
    active: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'user-c4-daniel',
    name: 'Daniel Pederiva',
    username: 'daniel.pederiva',
    email: 'daniel.pederiva@eldesayuno.com',
    role: 'owner',
    partName: 'Cabeza 4 (Parte IV - 25%)',
    cabezaNumber: 4,
    annualQuotaDays: 30,
    usedDays: 0,
    pendingDays: 0,
    color: '#D97706', // Ámbar / Amarillo Cabeza 4
    avatarInitials: 'DP',
    phone: '+54 9 11 8899-0014',
    password: 'D6P3Q8',
    active: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'user-c4-gonzalo',
    name: 'Gonzalo Lamas',
    username: 'gonzalo.lamas',
    email: 'gonzalo.lamas@eldesayuno.com',
    role: 'owner',
    partName: 'Cabeza 4 (Parte IV - 25%)',
    cabezaNumber: 4,
    annualQuotaDays: 30,
    usedDays: 0,
    pendingDays: 0,
    color: '#D97706', // Ámbar / Amarillo Cabeza 4
    avatarInitials: 'GL',
    phone: '+54 9 11 8899-0015',
    password: 'L9K5T2',
    active: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'user-c4-german',
    name: 'Germán Jiménez',
    username: 'german.jimenez',
    email: 'german.jimenez@eldesayuno.com',
    role: 'owner',
    partName: 'Cabeza 4 (Parte IV - 25%)',
    cabezaNumber: 4,
    annualQuotaDays: 30,
    usedDays: 0,
    pendingDays: 0,
    color: '#D97706', // Ámbar / Amarillo Cabeza 4
    avatarInitials: 'GJ',
    phone: '+54 9 11 8899-0016',
    password: 'J4V8X6',
    active: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'user-c4-gabriela',
    name: 'Gabriela Zadir',
    username: 'gabriela.zadir',
    email: 'gabriela.zadir@eldesayuno.com',
    role: 'owner',
    partName: 'Cabeza 4 (Parte IV - 25%)',
    cabezaNumber: 4,
    annualQuotaDays: 30,
    usedDays: 0,
    pendingDays: 0,
    color: '#D97706', // Ámbar / Amarillo Cabeza 4
    avatarInitials: 'GZ',
    phone: '+54 9 11 8899-0017',
    password: 'Z8W3H7',
    active: true,
    createdAt: '2026-01-01',
  },
  {
    id: 'user-c4-arturo',
    name: 'Arturo Tezanos Pinto',
    username: 'arturo.tezanos',
    email: 'arturo.tezanos@eldesayuno.com',
    role: 'owner',
    partName: 'Cabeza 4 (Parte IV - 25%)',
    cabezaNumber: 4,
    annualQuotaDays: 30,
    usedDays: 0,
    pendingDays: 0,
    color: '#D97706', // Ámbar / Amarillo Cabeza 4
    avatarInitials: 'AT',
    phone: '+54 9 11 8899-0018',
    password: 'T5B9N4',
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

export const DEFAULT_BOOKINGS: Booking[] = [];

export const DEFAULT_BLOCKS: DateBlock[] = [];

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

export const DEFAULT_INVENTORY: InventoryItem[] = [
  // Living & Galería
  {
    id: 'inv-101',
    name: 'Juego de Sillones Chesterfield Cuero Suela (3 cuerpos + 2 individuales)',
    category: 'living_galeria',
    locationRoom: 'Living Principal',
    quantity: 1,
    unit: 'juegos',
    condition: 'excelente',
    notes: 'Tratado con cera para cuero en agosto 2026. Ubicado frente a la chimenea.',
    lastCheckedDate: '2026-09-20',
  },
  {
    id: 'inv-102',
    name: 'Mesa de Campo Roble Macizo (3.20m x 1.10m) + 14 Sillas Torneadas',
    category: 'living_galeria',
    locationRoom: 'Comedor Principal',
    quantity: 1,
    unit: 'juegos',
    condition: 'excelente',
    notes: 'Capacidad para 14 comensales. Manteles y protectores en el aparador.',
    lastCheckedDate: '2026-09-20',
  },
  {
    id: 'inv-103',
    name: 'Smart TV Samsung 65" 4K QLED + Soporte Articulado',
    category: 'living_galeria',
    locationRoom: 'Living Principal',
    quantity: 1,
    unit: 'unidades',
    condition: 'excelente',
    notes: 'Con control remoto solar y cables HDMI. Conectado a Wi-Fi 5G.',
    lastCheckedDate: '2026-09-15',
  },
  // Cocina & Vajilla
  {
    id: 'inv-201',
    name: 'Vajilla Completa Porcelana Verbano Blanca (Platos playos, hondos, postre)',
    category: 'cocina_vajilla',
    locationRoom: 'Cocina & Alacena',
    quantity: 24,
    unit: 'juegos',
    condition: 'excelente',
    notes: '24 servicios completos. Inventariado sin faltantes.',
    lastCheckedDate: '2026-09-25',
  },
  {
    id: 'inv-202',
    name: 'Copas de Cristal de Bohemia (Vino Tinto, Blanco y Champagne)',
    category: 'cocina_vajilla',
    locationRoom: 'Cocina & Alacena',
    quantity: 36,
    unit: 'piezas',
    condition: 'bueno',
    notes: '12 copas de cada tipo. Guardadas en vitrina cerrada con traba.',
    lastCheckedDate: '2026-09-25',
  },
  {
    id: 'inv-203',
    name: 'Cafetera Nespresso Gran Lattissima + Espumador Aeroccino',
    category: 'cocina_vajilla',
    locationRoom: 'Cocina',
    quantity: 1,
    unit: 'unidades',
    condition: 'excelente',
    notes: 'Utilizar exclusivamente agua filtrada del dispenser.',
    lastCheckedDate: '2026-09-28',
  },
  {
    id: 'inv-204',
    name: 'Heladera Doble Puerta Acero Inoxidable con Dispenser de Hielo',
    category: 'cocina_vajilla',
    locationRoom: 'Cocina',
    quantity: 1,
    unit: 'unidades',
    condition: 'excelente',
    notes: 'Service oficial realizado en mayo 2026.',
    lastCheckedDate: '2026-09-20',
  },
  // Suites & Dormitorios
  {
    id: 'inv-301',
    name: 'Sommier King Size 2.00x2.00m con Colchón Resortes Pocket',
    category: 'suites_dormitorios',
    locationRoom: 'Suite Master 1 (Planta Alta)',
    quantity: 1,
    unit: 'unidades',
    condition: 'excelente',
    notes: 'Cubrecolchón impermeable colocado permanentemente.',
    lastCheckedDate: '2026-09-10',
  },
  {
    id: 'inv-302',
    name: 'Sommiers Queen Size 1.60x2.00m',
    category: 'suites_dormitorios',
    locationRoom: 'Suites 2, 3 y 4',
    quantity: 3,
    unit: 'unidades',
    condition: 'excelente',
    notes: 'Colchones de alta densidad con protectores.',
    lastCheckedDate: '2026-09-10',
  },
  // Quincho & Asador
  {
    id: 'inv-401',
    name: 'Parrilla Completa de Acero Inoxidable con Módulo Achuras y Fogonero',
    category: 'quincho_asador',
    locationRoom: 'Quincho',
    quantity: 1,
    unit: 'unidades',
    condition: 'excelente',
    notes: 'Incluye pala, atizador, brasero y cepillo de alambre.',
    lastCheckedDate: '2026-09-22',
  },
  {
    id: 'inv-402',
    name: 'Asador Criollo / Cruz de Hierro para Costillar + Disco de Arado Grande con Tapa',
    category: 'quincho_asador',
    locationRoom: 'Quincho / Fogonero Exterior',
    quantity: 2,
    unit: 'piezas',
    condition: 'bueno',
    notes: 'Curados con grasa. Limpiar y aceitar luego de cada uso.',
    lastCheckedDate: '2026-09-22',
  },
  {
    id: 'inv-403',
    name: 'Freezer Horizontal 400 Litros para Bebidas y Carnes',
    category: 'quincho_asador',
    locationRoom: 'Quincho',
    quantity: 1,
    unit: 'unidades',
    condition: 'excelente',
    notes: 'Enchufado al circuito con respaldo de grupo electrógeno.',
    lastCheckedDate: '2026-09-22',
  },
  // Piscina, Parque & Equipamiento
  {
    id: 'inv-501',
    name: 'Reposeras de Madera Teca con Colchonetas Náuticas Impermeables',
    category: 'piscina_parque',
    locationRoom: 'Solárium Piscina',
    quantity: 8,
    unit: 'unidades',
    condition: 'bueno',
    notes: 'Guardar colchonetas en el cobertizo si llueve.',
    lastCheckedDate: '2026-09-15',
  },
  {
    id: 'inv-502',
    name: 'Robot Limpiafondo Automático Zodiac para Piscina',
    category: 'piscina_parque',
    locationRoom: 'Caseta de Bombas Piscina',
    quantity: 1,
    unit: 'unidades',
    condition: 'excelente',
    notes: 'Programado para funcionar lunes y jueves de madrugada.',
    lastCheckedDate: '2026-09-28',
  },
  {
    id: 'inv-601',
    name: 'Grupo Electrógeno Diésel Cummins 22 kVA Automático',
    category: 'equipamiento_tecnico',
    locationRoom: 'Sala de Máquinas Exterior',
    quantity: 1,
    unit: 'unidades',
    condition: 'excelente',
    notes: 'Tanque lleno con 150 Lts gasoil grado 3. Service cada 100 hs.',
    lastCheckedDate: '2026-09-25',
  },
];

export const DEFAULT_INCIDENTS: IncidentReport[] = [];

export const DEFAULT_NOTIFICATIONS: NotificationPush[] = [];

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
        this.notify(false);
      });
      // Initial background hydration from Cloudflare D1
      this.hydrateFromD1Async();
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
    if (!localStorage.getItem(INVENTORY_KEY)) {
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(DEFAULT_INVENTORY));
    }
    if (!localStorage.getItem(INCIDENTS_KEY)) {
      localStorage.setItem(INCIDENTS_KEY, JSON.stringify(DEFAULT_INCIDENTS));
    }
    // Ensure Efraín Rodríguez has admin role
    let users = this.getUsers();
    const efrainIdx = users.findIndex((u) => u.id === 'user-c4-efrain' || u.name.includes('Efraín'));
    if (efrainIdx >= 0 && users[efrainIdx].role !== 'admin') {
      users[efrainIdx].role = 'admin';
    }
    const bookings = this.getBookings();
    const updatedUsers = recalculateUsersUsedDays(users, bookings);
    localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
  }

  // Asynchronous background hydration from live Cloudflare D1
  public async hydrateFromD1Async() {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/d1/sync-pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success && data.data) {
        if (data.data.users && data.data.users.length > 0) {
          localStorage.setItem(USERS_KEY, JSON.stringify(data.data.users));
        }
        if (data.data.bookings && data.data.bookings.length > 0) {
          localStorage.setItem(BOOKINGS_KEY, JSON.stringify(data.data.bookings));
        }
        if (data.data.blocks && data.data.blocks.length > 0) {
          localStorage.setItem(BLOCKS_KEY, JSON.stringify(data.data.blocks));
        }
        if (data.data.settings) {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.data.settings));
          if (data.data.settings.logoUrl) {
            localStorage.setItem('el_desayuno_custom_logo', data.data.settings.logoUrl);
          }
        }
        if (data.data.inventory && data.data.inventory.length > 0) {
          localStorage.setItem(INVENTORY_KEY, JSON.stringify(data.data.inventory));
        }
        if (data.data.incidents && data.data.incidents.length > 0) {
          localStorage.setItem(INCIDENTS_KEY, JSON.stringify(data.data.incidents));
        }
        this.notify(false);
      }
    } catch {
      // Offline fallback to local storage
    }
  }

  // Push local modifications automatically to Cloudflare D1
  private async syncToD1Async() {
    if (typeof window === 'undefined') return;
    try {
      await fetch('/api/d1/sync-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: this.getUsers(),
          bookings: this.getBookings(),
          blocks: this.getBlocks(),
          settings: this.getSettings(),
          inventory: this.getInventory(),
          incidents: this.getIncidents(),
          notifications: this.getNotifications(),
        }),
      });
    } catch {
      // Local fallback preserves state safely
    }
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify(syncD1: boolean = true) {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error(err);
      }
    });
    if (syncD1) {
      this.syncToD1Async();
    }
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

  public login(userInput: string, password: string): { success: boolean; user?: User; error?: string } {
    const users = this.getUsers();
    const cleanInput = userInput.trim().toLowerCase();
    const normalizeStr = (s: string) =>
      (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s\.\-_]+/g, '');

    const normInput = normalizeStr(cleanInput);

    const found = users.find((u) => {
      const uEmail = normalizeStr(u.email || '');
      const uUsername = normalizeStr(u.username || '');
      const uName = normalizeStr(u.name || '');
      const uId = normalizeStr(u.id || '');
      const uPass = normalizeStr(u.password || '');

      return (
        uEmail === normInput ||
        uUsername === normInput ||
        uName === normInput ||
        uId === normInput ||
        (normInput.length >= 3 && (uId.includes(normInput) || uName.includes(normInput) || uUsername.includes(normInput))) ||
        uPass === normInput
      );
    });

    if (!found) {
      return {
        success: false,
        error: 'Usuario no registrado en el Fideicomiso El Desayuno.',
      };
    }

    // Force active state if undefined or disabled by mistake
    found.active = true;

    // If password provided and not placeholder, verify against user password
    if (password && password !== 'demo' && password !== '••••••••••••' && found.password) {
      if (password.trim().toUpperCase() !== found.password.trim().toUpperCase()) {
        return {
          success: false,
          error: `Contraseña incorrecta para ${found.name}. Ingrese el código alfanumérico de 6 dígitos asignado (${found.password}).`,
        };
      }
    }

    // Always ensure Efrain retains admin role
    if (found.id === 'user-c4-efrain' || found.email === 'efrain.rodriguez@eldesayuno.com' || normalizeStr(found.name).includes('efrain')) {
      found.role = 'admin';
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
    if (!raw) return DEFAULT_USERS;
    try {
      const parsed: User[] = JSON.parse(raw);
      // Ensure all DEFAULT_USERS exist and are active in parsed list
      const merged = DEFAULT_USERS.map((defUser) => {
        const found = parsed.find((p) => p.id === defUser.id || p.email === defUser.email);
        if (!found) return defUser;
        return {
          ...defUser,
          ...found,
          active: true,
          role: defUser.id === 'user-c4-efrain' ? ('admin' as const) : (found.role || defUser.role),
        };
      });
      return merged;
    } catch {
      return DEFAULT_USERS;
    }
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

  // Transfer Administrator role to another user
  public transferAdminRole(newAdminUserId: string, currentAdminUserId?: string): { success: boolean; message: string } {
    const users = this.getUsers();
    const newAdmin = users.find((u) => u.id === newAdminUserId);
    if (!newAdmin) {
      return { success: false, message: 'Usuario destinatario no encontrado.' };
    }

    const updated = users.map((u) => {
      if (u.id === newAdminUserId) {
        return { ...u, role: 'admin' as const };
      }
      if (u.role === 'admin' || (currentAdminUserId && u.id === currentAdminUserId)) {
        return { ...u, role: 'owner' as const };
      }
      return u;
    });

    localStorage.setItem(USERS_KEY, JSON.stringify(updated));

    // Update active currentUser session if needed
    const current = this.getCurrentUser();
    if (current) {
      const refreshed = updated.find((u) => u.id === current.id);
      if (refreshed) {
        this.setCurrentUser(refreshed);
      }
    }

    this.addNotification({
      title: 'Traspaso de Poder de Administración',
      body: `${newAdmin.name} ha asumido como Administrador de la sociedad.`,
      type: 'system',
    });

    this.notify();
    return {
      success: true,
      message: `Poder de administración transferido exitosamente a ${newAdmin.name}.`,
    };
  }

  // Update 6-character alphanumeric password for a user
  public updateUserPassword(userId: string, newPasswordRaw: string): { success: boolean; message: string } {
    const code = newPasswordRaw.trim().toUpperCase();
    if (code.length !== 6) {
      return {
        success: false,
        message: 'La contraseña debe ser un código alfanumérico de exactamente 6 caracteres.',
      };
    }
    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, message: 'Usuario no encontrado.' };
    }

    const updated = users.map((u) => (u.id === userId ? { ...u, password: code } : u));
    localStorage.setItem(USERS_KEY, JSON.stringify(updated));

    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      this.setCurrentUser({ ...current, password: code });
    }

    this.notify();
    return {
      success: true,
      message: `Contraseña de ${user.name} actualizada correctamente a "${code}".`,
    };
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

  // Rules
  public getRules(): HouseRule[] {
    if (typeof window === 'undefined') return DEFAULT_HOUSE_RULES;
    const raw = localStorage.getItem(RULES_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_HOUSE_RULES;
  }

  public saveRule(rule: HouseRule) {
    const list = this.getRules();
    const exists = list.some((r) => r.id === rule.id);
    const updated = exists ? list.map((r) => (r.id === rule.id ? rule : r)) : [...list, rule];
    localStorage.setItem(RULES_KEY, JSON.stringify(updated));
    this.notify();
  }

  public deleteRule(ruleId: string) {
    const list = this.getRules().filter((r) => r.id !== ruleId);
    localStorage.setItem(RULES_KEY, JSON.stringify(list));
    this.notify();
  }

  // Contacts
  public getContacts(): UsefulContact[] {
    if (typeof window === 'undefined') return DEFAULT_CONTACTS;
    const raw = localStorage.getItem(CONTACTS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_CONTACTS;
  }

  public saveContact(contact: UsefulContact) {
    const list = this.getContacts();
    const exists = list.some((c) => c.id === contact.id);
    const updated = exists ? list.map((c) => (c.id === contact.id ? contact : c)) : [...list, contact];
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(updated));
    this.notify();
  }

  public deleteContact(contactId: string) {
    const list = this.getContacts().filter((c) => c.id !== contactId);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(list));
    this.notify();
  }

  // Documents
  public getDocuments(): DocumentItem[] {
    if (typeof window === 'undefined') return DEFAULT_DOCUMENTS;
    const raw = localStorage.getItem(DOCUMENTS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_DOCUMENTS;
  }

  public saveDocument(doc: DocumentItem) {
    const list = this.getDocuments();
    const exists = list.some((d) => d.id === doc.id);
    const updated = exists ? list.map((d) => (d.id === doc.id ? doc : d)) : [...list, doc];
    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(updated));
    this.notify();
  }

  public deleteDocument(docId: string) {
    const list = this.getDocuments().filter((d) => d.id !== docId);
    localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(list));
    this.notify();
  }

  // Inventory & Stock of the Estate
  public getInventory(): InventoryItem[] {
    if (typeof window === 'undefined') return DEFAULT_INVENTORY;
    const raw = localStorage.getItem(INVENTORY_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_INVENTORY;
  }

  public saveInventoryItem(item: InventoryItem) {
    const list = this.getInventory();
    const exists = list.some((i) => i.id === item.id);
    const updated = exists ? list.map((i) => (i.id === item.id ? item : i)) : [item, ...list];
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(updated));
    this.notify();
  }

  public deleteInventoryItem(itemId: string) {
    const list = this.getInventory().filter((i) => i.id !== itemId);
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(list));
    this.notify();
  }

  // Incident Reports (Daños, novedades, roturas con fotos)
  public getIncidents(): IncidentReport[] {
    if (typeof window === 'undefined') return DEFAULT_INCIDENTS;
    const raw = localStorage.getItem(INCIDENTS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_INCIDENTS;
  }

  public createIncident(incident: Omit<IncidentReport, 'id' | 'createdAt' | 'status'>): IncidentReport {
    const list = this.getIncidents();
    const newInc: IncidentReport = {
      ...incident,
      id: 'inc-' + Date.now(),
      createdAt: new Date().toISOString(),
      status: 'pendiente',
    };
    const updated = [newInc, ...list];
    localStorage.setItem(INCIDENTS_KEY, JSON.stringify(updated));

    // Send push notification to administrators and users
    this.addNotification({
      title: `Nuevo Reporte: ${newInc.title}`,
      body: `${newInc.reporterName} reportó una novedad en "${newInc.location}": ${newInc.description}`,
      type: 'incident_reported',
      incidentId: newInc.id,
    });

    this.notify();
    return newInc;
  }

  public updateIncident(incident: IncidentReport) {
    const list = this.getIncidents();
    const updated = list.map((i) => (i.id === incident.id ? incident : i));
    localStorage.setItem(INCIDENTS_KEY, JSON.stringify(updated));

    if (incident.status === 'resuelto') {
      this.addNotification({
        title: `Novedad Resuelta: ${incident.title}`,
        body: `El incidente reportado en "${incident.location}" fue marcado como resuelto.`,
        type: 'incident_resolved',
        incidentId: incident.id,
      });
    }

    this.notify();
  }

  public deleteIncident(incidentId: string) {
    const list = this.getIncidents().filter((i) => i.id !== incidentId);
    localStorage.setItem(INCIDENTS_KEY, JSON.stringify(list));
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

  // Apply complete dataset pulled from Cloudflare D1
  public applyRemoteD1Data(data: {
    users?: User[];
    bookings?: Booking[];
    blocks?: DateBlock[];
    settings?: TrustSettings;
    notifications?: NotificationPush[];
  }) {
    if (data.users && data.users.length > 0) {
      localStorage.setItem(USERS_KEY, JSON.stringify(data.users));
    }
    if (data.bookings) {
      localStorage.setItem(BOOKINGS_KEY, JSON.stringify(data.bookings));
    }
    if (data.blocks) {
      localStorage.setItem(BLOCKS_KEY, JSON.stringify(data.blocks));
    }
    if (data.settings) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
      if (data.settings.logoUrl) {
        localStorage.setItem('el_desayuno_custom_logo', data.settings.logoUrl);
      }
    }
    if (data.notifications && data.notifications.length > 0) {
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(data.notifications));
    }
    this.notify();
  }

  // Get complete package of local data for D1 push & backup
  public getAllDataPackage() {
    return {
      users: this.getUsers(),
      bookings: this.getBookings(),
      blocks: this.getBlocks(),
      settings: this.getSettings(),
      rules: this.getRules(),
      contacts: this.getContacts(),
      documents: this.getDocuments(),
      inventory: this.getInventory(),
      incidents: this.getIncidents(),
      notifications: this.getNotifications(),
      exportedAt: new Date().toISOString(),
      version: '2.0-eldesayuno',
    };
  }

  public exportBackupJSON(): string {
    const pkg = this.getAllDataPackage();
    return JSON.stringify(pkg, null, 2);
  }

  public importBackupJSON(jsonStr: string): { success: boolean; message: string } {
    try {
      const data = JSON.parse(jsonStr);
      if (Array.isArray(data.users)) localStorage.setItem(USERS_KEY, JSON.stringify(data.users));
      if (Array.isArray(data.bookings)) localStorage.setItem(BOOKINGS_KEY, JSON.stringify(data.bookings));
      if (Array.isArray(data.blocks)) localStorage.setItem(BLOCKS_KEY, JSON.stringify(data.blocks));
      if (data.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
      if (Array.isArray(data.rules)) localStorage.setItem(RULES_KEY, JSON.stringify(data.rules));
      if (Array.isArray(data.contacts)) localStorage.setItem(CONTACTS_KEY, JSON.stringify(data.contacts));
      if (Array.isArray(data.documents)) localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(data.documents));
      if (Array.isArray(data.inventory)) localStorage.setItem(INVENTORY_KEY, JSON.stringify(data.inventory));
      if (Array.isArray(data.incidents)) localStorage.setItem(INCIDENTS_KEY, JSON.stringify(data.incidents));
      if (Array.isArray(data.notifications)) localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(data.notifications));

      this.notify();
      return { success: true, message: 'Copia de respaldo restaurada exitosamente.' };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'El archivo JSON de respaldo no es válido.',
      };
    }
  }

  // Reset to default data if needed
  public resetToDefault() {
    localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(DEFAULT_BOOKINGS));
    localStorage.setItem(BLOCKS_KEY, JSON.stringify(DEFAULT_BLOCKS));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(DEFAULT_NOTIFICATIONS));
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(DEFAULT_INVENTORY));
    localStorage.setItem(INCIDENTS_KEY, JSON.stringify(DEFAULT_INCIDENTS));
    const recalculated = recalculateUsersUsedDays(DEFAULT_USERS, DEFAULT_BOOKINGS);
    localStorage.setItem(USERS_KEY, JSON.stringify(recalculated));
    this.notify();
  }
}

export const storageService = new StorageService();
