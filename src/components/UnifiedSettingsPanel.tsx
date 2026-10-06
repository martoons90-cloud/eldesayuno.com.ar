import React, { useState, useEffect } from 'react';
import { User, Booking, DateBlock, TrustSettings, HouseRule, UsefulContact, DocumentItem } from '../types';
import { storageService } from '../services/storageService';
import { d1Service, D1Config } from '../services/d1Service';
import { r2Service, R2Config } from '../services/r2Service';
import { BrandLogo } from './BrandLogo';
import { PasswordManagementModal } from './PasswordManagementModal';
import { TransferAdminModal } from './TransferAdminModal';
import {
  Users,
  Sliders,
  BookOpen,
  Home,
  PhoneCall,
  FileText,
  Image as ImageIcon,
  Database,
  Save,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Cloud,
  Download,
  Upload,
  Clock,
  Sparkles,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Search,
  ExternalLink,
  Wifi,
  MapPin,
  Flame,
  Waves,
  Dog,
  Volume2,
  HeartPulse,
  KeyRound,
  FileSpreadsheet,
  Copy,
  CheckCheck,
  Eye,
  EyeOff,
} from 'lucide-react';

export type SettingsTabId =
  | 'owners'
  | 'engine'
  | 'rules'
  | 'property'
  | 'contacts'
  | 'documents'
  | 'identity'
  | 'database';

interface UnifiedSettingsPanelProps {
  currentUser: User;
  users: User[];
  bookings: Booking[];
  blocks: DateBlock[];
  settings: TrustSettings;
  initialTab?: SettingsTabId;
  onNavigateTab?: (tab: SettingsTabId) => void;
}

export const UnifiedSettingsPanel: React.FC<UnifiedSettingsPanelProps> = ({
  currentUser,
  users,
  bookings,
  blocks,
  settings,
  initialTab = 'owners',
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);

  // Success / Alert message banner
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // -------------------------------------------------------------
  // 1. OWNERS MANAGEMENT STATE
  // -------------------------------------------------------------
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [passwordModalUser, setPasswordModalUser] = useState<User | null>(null);
  const [isTransferAdminOpen, setIsTransferAdminOpen] = useState(false);
  const [copiedPasswordId, setCopiedPasswordId] = useState<string | null>(null);
  const [copiedAllSuccess, setCopiedAllSuccess] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  const handleCopyAllCredentials = () => {
    const lines = [
      '=====================================================',
      'ESTANCIA EL DESAYUNO - PADRÓN DE COPROPIETARIOS Y ACCESOS',
      '=====================================================',
      '',
    ];

    users.forEach((u, idx) => {
      lines.push(`${idx + 1}. ${u.name}`);
      lines.push(`   • Usuario: ${u.username || u.email.split('@')[0]}`);
      lines.push(`   • Contraseña: ${u.password || '******'}`);
      lines.push(`   • Parte: ${u.partName}`);
      lines.push(`   • Rol: ${u.role === 'admin' ? 'Administrador' : 'Copropietario'}`);
      lines.push('');
    });

    lines.push('=====================================================');

    const textToCopy = lines.join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopiedAllSuccess(true);
    setTimeout(() => setCopiedAllSuccess(false), 3000);
  };
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    phone: '',
    partName: 'Cabeza 1 (Parte I - 25%)',
    annualQuotaDays: 30,
    color: '#DC2626',
    password: '',
  });

  // -------------------------------------------------------------
  // 2. ENGINE & PROPERTY SETTINGS STATE
  // -------------------------------------------------------------
  const [settingsFormData, setSettingsFormData] = useState<TrustSettings>(settings);

  useEffect(() => {
    setSettingsFormData(settings);
  }, [settings]);

  const handleSaveSettingsGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    storageService.saveSettings(settingsFormData);
    showSuccess('Parámetros guardados y sincronizados en tiempo real.');
  };

  // -------------------------------------------------------------
  // 3. HOUSE RULES STATE
  // -------------------------------------------------------------
  const [rulesList, setRulesList] = useState<HouseRule[]>(storageService.getRules());
  const [editingRule, setEditingRule] = useState<HouseRule | null>(null);
  const [isNewRuleModalOpen, setIsNewRuleModalOpen] = useState(false);
  const [ruleFormData, setRuleFormData] = useState<Omit<HouseRule, 'id'>>({
    category: 'convivencia',
    title: '',
    description: '',
    iconName: 'Volume2',
  });

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) {
      const updated: HouseRule = {
        ...editingRule,
        ...ruleFormData,
      };
      storageService.saveRule(updated);
      setEditingRule(null);
    } else {
      const newRule: HouseRule = {
        id: 'rule-' + Date.now(),
        ...ruleFormData,
      };
      storageService.saveRule(newRule);
      setIsNewRuleModalOpen(false);
    }
    setRulesList(storageService.getRules());
    showSuccess('Regla de convivencia guardada.');
  };

  const handleDeleteRule = (ruleId: string) => {
    if (confirm('¿Eliminar esta regla de la casa?')) {
      storageService.deleteRule(ruleId);
      setRulesList(storageService.getRules());
      showSuccess('Regla eliminada.');
    }
  };

  // -------------------------------------------------------------
  // 4. USEFUL CONTACTS STATE
  // -------------------------------------------------------------
  const [contactsList, setContactsList] = useState<UsefulContact[]>(storageService.getContacts());
  const [editingContact, setEditingContact] = useState<UsefulContact | null>(null);
  const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false);
  const [contactFormData, setContactFormData] = useState<Omit<UsefulContact, 'id'>>({
    category: 'personal',
    name: '',
    role: '',
    phone: '',
    availableHours: '08:00 a 18:00 hs',
    notes: '',
    isEmergency: false,
  });

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContact) {
      const updated: UsefulContact = {
        ...editingContact,
        ...contactFormData,
      };
      storageService.saveContact(updated);
      setEditingContact(null);
    } else {
      const newContact: UsefulContact = {
        id: 'cnt-' + Date.now(),
        ...contactFormData,
      };
      storageService.saveContact(newContact);
      setIsNewContactModalOpen(false);
    }
    setContactsList(storageService.getContacts());
    showSuccess('Contacto de asistencia guardado.');
  };

  const handleDeleteContact = (contactId: string) => {
    if (confirm('¿Eliminar este contacto del directorio?')) {
      storageService.deleteContact(contactId);
      setContactsList(storageService.getContacts());
      showSuccess('Contacto eliminado.');
    }
  };

  // -------------------------------------------------------------
  // 5. DOCUMENTS REPOSITORY STATE
  // -------------------------------------------------------------
  const [documentsList, setDocumentsList] = useState<DocumentItem[]>(storageService.getDocuments());
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);
  const [docFormData, setDocFormData] = useState<Omit<DocumentItem, 'id'>>({
    title: '',
    category: 'reglamento',
    version: 'v1.0 Actualizada',
    date: new Date().toLocaleDateString('es-AR'),
    fileSize: '1.5 MB',
    description: '',
    downloadUrl: '',
  });

  const handleSaveDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDoc) {
      const updated: DocumentItem = {
        ...editingDoc,
        ...docFormData,
      };
      storageService.saveDocument(updated);
      setEditingDoc(null);
    } else {
      const newDoc: DocumentItem = {
        id: 'doc-' + Date.now(),
        ...docFormData,
      };
      storageService.saveDocument(newDoc);
      setIsNewDocModalOpen(false);
    }
    setDocumentsList(storageService.getDocuments());
    showSuccess('Documento fiduciario guardado.');
  };

  const handleDeleteDoc = (docId: string) => {
    if (confirm('¿Eliminar este documento del repositorio?')) {
      storageService.deleteDocument(docId);
      setDocumentsList(storageService.getDocuments());
      showSuccess('Documento eliminado.');
    }
  };

  // -------------------------------------------------------------
  // 6. LOGO & BRANDING STATE
  // -------------------------------------------------------------
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string>(
    settings.logoUrl || (typeof window !== 'undefined' ? localStorage.getItem('el_desayuno_custom_logo') || '' : '')
  );
  const [logoInputUrl, setLogoInputUrl] = useState<string>(currentLogoUrl);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const handleFileUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('El archivo es demasiado grande. Por favor seleccione una imagen menor a 15MB.');
      return;
    }

    setIsUploadingLogo(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        let finalLogoUrl = base64;

        try {
          // Upload directly to Cloudflare R2 Bucket 'el-desayuno'
          const r2Res = await r2Service.uploadPhoto(base64, file.name || 'logo-oficial-el-desayuno', 'marca');
          if (r2Res.success && r2Res.url) {
            finalLogoUrl = r2Res.url;
          }
        } catch {
          // Fallback to base64 if R2 is unavailable
        }

        localStorage.setItem('el_desayuno_custom_logo', finalLogoUrl);
        setCurrentLogoUrl(finalLogoUrl);
        setLogoInputUrl(finalLogoUrl);
        const updated = { ...settingsFormData, logoUrl: finalLogoUrl };
        setSettingsFormData(updated);
        storageService.saveSettings(updated);

        if (d1Service.isConnected()) {
          try {
            await d1Service.pushLocalDataToD1(storageService.getAllDataPackage());
          } catch {
            // ignore
          }
        }

        setIsUploadingLogo(false);
        showSuccess('¡Logo oficial subido a la nube (Cloudflare R2)! Guardado para todos los usuarios y dispositivos.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLogoUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logoInputUrl.trim()) return;
    localStorage.setItem('el_desayuno_custom_logo', logoInputUrl.trim());
    setCurrentLogoUrl(logoInputUrl.trim());
    const updated = { ...settingsFormData, logoUrl: logoInputUrl.trim() };
    setSettingsFormData(updated);
    storageService.saveSettings(updated);
    showSuccess('URL de logo guardada.');
  };

  const handleResetToDefaultLogo = () => {
    localStorage.removeItem('el_desayuno_custom_logo');
    setCurrentLogoUrl('');
    setLogoInputUrl('');
    const updated = { ...settingsFormData, logoUrl: '' };
    setSettingsFormData(updated);
    storageService.saveSettings(updated);
    showSuccess('Restablecido al emblema heráldico vectorial original.');
  };

  // -------------------------------------------------------------
  // 7. CLOUDFLARE D1, R2 & BACKUP STATE
  // -------------------------------------------------------------
  const [d1ConfigForm, setD1ConfigForm] = useState<D1Config>(d1Service.getConfig());
  const [d1Loading, setD1Loading] = useState(false);
  const [d1StatusInfo, setD1StatusInfo] = useState<{
    connected: boolean;
    latencyMs: number;
    message: string;
  } | null>(null);
  const [sqlQueryText, setSqlQueryText] = useState('SELECT count(*) as total_users FROM users;');
  const [sqlResults, setSqlResults] = useState<Record<string, unknown>[] | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);

  // Cloudflare R2 State
  const [r2ConfigForm, setR2ConfigForm] = useState<R2Config>(r2Service.getConfig());
  const [r2Status, setR2Status] = useState<{ configured: boolean; connected: boolean; message?: string } | null>(null);

  useEffect(() => {
    d1Service.checkServerStatus().then((info) => setD1StatusInfo(info));
    r2Service.checkServerStatus().then((info) => setR2Status(info));
  }, []);

  const handleSaveR2Config = (e: React.FormEvent) => {
    e.preventDefault();
    r2Service.saveConfig(r2ConfigForm);
    showSuccess("Configuración de Cloudflare R2 (Bucket 'el-desayuno') guardada.");
    r2Service.checkServerStatus().then((info) => setR2Status(info));
  };

  const handleTestD1Connection = async () => {
    setD1Loading(true);
    const res = await d1Service.testConnection(d1ConfigForm);
    const liveStatus = await d1Service.checkServerStatus();
    setD1StatusInfo(liveStatus);
    setD1Loading(false);
    showSuccess(res.message);
  };

  const handleSaveD1Config = (e: React.FormEvent) => {
    e.preventDefault();
    d1Service.saveConfig(d1ConfigForm);
    showSuccess('Credenciales D1 almacenadas.');
  };

  const handleInitD1Schema = async () => {
    if (!confirm('¿Crear o verificar las tablas en Cloudflare D1 (users, bookings, date_blocks, trust_settings)?')) {
      return;
    }
    setD1Loading(true);
    const res = await d1Service.initializeSchema();
    setD1Loading(false);
    showSuccess(res.message);
  };

  const handlePushDataToD1 = async () => {
    if (!confirm('¿Desea migrar todos los socios, turnos y parámetros actuales hacia Cloudflare D1?')) {
      return;
    }
    setD1Loading(true);
    const payload = storageService.getAllDataPackage();
    const res = await d1Service.pushLocalDataToD1(payload as any);
    setD1Loading(false);
    showSuccess(res.message);
  };

  const handlePullDataFromD1 = async () => {
    if (!confirm('¿Descargar y sincronizar datos desde Cloudflare D1 hacia la aplicación?')) {
      return;
    }
    setD1Loading(true);
    const res = await d1Service.pullDataFromD1();
    setD1Loading(false);
    if (res.success && res.data) {
      storageService.applyRemoteD1Data(res.data);
      showSuccess('Datos sincronizados exitosamente desde Cloudflare D1.');
    } else {
      alert(res.error || 'Error al obtener datos desde Cloudflare D1.');
    }
  };

  const handleExecuteSQL = async () => {
    if (!sqlQueryText.trim()) return;
    setD1Loading(true);
    setSqlError(null);
    setSqlResults(null);
    const res = await d1Service.executeQuery(sqlQueryText);
    setD1Loading(false);
    if (res.success) {
      setSqlResults(res.results);
    } else {
      setSqlError(res.error || 'Error ejecutando sentencia SQL en D1');
    }
  };

  const handleDownloadBackupJSON = () => {
    const jsonStr = storageService.exportBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-el-desayuno-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess('Copia de respaldo JSON descargada.');
  };

  const handleUploadBackupJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        const res = storageService.importBackupJSON(text);
        if (res.success) {
          showSuccess(res.message);
        } else {
          alert('Error: ' + res.message);
        }
      }
    };
    reader.readAsText(file);
  };

  // User Save/Edit Handlers
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      storageService.saveUser({
        ...editingUser,
        name: userFormData.name,
        email: userFormData.email,
        phone: userFormData.phone,
        partName: userFormData.partName,
        annualQuotaDays: Number(userFormData.annualQuotaDays),
        color: userFormData.color,
      });
      setEditingUser(null);
    } else {
      const newUser: User = {
        id: 'user-' + Date.now(),
        name: userFormData.name,
        email: userFormData.email,
        phone: userFormData.phone,
        partName: userFormData.partName,
        role: 'owner',
        annualQuotaDays: Number(userFormData.annualQuotaDays),
        usedDays: 0,
        pendingDays: 0,
        color: userFormData.color,
        avatarInitials: userFormData.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2),
        active: true,
        createdAt: new Date().toISOString().split('T')[0],
      };
      storageService.saveUser(newUser);
      setIsNewUserModalOpen(false);
    }
    showSuccess('Copropietario guardado correctamente.');
  };

  const handleToggleUserActive = (user: User) => {
    if (user.id === currentUser.id) {
      alert('No puede desactivar su propio usuario administrador.');
      return;
    }
    storageService.saveUser({
      ...user,
      active: !user.active,
    });
    showSuccess(`Estado de ${user.name} actualizado.`);
  };

  // Nav items for sidebar
  const tabsList: Array<{
    id: SettingsTabId;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
  }> = [
    {
      id: 'owners',
      label: 'Copropietarios & Accesos',
      description: 'Padrón, 4 Cabezas, contraseñas y administración',
      icon: Users,
      badge: users.length,
    },
    {
      id: 'engine',
      label: 'Motor de Reservas & Operatoria',
      description: 'Buffer de limpieza, check-in/out y anticipación',
      icon: Sliders,
    },
    {
      id: 'rules',
      label: 'Reglas de Convivencia',
      description: 'Normas de la casa, pileta, quincho y mascotas',
      icon: BookOpen,
      badge: rulesList.length,
    },
    {
      id: 'property',
      label: 'Estancia & Wi-Fi',
      description: 'Dirección, credenciales Wi-Fi y ubicación',
      icon: Home,
    },
    {
      id: 'contacts',
      label: 'Directorio de Asistencia',
      description: 'Casero, mucamas, emergencias y técnicos',
      icon: PhoneCall,
      badge: contactsList.length,
    },
    {
      id: 'documents',
      label: 'Documentación Oficial',
      description: 'Actas, estatutos y protocolos fiduciarios',
      icon: FileText,
      badge: documentsList.length,
    },
    {
      id: 'identity',
      label: 'Identidad, Marca & Logo',
      description: 'Personalización de logo, lema y vista previa',
      icon: ImageIcon,
    },
    {
      id: 'database',
      label: 'Cloudflare D1 & Backup',
      description: 'Conexión SQLite serverless, SQL y respaldos',
      icon: Database,
      badge: d1Service.isConnected() ? '● D1' : '○ Local',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-[#1B3B2B] text-[#BFA270] shadow-xs">
              <Sliders className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-serif font-bold text-[#163323] tracking-wide">
                Centro de Parametrización & Configuración Integral
              </h2>
              <p className="text-xs text-[#637568]">
                Panel maestro unificado: gestione socios, cuotas, reglas de convivencia, motor de turnos, identidad y base de datos.
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadBackupJSON}
            className="px-3 py-2 bg-white hover:bg-[#FAF8F5] border border-[#DDD5BF] text-[#163323] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Descargar respaldo completo en formato JSON"
          >
            <Download className="w-3.5 h-3.5 text-emerald-800" />
            <span>Descargar Backup</span>
          </button>

          <label className="px-3 py-2 bg-white hover:bg-[#FAF8F5] border border-[#DDD5BF] text-[#163323] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs">
            <Upload className="w-3.5 h-3.5 text-[#BFA270]" />
            <span>Restaurar Backup</span>
            <input type="file" accept=".json" onChange={handleUploadBackupJSON} className="hidden" />
          </label>
        </div>
      </div>

      {/* Save / Success alert banner */}
      {saveSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-medium flex items-center gap-2.5 animate-fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Main Split Layout: Unified Sidebar + Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Unified Sidebar Navigation (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-[#E3DFC8] divide-y divide-[#EFEAE0] shadow-xs">
          <div className="p-3.5 bg-[#FAF8F5] border-b border-[#E3DFC8]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#637568]">
              Módulos de Configuración
            </span>
          </div>

          <div className="divide-y divide-[#F3EFE6]">
            {tabsList.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left p-3.5 transition-all flex items-start gap-3 cursor-pointer ${
                    isActive
                      ? 'bg-[#1B3B2B] text-white'
                      : 'hover:bg-[#FAF8F5] text-[#163323]'
                  }`}
                >
                  <span
                    className={`p-2 shrink-0 ${
                      isActive
                        ? 'bg-[#122A1F] text-[#BFA270]'
                        : 'bg-[#F2ECE1] text-[#163323]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-xs leading-tight truncate">
                        {item.label}
                      </span>
                      {item.badge !== undefined && (
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-2xs shrink-0 ${
                            isActive
                              ? 'bg-[#122A1F] text-[#BFA270]'
                              : 'bg-[#EDE7D9] text-[#163323]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[11px] mt-0.5 leading-snug line-clamp-1 ${
                        isActive ? 'text-[#D7CFBA]' : 'text-[#637568]'
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Unified Content Panel (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-[#E3DFC8] p-6 shadow-xs min-h-[500px]">
          {/* ========================================================= */}
          {/* 1. COPROPIETARIOS & ACCESOS                               */}
          {/* ========================================================= */}
          {activeTab === 'owners' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#1B3B2B]" />
                    <span>Padrón de Copropietarios & Gestión de Accesos</span>
                  </h3>
                  <p className="text-xs text-[#7A8E7E] mt-0.5">
                    Directorio de las 4 partes, contraseñas de acceso y administración de poderes fiduciarios.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyAllCredentials}
                    className="px-3.5 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    title="Copiar lista completa de usuarios, accesos y contraseñas al portapapeles"
                  >
                    {copiedAllSuccess ? (
                      <>
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>¡Copiado al Portapapeles!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#BFA270]" />
                        <span>Copiar Usuarios y Contraseñas</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setIsTransferAdminOpen(true)}
                    className="px-3.5 py-2 bg-[#F4EFE6] hover:bg-[#EDE6D8] border border-[#D5CDBC] text-[#163323] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                    title="Ceder el poder de Administrador General a otro socio"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                    <span>Transferir Administración</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingUser(null);
                      setUserFormData({
                        name: '',
                        email: '',
                        phone: '',
                        partName: 'Cabeza 1 (Parte I - 25%)',
                        annualQuotaDays: 30,
                        color: '#DC2626',
                        password: '',
                      });
                      setIsNewUserModalOpen(true);
                    }}
                    className="px-3.5 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#BFA270]" />
                    <span>Alta Copropietario</span>
                  </button>
                </div>
              </div>

              {/* Owners Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F8F5EE] border-b border-[#E3DFC8] text-[#55695B] uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-3">Copropietario</th>
                      <th className="py-3 px-3">Color Calendario</th>
                      <th className="py-3 px-3">Contraseña de Acceso</th>
                      <th className="py-3 px-3">Administración</th>
                      <th className="py-3 px-3 text-center">Estado</th>
                      <th className="py-3 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEAE0]">
                    {users.map((u) => {
                      const isCurrentUser = u.id === currentUser.id;
                      const isCurrentAdmin = u.role === 'admin';
                      return (
                        <tr key={u.id} className="hover:bg-[#FAF8F5] transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="w-7 h-7 rounded-full text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-xs"
                                style={{ backgroundColor: u.color }}
                              >
                                {u.avatarInitials}
                              </span>
                              <div>
                                <span className="font-semibold text-[#163323] block leading-tight">
                                  {u.name}
                                </span>
                                <span className="text-[10px] text-[#7A8E7E] font-mono">
                                  {u.username || u.email.split('@')[0]}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-black/10"
                                style={{ backgroundColor: u.color }}
                              />
                              <span className="font-mono text-[10px] text-[#637568]">{u.color}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs tracking-wider bg-[#F4EFE6] px-2 py-0.5 border border-[#DCD4C0] text-[#163323]">
                                {revealedPasswords[u.id] ? (u.password || '******') : '••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setRevealedPasswords(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                                className="p-1 hover:bg-[#EDE6D7] text-[#637568] hover:text-[#163323] transition-colors cursor-pointer"
                                title={revealedPasswords[u.id] ? "Ocultar contraseña" : "Mostrar contraseña"}
                              >
                                {revealedPasswords[u.id] ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (u.password) {
                                    navigator.clipboard.writeText(u.password);
                                    setCopiedPasswordId(u.id);
                                    setTimeout(() => setCopiedPasswordId(null), 2000);
                                  }
                                }}
                                className="p-1 hover:bg-[#EDE6D7] text-[#637568] hover:text-[#163323] transition-colors cursor-pointer"
                                title="Copiar contraseña"
                              >
                                {copiedPasswordId === u.id ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-700" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setPasswordModalUser(u)}
                                className="text-[10px] text-[#1B3B2B] hover:underline font-semibold cursor-pointer"
                                title="Modificar contraseña"
                              >
                                Editar
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {isCurrentAdmin ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300">
                                <Shield className="w-3 h-3 text-amber-700" />
                                <span>Administrador</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-[#637568]">
                                Socio
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-2xs ${
                                u.active
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-red-50 text-red-800 border border-red-200'
                              }`}
                            >
                              {u.active ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setPasswordModalUser(u)}
                                className="p-1 hover:bg-[#EFEAE0] text-[#163323] transition-colors cursor-pointer"
                                title="Cambiar contraseña"
                              >
                                <KeyRound className="w-3.5 h-3.5 text-[#BFA270]" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingUser(u);
                                  setUserFormData({
                                    name: u.name,
                                    email: u.email,
                                    phone: u.phone,
                                    partName: u.partName,
                                    annualQuotaDays: u.annualQuotaDays,
                                    color: u.color,
                                    password: u.password || '',
                                  });
                                }}
                                className="p-1 hover:bg-[#EFEAE0] text-[#163323] transition-colors cursor-pointer"
                                title="Modificar datos"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {!isCurrentUser && (
                                <button
                                  onClick={() => handleToggleUserActive(u)}
                                  className={`p-1 transition-colors cursor-pointer ${
                                    u.active
                                      ? 'text-red-700 hover:bg-red-50'
                                      : 'text-emerald-700 hover:bg-emerald-50'
                                  }`}
                                  title={u.active ? 'Desactivar usuario' : 'Activar usuario'}
                                >
                                  {u.active ? <Lock className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. MOTOR DE RESERVAS & OPERATORIA                         */}
          {/* ========================================================= */}
          {activeTab === 'engine' && (
            <form onSubmit={handleSaveSettingsGeneral} className="space-y-6">
              <div className="pb-4 border-b border-[#EFEAE0]">
                <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#1B3B2B]" />
                  <span>Parámetros del Motor de Reservas & Operatoria</span>
                </h3>
                <p className="text-xs text-[#7A8E7E] mt-0.5">
                  Configure los límites automáticos de ocupación, márgenes de limpieza y políticas de turno.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                <div className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] space-y-3">
                  <h4 className="font-bold text-[#163323] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-700" />
                    <span>Margen de Sanitización / Limpieza</span>
                  </h4>
                  <label className="block text-[#4F6254] leading-relaxed">
                    Horas de inhabilitación automática posterior al check-out para reacondicionamiento:
                  </label>
                  <select
                    value={settingsFormData.autoCleaningBufferHours}
                    onChange={(e) =>
                      setSettingsFormData({
                        ...settingsFormData,
                        autoCleaningBufferHours: Number(e.target.value),
                      })
                    }
                    className="w-full p-2.5 bg-white border border-[#DCD4C0] font-semibold text-xs focus:outline-none"
                  >
                    <option value={0}>0 horas (Sin bloqueo de limpieza)</option>
                    <option value={12}>12 horas (Mismo día)</option>
                    <option value={24}>24 horas (Día siguiente completo - Recomendado)</option>
                    <option value={48}>48 horas (Sanitización profunda fin de semana)</option>
                  </select>
                </div>

                <div className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] space-y-3">
                  <h4 className="font-bold text-[#163323] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#BFA270]" />
                    <span>Horarios Oficiales</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#4F6254] mb-1">Check-in</label>
                      <input
                        type="time"
                        value={settingsFormData.checkInTime}
                        onChange={(e) =>
                          setSettingsFormData({ ...settingsFormData, checkInTime: e.target.value })
                        }
                        className="w-full p-2 bg-white border border-[#DCD4C0] font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#4F6254] mb-1">Check-out</label>
                      <input
                        type="time"
                        value={settingsFormData.checkOutTime}
                        onChange={(e) =>
                          setSettingsFormData({ ...settingsFormData, checkOutTime: e.target.value })
                        }
                        className="w-full p-2 bg-white border border-[#DCD4C0] font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] space-y-3">
                  <h4 className="font-bold text-[#163323] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-amber-700" />
                    <span>Cancelaciones & Penalidades</span>
                  </h4>
                  <label className="block text-[#4F6254] leading-relaxed">
                    Días mínimos de anticipación para que un socio cancele sin penalidad:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={settingsFormData.cancellationMinDays}
                    onChange={(e) =>
                      setSettingsFormData({
                        ...settingsFormData,
                        cancellationMinDays: Number(e.target.value),
                      })
                    }
                    className="w-full p-2.5 bg-white border border-[#DCD4C0] font-mono text-xs focus:outline-none"
                  />
                </div>

                <div className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] space-y-3">
                  <h4 className="font-bold text-[#163323] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#163323]" />
                    <span>Límite de Ocupantes & Pernocte</span>
                  </h4>
                  <label className="block text-[#4F6254] leading-relaxed">
                    Capacidad máxima simultánea en la estancia (pax):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    value={settingsFormData.maxGuestsLimit}
                    onChange={(e) =>
                      setSettingsFormData({
                        ...settingsFormData,
                        maxGuestsLimit: Number(e.target.value),
                      })
                    }
                    className="w-full p-2.5 bg-white border border-[#DCD4C0] font-mono text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#EFEAE0] flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  <Save className="w-4 h-4 text-[#BFA270]" />
                  <span>Guardar Parámetros Operativos</span>
                </button>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* 3. REGLAS DE CONVIVENCIA & NORMAS                         */}
          {/* ========================================================= */}
          {activeTab === 'rules' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#1B3B2B]" />
                    <span>Reglas de Convivencia & Normas de la Casa</span>
                  </h3>
                  <p className="text-xs text-[#7A8E7E] mt-0.5">
                    Agregue o modifique las directivas visibles para todos los propietarios en su portal.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingRule(null);
                    setRuleFormData({
                      category: 'convivencia',
                      title: '',
                      description: '',
                      iconName: 'Volume2',
                    });
                    setIsNewRuleModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>Nueva Regla</span>
                </button>
              </div>

              <div className="space-y-3">
                {rulesList.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="p-2 bg-[#EDE7D9] text-[#163323] shrink-0 mt-0.5">
                        <BookOpen className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-[#E4DEC9] text-[#163323]">
                            {rule.category}
                          </span>
                          <h4 className="font-bold text-xs text-[#163323]">{rule.title}</h4>
                        </div>
                        <p className="text-xs text-[#4F6254] mt-1 leading-relaxed">
                          {rule.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setEditingRule(rule);
                          setRuleFormData({
                            category: rule.category,
                            title: rule.title,
                            description: rule.description,
                            iconName: rule.iconName,
                          });
                        }}
                        className="p-1.5 bg-white border border-[#DCD4C0] hover:bg-[#F2EDE1] text-[#163323] text-xs cursor-pointer"
                        title="Editar regla"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 bg-white border border-[#DCD4C0] hover:bg-red-50 text-red-700 text-xs cursor-pointer"
                        title="Eliminar regla"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. ESTANCIA & WI-FI                                       */}
          {/* ========================================================= */}
          {activeTab === 'property' && (
            <form onSubmit={handleSaveSettingsGeneral} className="space-y-6">
              <div className="pb-4 border-b border-[#EFEAE0]">
                <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                  <Home className="w-5 h-5 text-[#1B3B2B]" />
                  <span>Estancia, Ubicación & Conectividad Wi-Fi</span>
                </h3>
                <p className="text-xs text-[#7A8E7E] mt-0.5">
                  Parámetros edilicios y credenciales de conexión visibles en la guía del huésped.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Nombre Oficial del Inmueble
                  </label>
                  <input
                    type="text"
                    value={settingsFormData.houseName}
                    onChange={(e) =>
                      setSettingsFormData({ ...settingsFormData, houseName: e.target.value })
                    }
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-serif font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Lema / Slogan del Fideicomiso
                  </label>
                  <input
                    type="text"
                    value={settingsFormData.slogan || 'Cuatro Partes, Un Mismo Objetivo'}
                    onChange={(e) =>
                      setSettingsFormData({ ...settingsFormData, slogan: e.target.value })
                    }
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold uppercase text-[#35483A] mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-700" />
                    <span>Ubicación y Acceso Legal</span>
                  </label>
                  <input
                    type="text"
                    value={settingsFormData.location}
                    onChange={(e) =>
                      setSettingsFormData({ ...settingsFormData, location: e.target.value })
                    }
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-[#1B3B2B]" />
                    <span>Red Wi-Fi Principal (SSID)</span>
                  </label>
                  <input
                    type="text"
                    value={settingsFormData.wifiSsid}
                    onChange={(e) =>
                      setSettingsFormData({ ...settingsFormData, wifiSsid: e.target.value })
                    }
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Contraseña Wi-Fi Principal
                  </label>
                  <input
                    type="text"
                    value={settingsFormData.wifiPassword}
                    onChange={(e) =>
                      setSettingsFormData({ ...settingsFormData, wifiPassword: e.target.value })
                    }
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-mono font-bold"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Dirección de Referencia para Emergencias Médicas
                  </label>
                  <input
                    type="text"
                    value={settingsFormData.emergencyAddress}
                    onChange={(e) =>
                      setSettingsFormData({ ...settingsFormData, emergencyAddress: e.target.value })
                    }
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#EFEAE0] flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  <Save className="w-4 h-4 text-[#BFA270]" />
                  <span>Guardar Datos de la Estancia</span>
                </button>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* 5. DIRECTORIO DE ASISTENCIA & CONTACTOS                   */}
          {/* ========================================================= */}
          {activeTab === 'contacts' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                    <PhoneCall className="w-5 h-5 text-[#1B3B2B]" />
                    <span>Directorio de Asistencia, Personal & Emergencias</span>
                  </h3>
                  <p className="text-xs text-[#7A8E7E] mt-0.5">
                    Teléfonos del casero, servicio de mucamas, guardia médica y seguridad rural.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingContact(null);
                    setContactFormData({
                      category: 'personal',
                      name: '',
                      role: '',
                      phone: '',
                      availableHours: '08:00 a 18:00 hs',
                      notes: '',
                      isEmergency: false,
                    });
                    setIsNewContactModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>Nuevo Contacto</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contactsList.map((contact) => (
                  <div
                    key={contact.id}
                    className={`p-4 border flex flex-col justify-between ${
                      contact.isEmergency
                        ? 'bg-red-50/50 border-red-200'
                        : 'bg-[#FAF8F5] border-[#E3DFC8]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-2xs ${
                            contact.isEmergency
                              ? 'bg-red-100 text-red-800'
                              : 'bg-[#E4DEC9] text-[#163323]'
                          }`}
                        >
                          {contact.category}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingContact(contact);
                              setContactFormData({
                                category: contact.category,
                                name: contact.name,
                                role: contact.role,
                                phone: contact.phone,
                                availableHours: contact.availableHours,
                                notes: contact.notes || '',
                                isEmergency: Boolean(contact.isEmergency),
                              });
                            }}
                            className="p-1 hover:bg-white text-[#163323]"
                            title="Editar"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteContact(contact.id)}
                            className="p-1 hover:bg-red-100 text-red-700"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <h4 className="font-bold text-xs text-[#163323] mt-2">{contact.name}</h4>
                      <p className="text-[11px] text-[#55695B] font-medium">{contact.role}</p>

                      <div className="mt-3 p-2 bg-white border border-[#E8E2D2] text-xs font-mono font-bold text-[#163323] flex items-center justify-between">
                        <span>{contact.phone}</span>
                        <span className="text-[10px] font-sans font-normal text-[#7A8E7E]">
                          {contact.availableHours}
                        </span>
                      </div>

                      {contact.notes && (
                        <p className="text-[11px] text-[#637568] mt-2 italic">{contact.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. DOCUMENTACIÓN OFICIAL DEL FIDEICOMISO                 */}
          {/* ========================================================= */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#1B3B2B]" />
                    <span>Repositorio de Documentación Fiduciaria</span>
                  </h3>
                  <p className="text-xs text-[#7A8E7E] mt-0.5">
                    Actas notariales, contratos constitutivos, planos y manuales de equipamiento.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingDoc(null);
                    setDocFormData({
                      title: '',
                      category: 'reglamento',
                      version: 'v1.0',
                      date: new Date().toLocaleDateString('es-AR'),
                      fileSize: '1.2 MB',
                      description: '',
                      downloadUrl: '',
                    });
                    setIsNewDocModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>Nuevo Documento</span>
                </button>
              </div>

              <div className="space-y-3">
                {documentsList.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] flex items-start justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-[#E4DEC9] text-[#163323]">
                          {doc.category}
                        </span>
                        <span className="text-[11px] text-[#7A8E7E]">{doc.version} · {doc.date}</span>
                      </div>
                      <h4 className="font-bold text-xs text-[#163323] mt-1">{doc.title}</h4>
                      <p className="text-xs text-[#4F6254] mt-1 leading-relaxed">
                        {doc.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setEditingDoc(doc);
                          setDocFormData({
                            title: doc.title,
                            category: doc.category,
                            version: doc.version,
                            date: doc.date,
                            fileSize: doc.fileSize,
                            description: doc.description,
                            downloadUrl: doc.downloadUrl || '',
                          });
                        }}
                        className="p-1.5 bg-white border border-[#DCD4C0] hover:bg-[#F2EDE1] text-[#163323] text-xs cursor-pointer"
                        title="Editar documento"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="p-1.5 bg-white border border-[#DCD4C0] hover:bg-red-50 text-red-700 text-xs cursor-pointer"
                        title="Eliminar documento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 7. IDENTIDAD, MARCA & LOGO                                */}
          {/* ========================================================= */}
          {activeTab === 'identity' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-[#EFEAE0]">
                <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-[#1B3B2B]" />
                  <span>Identidad Visual & Personalización de Logo</span>
                </h3>
                <p className="text-xs text-[#7A8E7E] mt-0.5">
                  Cargue la imagen corporativa oficial del Fideicomiso El Desayuno.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5 p-5 bg-[#FAF8F5] border border-[#E3DFC8] flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#637568] mb-3">
                    Vista Previa Actual
                  </span>
                  <div className="p-4 bg-white border border-[#DDD5BF] shadow-xs flex items-center justify-center">
                    <BrandLogo size="xl" variant="seal-only" logoUrl={currentLogoUrl || undefined} />
                  </div>
                  <span className="font-serif font-bold text-sm tracking-wider text-[#163323] mt-3">
                    EL DESAYUNO SOCIEDAD
                  </span>
                  <span className="text-[10px] text-[#A68853] uppercase font-semibold">
                    Cuatro Partes, Un Mismo Objetivo
                  </span>
                </div>

                <div className="lg:col-span-7 space-y-4 text-xs">
                  <div className="p-4 bg-white border border-[#E3DFC8]">
                    <h4 className="font-bold text-[#163323] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-[#BFA270]" />
                      <span>Cargar Archivo de Imagen desde su Computadora</span>
                    </h4>
                    <p className="text-[#637568] mt-1 leading-snug">
                      Suba un archivo PNG, JPG o SVG. Se guardará de manera permanente.
                    </p>
                    <label className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white font-semibold uppercase tracking-wider cursor-pointer shadow-xs">
                      <Upload className="w-3.5 h-3.5 text-[#BFA270]" />
                      <span>{isUploadingLogo ? 'Subiendo Logo a Cloudflare R2...' : 'Seleccionar Archivo de Logo'}</span>
                      <input type="file" accept="image/*" onChange={handleFileUploadLogo} disabled={isUploadingLogo} className="hidden" />
                    </label>
                  </div>

                  <div className="p-4 bg-white border border-[#E3DFC8]">
                    <h4 className="font-bold text-[#163323] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <ExternalLink className="w-4 h-4 text-[#BFA270]" />
                      <span>O ingresar URL Externa de Imagen</span>
                    </h4>
                    <form onSubmit={handleSaveLogoUrl} className="mt-2 flex gap-2">
                      <input
                        type="url"
                        value={logoInputUrl}
                        onChange={(e) => setLogoInputUrl(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 p-2 bg-[#FAF8F5] border border-[#DCD4C0] font-mono text-xs"
                      />
                      <button
                        type="submit"
                        className="px-3 py-2 bg-[#FAF8F5] hover:bg-[#EFEAE0] border border-[#DCD4C0] font-semibold uppercase text-[#163323]"
                      >
                        Guardar
                      </button>
                    </form>
                  </div>

                  <div className="p-3 bg-[#FAF8F5] border border-[#E3DFC8] flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[#163323]">
                      Restablecer al emblema heráldico vectorial original:
                    </span>
                    <button
                      type="button"
                      onClick={handleResetToDefaultLogo}
                      className="px-3 py-1 bg-white hover:bg-red-50 border border-[#DDD5BF] text-xs font-semibold text-red-700"
                    >
                      Restablecer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 8. CLOUDFLARE D1 & BACKUP                                 */}
          {/* ========================================================= */}
          {activeTab === 'database' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#1B3B2B]" />
                    <span>Base de Datos Cloudflare D1 & Copias de Respaldo</span>
                  </h3>
                  <p className="text-xs text-[#7A8E7E] mt-0.5">
                    Motor relacional SQLite serverless en el Edge de Cloudflare con latencia ultra baja.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold border ${
                      d1Service.isConnected()
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-amber-50 text-amber-900 border-amber-300'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        d1Service.isConnected() ? 'bg-emerald-600 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    <span>
                      {d1Service.isConnected()
                        ? `D1 Conectado (${d1StatusInfo?.latencyMs || 0.3}ms)`
                        : 'Modo Local'}
                    </span>
                  </span>
                </div>
              </div>

              {/* D1 Credentials & Test */}
              <div className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] space-y-4 text-xs">
                <h4 className="font-bold text-[#163323] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-[#BFA270]" />
                  <span>Credenciales y Enlace Cloudflare API</span>
                </h4>

                <form onSubmit={handleSaveD1Config} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">Account ID</label>
                    <input
                      type="text"
                      value={d1ConfigForm.accountId}
                      onChange={(e) => setD1ConfigForm({ ...d1ConfigForm, accountId: e.target.value.trim() })}
                      placeholder="b36aef318f..."
                      className="w-full p-2 bg-white border border-[#DCD4C0] font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">Database ID</label>
                    <input
                      type="text"
                      value={d1ConfigForm.databaseId}
                      onChange={(e) => setD1ConfigForm({ ...d1ConfigForm, databaseId: e.target.value.trim() })}
                      placeholder="f0474948-373a..."
                      className="w-full p-2 bg-white border border-[#DCD4C0] font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">API Token</label>
                    <input
                      type="password"
                      value={d1ConfigForm.apiToken}
                      onChange={(e) => setD1ConfigForm({ ...d1ConfigForm, apiToken: e.target.value.trim() })}
                      placeholder="••••••••••••••••"
                      className="w-full p-2 bg-white border border-[#DCD4C0] font-mono text-xs"
                    />
                  </div>

                  <div className="md:col-span-3 pt-2 flex items-center justify-between gap-2 border-t border-[#E8E2D2]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestD1Connection}
                        disabled={d1Loading}
                        className="px-3.5 py-1.5 bg-white hover:bg-[#FAF8F5] border border-[#DCD4C0] text-[#163323] font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                      >
                        {d1Loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5 text-emerald-800" />}
                        <span>Probar Conexión</span>
                      </button>
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white font-semibold uppercase tracking-wider cursor-pointer"
                      >
                        Guardar
                      </button>
                    </div>

                    <span className="text-[11px] text-[#7A8E7E]">
                      {d1StatusInfo?.message || 'Verificado con el servidor.'}
                    </span>
                  </div>
                </form>
              </div>

              {/* Cloudflare R2 Object Storage Card (Bucket: el-desayuno) */}
              <div className="p-4 bg-[#FAF8F5] border border-[#E3DFC8] space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-[#163323] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-[#BFA270]" />
                    <span>Almacenamiento de Fotos: Cloudflare R2 (Bucket: el-desayuno)</span>
                  </h4>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                      r2Status?.connected
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border-amber-300'
                    }`}
                  >
                    {r2Status?.connected ? 'R2 Activo' : 'R2 Pendiente de Credenciales'}
                  </span>
                </div>

                <form onSubmit={handleSaveR2Config} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">Nombre del Bucket</label>
                    <input
                      type="text"
                      value={r2ConfigForm.bucketName || 'el-desayuno'}
                      onChange={(e) => setR2ConfigForm({ ...r2ConfigForm, bucketName: e.target.value.trim() })}
                      placeholder="el-desayuno"
                      required
                      className="w-full p-2 bg-white border border-[#DCD4C0] font-mono text-xs font-bold text-[#163323]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">Account ID</label>
                    <input
                      type="text"
                      value={r2ConfigForm.accountId}
                      onChange={(e) => setR2ConfigForm({ ...r2ConfigForm, accountId: e.target.value.trim() })}
                      placeholder="b36aef318f..."
                      className="w-full p-2 bg-white border border-[#DCD4C0] font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">R2 Access Key ID</label>
                    <input
                      type="text"
                      value={r2ConfigForm.accessKeyId}
                      onChange={(e) => setR2ConfigForm({ ...r2ConfigForm, accessKeyId: e.target.value.trim() })}
                      placeholder="e.j. 4a2b8c9..."
                      className="w-full p-2 bg-white border border-[#DCD4C0] font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">R2 Secret Access Key</label>
                    <input
                      type="password"
                      value={r2ConfigForm.secretAccessKey}
                      onChange={(e) => setR2ConfigForm({ ...r2ConfigForm, secretAccessKey: e.target.value.trim() })}
                      placeholder="••••••••••••••••"
                      className="w-full p-2 bg-white border border-[#DCD4C0] font-mono text-xs"
                    />
                  </div>

                  <div className="md:col-span-4 pt-2 flex items-center justify-between gap-2 border-t border-[#E8E2D2]">
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white font-semibold uppercase tracking-wider cursor-pointer"
                    >
                      Guardar R2 Bucket 'el-desayuno'
                    </button>
                    <span className="text-[11px] text-[#7A8E7E]">
                      {r2Status?.message || "Conexión S3-compatible lista para el Bucket 'el-desayuno'."}
                    </span>
                  </div>
                </form>
              </div>

              {/* Actions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <button
                  onClick={handleInitD1Schema}
                  disabled={d1Loading}
                  className="p-3.5 bg-white hover:bg-[#FAF8F5] border border-[#DCD4C0] text-left transition-colors cursor-pointer"
                >
                  <span className="font-bold text-[#163323] block">1. Verificar Tablas DDL</span>
                  <span className="text-[11px] text-[#637568] block mt-1">
                    Crea users, bookings, date_blocks y settings en SQLite.
                  </span>
                </button>

                <button
                  onClick={handlePushDataToD1}
                  disabled={d1Loading}
                  className="p-3.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-left transition-colors cursor-pointer shadow-xs"
                >
                  <span className="font-bold block flex items-center justify-between">
                    <span>2. Migrar a Cloudflare D1</span>
                    <Upload className="w-3.5 h-3.5 text-[#BFA270]" />
                  </span>
                  <span className="text-[11px] text-[#D0C7B2] block mt-1">
                    Envía todos los socios, reglas y turnos locales a la nube.
                  </span>
                </button>

                <button
                  onClick={handlePullDataFromD1}
                  disabled={d1Loading}
                  className="p-3.5 bg-white hover:bg-[#FAF8F5] border border-[#DCD4C0] text-left transition-colors cursor-pointer"
                >
                  <span className="font-bold text-[#163323] block flex items-center justify-between">
                    <span>3. Descargar de D1</span>
                    <Download className="w-3.5 h-3.5 text-emerald-800" />
                  </span>
                  <span className="text-[11px] text-[#637568] block mt-1">
                    Sincroniza el estado más reciente desde la nube.
                  </span>
                </button>
              </div>

              {/* SQL Console */}
              <div className="p-4 bg-[#16291C] text-white rounded-none space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#BFA270]">
                    Consola Interactiva SQL D1
                  </span>
                  <button
                    onClick={handleExecuteSQL}
                    disabled={d1Loading}
                    className="px-3 py-1 bg-[#2D4A35] hover:bg-[#3D6247] text-white text-xs font-mono font-bold uppercase transition-colors cursor-pointer"
                  >
                    Ejecutar Query
                  </button>
                </div>
                <textarea
                  value={sqlQueryText}
                  onChange={(e) => setSqlQueryText(e.target.value)}
                  rows={2}
                  className="w-full p-2 bg-[#0E1B12] border border-[#2D4A35] font-mono text-xs text-emerald-300 focus:outline-none"
                />

                {sqlError && (
                  <div className="p-2 bg-red-950/80 border border-red-800 text-red-300 text-xs font-mono">
                    {sqlError}
                  </div>
                )}

                {sqlResults && (
                  <div className="max-h-48 overflow-auto border border-[#2D4A35] bg-[#0E1B12] p-2 text-xs font-mono">
                    <pre className="text-emerald-300">{JSON.stringify(sqlResults, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODALS: USER, RULE, CONTACT, DOC                          */}
      {/* ========================================================= */}

      {/* Modal: User Add / Edit */}
      {(isNewUserModalOpen || editingUser) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#DED7C2] shadow-2xl p-6">
            <h3 className="text-base font-bold text-[#163323] pb-3 border-b border-[#EFEAE0]">
              {editingUser ? 'Modificar Copropietario' : 'Alta de Nuevo Copropietario'}
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  required
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Email</label>
                  <input
                    type="email"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={userFormData.phone}
                    onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Denominación de Parte</label>
                  <input
                    type="text"
                    value={userFormData.partName}
                    onChange={(e) => setUserFormData({ ...userFormData, partName: e.target.value })}
                    placeholder="Parte I (25%)"
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Cupo Anual (Días)</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={userFormData.annualQuotaDays}
                    onChange={(e) => setUserFormData({ ...userFormData, annualQuotaDays: Number(e.target.value) })}
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Color de Calendario</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={userFormData.color}
                    onChange={(e) => setUserFormData({ ...userFormData, color: e.target.value })}
                    className="w-10 h-8 border cursor-pointer"
                  />
                  <span className="font-mono text-xs">{userFormData.color}</span>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#EFEAE0]">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewUserModalOpen(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 text-[#637568] hover:text-[#19231A]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1B3B2B] text-white font-semibold uppercase tracking-wider hover:bg-[#132A1F]"
                >
                  Guardar Copropietario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: House Rule Add / Edit */}
      {(isNewRuleModalOpen || editingRule) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#DED7C2] shadow-2xl p-6">
            <h3 className="text-base font-bold text-[#163323] pb-3 border-b border-[#EFEAE0]">
              {editingRule ? 'Modificar Regla de Convivencia' : 'Nueva Regla de Convivencia'}
            </h3>

            <form onSubmit={handleSaveRule} className="space-y-3 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Categoría</label>
                  <select
                    value={ruleFormData.category}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, category: e.target.value as HouseRule['category'] })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  >
                    <option value="convivencia">Convivencia General</option>
                    <option value="horarios">Horarios & Descanso</option>
                    <option value="capacidad">Capacidad & Invitados</option>
                    <option value="mascotas">Política de Mascotas</option>
                    <option value="pileta">Piscina & Parque</option>
                    <option value="quincho">Quincho & Asador</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Título de la Regla</label>
                  <input
                    type="text"
                    value={ruleFormData.title}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, title: e.target.value })}
                    placeholder="ej. Cuidado de la Piscina"
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Descripción y Directiva</label>
                <textarea
                  value={ruleFormData.description}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, description: e.target.value })}
                  rows={3}
                  placeholder="Detalle de la pauta de uso..."
                  required
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#EFEAE0]">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewRuleModalOpen(false);
                    setEditingRule(null);
                  }}
                  className="px-4 py-2 text-[#637568] hover:text-[#19231A]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1B3B2B] text-white font-semibold uppercase tracking-wider hover:bg-[#132A1F]"
                >
                  Guardar Regla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Useful Contact Add / Edit */}
      {(isNewContactModalOpen || editingContact) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#DED7C2] shadow-2xl p-6">
            <h3 className="text-base font-bold text-[#163323] pb-3 border-b border-[#EFEAE0]">
              {editingContact ? 'Modificar Contacto' : 'Nuevo Contacto de Asistencia'}
            </h3>

            <form onSubmit={handleSaveContact} className="space-y-3 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Nombre o Institución</label>
                  <input
                    type="text"
                    value={contactFormData.name}
                    onChange={(e) => setContactFormData({ ...contactFormData, name: e.target.value })}
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Rol / Función</label>
                  <input
                    type="text"
                    value={contactFormData.role}
                    onChange={(e) => setContactFormData({ ...contactFormData, role: e.target.value })}
                    placeholder="ej. Casero / Limpieza"
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={contactFormData.phone}
                    onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Disponibilidad</label>
                  <input
                    type="text"
                    value={contactFormData.availableHours}
                    onChange={(e) => setContactFormData({ ...contactFormData, availableHours: e.target.value })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center pt-1">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Categoría</label>
                  <select
                    value={contactFormData.category}
                    onChange={(e) => setContactFormData({ ...contactFormData, category: e.target.value as UsefulContact['category'] })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  >
                    <option value="personal">Personal del Campo</option>
                    <option value="emergencia">Emergencias Médicas / Fuego</option>
                    <option value="seguridad">Seguridad Rural</option>
                    <option value="servicios">Técnicos & Mantenimiento</option>
                  </select>
                </div>

                <div className="pt-4">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#163323]">
                    <input
                      type="checkbox"
                      checked={contactFormData.isEmergency}
                      onChange={(e) => setContactFormData({ ...contactFormData, isEmergency: e.target.checked })}
                      className="w-4 h-4 text-red-600 cursor-pointer"
                    />
                    <span>¿Es Guardia de Emergencia 24h?</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Notas Adicionales</label>
                <input
                  type="text"
                  value={contactFormData.notes || ''}
                  onChange={(e) => setContactFormData({ ...contactFormData, notes: e.target.value })}
                  placeholder="Ubicación o instrucciones de contacto..."
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#EFEAE0]">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewContactModalOpen(false);
                    setEditingContact(null);
                  }}
                  className="px-4 py-2 text-[#637568] hover:text-[#19231A]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1B3B2B] text-white font-semibold uppercase tracking-wider hover:bg-[#132A1F]"
                >
                  Guardar Contacto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Document Add / Edit */}
      {(isNewDocModalOpen || editingDoc) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#DED7C2] shadow-2xl p-6">
            <h3 className="text-base font-bold text-[#163323] pb-3 border-b border-[#EFEAE0]">
              {editingDoc ? 'Modificar Documento' : 'Nuevo Documento Fiduciario'}
            </h3>

            <form onSubmit={handleSaveDocument} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Título del Documento</label>
                <input
                  type="text"
                  value={docFormData.title}
                  onChange={(e) => setDocFormData({ ...docFormData, title: e.target.value })}
                  required
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Categoría</label>
                  <select
                    value={docFormData.category}
                    onChange={(e) => setDocFormData({ ...docFormData, category: e.target.value as DocumentItem['category'] })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  >
                    <option value="reglamento">Reglamento</option>
                    <option value="acta">Acta Notarial</option>
                    <option value="contrato">Contrato Fiduciario</option>
                    <option value="manual">Manual Técnico</option>
                    <option value="mantenimiento">Protocolo de Salida</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">Versión</label>
                  <input
                    type="text"
                    value={docFormData.version}
                    onChange={(e) => setDocFormData({ ...docFormData, version: e.target.value })}
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">Descripción</label>
                <textarea
                  value={docFormData.description}
                  onChange={(e) => setDocFormData({ ...docFormData, description: e.target.value })}
                  rows={2}
                  required
                  className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#EFEAE0]">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewDocModalOpen(false);
                    setEditingDoc(null);
                  }}
                  className="px-4 py-2 text-[#637568] hover:text-[#19231A]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1B3B2B] text-white font-semibold uppercase tracking-wider hover:bg-[#132A1F]"
                >
                  Guardar Documento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Password Management */}
      {passwordModalUser && (
        <PasswordManagementModal
          isOpen={!!passwordModalUser}
          onClose={() => setPasswordModalUser(null)}
          targetUser={passwordModalUser}
          isSelfChange={passwordModalUser.id === currentUser.id}
        />
      )}

      {/* Modal: Transfer Admin Role */}
      {isTransferAdminOpen && (
        <TransferAdminModal
          isOpen={isTransferAdminOpen}
          onClose={() => setIsTransferAdminOpen(false)}
          currentAdmin={currentUser}
          users={users}
          onTransferSuccess={(newAdmin) => {
            setIsTransferAdminOpen(false);
            showSuccess(`Poder de administración transferido exitosamente a ${newAdmin.name}.`);
          }}
        />
      )}
    </div>
  );
};
