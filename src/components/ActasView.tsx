import React, { useState, useEffect } from 'react';
import { User, DocumentItem, TrustSettings, hasPrivilegedAccess, isUserAdmin, isUserFiduciante, isUserCabezaDeEquipo } from '../types';
import { storageService } from '../services/storageService';
import { r2Service } from '../services/r2Service';
import { UserRoleBadge } from './UserRoleBadge';
import { BrandLogo } from './BrandLogo';
import { CustomDialogModal } from './CustomDialogModal';
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  Plus,
  ShieldCheck,
  Landmark,
  Award,
  CheckCircle2,
  Calendar,
  Lock,
  X,
  FileCheck,
  Check,
  BookOpen,
  Trash2,
  Upload,
  Image as ImageIcon,
  Camera,
  ExternalLink,
} from 'lucide-react';

interface ActasViewProps {
  currentUser: User;
  settings: TrustSettings;
  onGoBack?: () => void;
}

interface PendingAttachment {
  url: string;
  name: string;
  mimeType: string;
}

const attachmentUrlOf = (document: DocumentItem) =>
  document.attachmentUrl || document.photoUrl || document.downloadUrl || '';

const attachmentMimeTypeOf = (document: DocumentItem) => {
  if (document.attachmentMimeType) return document.attachmentMimeType;
  const url = attachmentUrlOf(document).toLowerCase();
  if (url.includes('.pdf')) return 'application/pdf';
  if (url.match(/\.(png|jpe?g|gif|webp|heic)$/)) return 'image/*';
  if (url.match(/\.(doc|docx)$/)) return 'application/msword';
  return '';
};

const isImageAttachment = (document: DocumentItem) => attachmentMimeTypeOf(document).startsWith('image/');
const isPdfAttachment = (document: DocumentItem) => attachmentMimeTypeOf(document) === 'application/pdf';
const isWordAttachment = (document: DocumentItem) => {
  const mimeType = attachmentMimeTypeOf(document);
  return mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    /\.docx?$/i.test(document.attachmentName || '');
};

const formatActaDate = (date: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }
  return date || 'Sin fecha';
};

const currentDateInputValue = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const wordViewerUrl = (document: DocumentItem) => {
  const attachmentUrl = attachmentUrlOf(document);
  if (!attachmentUrl || typeof window === 'undefined') return '';
  const publicUrl = new URL(attachmentUrl, window.location.origin).href;
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicUrl)}`;
};

export const ActasView: React.FC<ActasViewProps> = ({ currentUser, settings, onGoBack }) => {
  const isPrivileged = hasPrivilegedAccess(currentUser);
  const isAdmin = isUserAdmin(currentUser);
  const isFid = isUserFiduciante(currentUser);
  const isLeader = isUserCabezaDeEquipo(currentUser);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);

  // New Acta Modal State
  const [isNewActaModalOpen, setIsNewActaModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(currentDateInputValue);
  const [newVersion, setNewVersion] = useState('Acta Oficial Notariada');
  const [newDescription, setNewDescription] = useState('');
  const [newFileSize, setNewFileSize] = useState('1.5 MB');
  const [newAttachment, setNewAttachment] = useState<PendingAttachment | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Custom Dialog Modal State
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'confirm' | 'alert' | 'success' | 'warning';
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    const loadDocs = () => {
      const allDocs = storageService.getDocuments();
      setDocuments(allDocs);
    };
    loadDocs();
    const unsub = storageService.subscribe(loadDocs);
    return () => unsub();
  }, []);

  // Filtered list
  const filteredActas = documents.filter((acta) => {
    const matchesSearch =
      acta.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (acta.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (acta.version || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesYear =
      selectedYear === 'all' ||
      acta.date.includes(selectedYear) ||
      (selectedYear === '2026' && (acta.date.includes('2026') || acta.date.includes('/26'))) ||
      (selectedYear === '2025' && (acta.date.includes('2025') || acta.date.includes('/25')));

    return matchesSearch && matchesYear;
  });

  const handleFileUploadPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isAccepted =
      file.type.startsWith('image/') ||
      file.type === 'application/pdf' ||
      file.type === 'application/msword' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      lowerName.endsWith('.pdf') || lowerName.endsWith('.doc') || lowerName.endsWith('.docx');
    if (!isAccepted) {
      setDialogState({
        isOpen: true,
        title: 'Formato no admitido',
        message: 'Puede adjuntar una foto, un PDF o un documento Word (.doc o .docx).',
        type: 'warning',
        confirmText: 'Aceptar',
        onConfirm: () => {},
      });
      e.target.value = '';
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setDialogState({
        isOpen: true,
        title: 'Archivo Muy Grande',
        message: 'Por favor seleccione una imagen o documento menor a 15MB.',
        type: 'warning',
        confirmText: 'Aceptar',
        onConfirm: () => {},
      });
      return;
    }

    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        try {
          const r2Res = await r2Service.uploadFile(base64, file.name || 'acta-oficial', 'actas');
          if (r2Res.success && r2Res.url) {
            setNewAttachment({
              url: r2Res.url,
              name: file.name || 'acta-oficial',
              mimeType: file.type || (lowerName.endsWith('.pdf') ? 'application/pdf' : ''),
            });
            setNewFileSize(`${(file.size / (1024 * 1024)).toFixed(1)} MB`);
          } else {
            throw new Error(r2Res.error || 'El servidor no confirmó el archivo.');
          }
        } catch (error) {
          setDialogState({
            isOpen: true,
            title: 'No se pudo adjuntar el archivo',
            message: error instanceof Error ? error.message : 'El archivo no se guardó en el servidor. Intente nuevamente.',
            type: 'warning',
            confirmText: 'Aceptar',
            onConfirm: () => {},
          });
        }
      }
      setIsUploadingPhoto(false);
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleCreateNewActa = async (e: React.FormEvent) => {
    e.preventDefault();

    const newDoc: DocumentItem = {
      id: `doc-acta-${Date.now()}`,
      title: newTitle.trim() || newAttachment?.name.replace(/\.(docx?|pdf)$/i, '') || 'Acta sin título',
      category: 'acta',
      version: newVersion.trim() || 'Acta',
      date: newDate,
      fileSize: newFileSize.trim() || '',
      description: newDescription.trim(),
      attachmentUrl: newAttachment?.url,
      attachmentName: newAttachment?.name,
      attachmentMimeType: newAttachment?.mimeType,
      photoUrl: newAttachment?.mimeType.startsWith('image/') ? newAttachment.url : undefined,
    };

    const saved = await storageService.saveDocument(newDoc);
    if (!saved) {
      setDialogState({
        isOpen: true,
        title: 'No se pudo guardar el acta',
        message: 'La base de datos no confirmó el registro. El acta no se guardó localmente.',
        type: 'warning',
        confirmText: 'Aceptar',
        onConfirm: () => {},
      });
      return;
    }
    setIsNewActaModalOpen(false);
    setNewTitle('');
    setNewDescription('');
    setNewAttachment(null);
    setNewVersion('Acta Oficial Notariada');
    setNewDate(currentDateInputValue());
  };

  const handleDeleteSingleActa = (id: string, title: string) => {
    setDialogState({
      isOpen: true,
      title: 'Eliminar Acta',
      message: `¿Desea eliminar el acta "${title}"?`,
      type: 'warning',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      onConfirm: () => {
        storageService.deleteDocument(id);
        const updated = storageService.getDocuments();
        setDocuments(updated);
      },
    });
  };

  const handleDeleteAllActas = () => {
    setDialogState({
      isOpen: true,
      title: 'Vaciar Todas las Actas',
      message: '¿Está seguro de eliminar TODAS las actas registradas en el sistema? La sección quedará totalmente vacía para que usted cargue las suyas.',
      type: 'warning',
      confirmText: 'Borrar Todas',
      cancelText: 'Cancelar',
      onConfirm: () => {
        storageService.clearAllDocuments();
        setDocuments([]);
      },
    });
  };

  const handleDownloadActa = (acta: DocumentItem) => {
    const attachmentUrl = attachmentUrlOf(acta);
    if (attachmentUrl) {
      const link = document.createElement('a');
      link.href = attachmentUrl;
      link.download = acta.attachmentName || acta.title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const legalContent = `========================================================================
FIDEICOMISO "EL DESAYUNO SOCIEDAD" - LIBRO DE ACTAS NOTARIALES
========================================================================
DOCUMENTO: ${acta.title}
REGISTRO / VERSIÓN: ${acta.version}
FECHA PROTOCOLAR: ${acta.date}
ÓRGANO EMISOR: Asamblea General Fiduciaria & Administración General
ESTABLECIMIENTO: Estancia El Desayuno (Ruta Provincial 41, San Antonio de Areco)
========================================================================

RESUMEN EJECUTIVO & RESOLUCIONES:
${acta.description}

FOTO / DOCUMENTO ADJUNTO:
${acta.photoUrl ? 'Imagen/Foto adjunta en el registro digital.' : 'Documento registrado digitalmente.'}

ORDEN DEL DÍA Y CONSTANCIAS LEGALES:
1. Quórum y Representación: Asistencia del 100% de las Partes Indivisas.
2. Tratamiento de los Puntos del Orden del Día conforme estatuto fiduciario y reglamentos de uso.
3. Resoluciones Aprobadas por Mayoría Calificada / Unanimidad según correspondiese.
4. Validez Notarial: El presente instrumento conforma constancia fehaciente en el Libro de Actas.

Certificado digitalmente conforme al Régimen del Fideicomiso El Desayuno.
========================================================================`;

    const blob = new Blob([legalContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${acta.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // If not privileged, display restricted access view
  if (!isPrivileged) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-8">
        <div className="bg-[#FFFFFF] border border-amber-200 p-8 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 bg-amber-100 text-amber-900 border border-amber-300 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2
              className="text-2xl font-bold text-[#163323]"
              style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
            >
              Documentación Fiduciaria Confidencial
            </h2>
            <p className="text-sm text-[#526657] max-w-md mx-auto leading-relaxed">
              El Libro de Actas de Asamblea, resoluciones notariales y el Libro de Gastos son de consulta reservada para el <strong>Administrador General</strong>, el <strong>Fiduciante</strong> y los <strong>Cabezas de Equipo</strong>.
            </p>
          </div>
          <div className="pt-2">
            {onGoBack && (
              <button
                onClick={onGoBack}
                className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Volver al Panel Principal
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Executive Hero Banner */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#7A8E7E] pb-1">
            <span className="font-serif font-bold text-[#163323]">Fideicomiso El Desayuno</span>
            <span>·</span>
            <span>Régimen Societario & Gobierno Corporativo</span>
            <span>·</span>
            <span className="font-semibold text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Acceso Habilitado
            </span>
          </div>
          <h2
            className="text-xl sm:text-2xl font-serif font-bold text-[#163323] tracking-wide flex items-center gap-2.5"
            style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
          >
            <BookOpen className="w-6 h-6 text-[#BFA270]" />
            <span>Libro Oficial de Actas & Resoluciones Fiduciarias</span>
          </h2>
          <p className="text-xs text-[#526657] mt-1 max-w-3xl leading-relaxed">
            Registro formal de Asambleas Ordinarias, Asambleas Extraordinarias, poderes notariales y decisiones fiduciarias de los socios de la Estancia El Desayuno.
          </p>
        </div>

        {/* Access Role Badge & New Button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-[#F7F4EB] px-3 py-1.5 border border-[#DDD5BF]">
            <span className="text-[10px] text-[#637568] uppercase font-bold tracking-wider">
              Mi Rol:
            </span>
            <UserRoleBadge user={currentUser} size="sm" />
          </div>

          {(isAdmin || isFid || isLeader) && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsNewActaModalOpen(true)}
                className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
              >
                <Plus className="w-4 h-4 text-[#BFA270]" />
                <span>+ Cargar Nueva Acta</span>
              </button>

              {documents.length > 0 && (
                <button
                  onClick={handleDeleteAllActas}
                  className="px-3 py-2 bg-white hover:bg-red-50 border border-red-300 text-red-700 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Borrar todas las actas registradas"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vaciar Todo</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Control Bar: Search & Year Filter */}
      <div className="bg-white border border-[#E3DFC8] p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#8C7A53] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por acta, tema, número o palabras clave..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-medium focus:outline-none focus:border-[#163323]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-[#637568] font-semibold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-[#BFA270]" />
            <span>Filtrar:</span>
          </span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-semibold text-[#163323] focus:outline-none cursor-pointer"
          >
            <option value="all">Todas las Actas ({documents.length})</option>
            <option value="2026">Año 2026</option>
            <option value="2025">Año 2025</option>
          </select>
        </div>
      </div>

      {/* Actas List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredActas.map((acta) => (
          <div
            key={acta.id}
            className="bg-white border border-[#E3DFC8] hover:border-[#BFA270] transition-all p-5 shadow-xs flex flex-col justify-between group"
          >
            <div className="space-y-3">
              {/* Header tags */}
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-[#F6F2E8] text-[#1B3B2B] border border-[#D5CDBC]">
                  <FileCheck className="w-3 h-3 text-[#A68853]" />
                  <span>{acta.version}</span>
                </span>
                <span className="text-[11px] font-mono font-bold text-[#163323] flex items-center gap-1 bg-[#FAF8F5] px-2 py-0.5 border border-[#E3DFC8]">
                  <Calendar className="w-3.5 h-3.5 text-[#A68853]" />
                  <span>{formatActaDate(acta.date)}</span>
                </span>
              </div>

              {/* Preview changes according to the attachment type. */}
              {isImageAttachment(acta) && attachmentUrlOf(acta) && (
                <div
                  onClick={() => setSelectedDoc(acta)}
                  className="w-full h-36 bg-[#F4EFE6] border border-[#DCD4C0] overflow-hidden rounded-2xs cursor-pointer group-hover:border-[#BFA270] relative"
                >
                  <img
                    src={attachmentUrlOf(acta)}
                    alt={acta.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="px-3 py-1 bg-[#1B3B2B] text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <Eye className="w-3 h-3" /> Ver Foto Completa
                    </span>
                  </div>
                </div>
              )}

              {(isPdfAttachment(acta) || (attachmentUrlOf(acta) && !isImageAttachment(acta))) && (
                <button
                  type="button"
                  onClick={() => setSelectedDoc(acta)}
                  className="w-full h-20 bg-[#F4EFE6] border border-[#DCD4C0] hover:border-[#BFA270] text-[#163323] flex items-center justify-center gap-3 cursor-pointer"
                >
                  <FileText className="w-7 h-7 text-[#A68853]" />
                  <span className="text-left">
                    <strong className="block text-xs">{isPdfAttachment(acta) ? 'PDF adjunto' : 'Documento Word adjunto'}</strong>
                    <span className="text-[10px] text-[#637568]">{acta.attachmentName || 'Abrir o descargar archivo'}</span>
                  </span>
                </button>
              )}

              {/* Title */}
              <h3
                className="text-base font-bold text-[#163323] leading-snug group-hover:text-[#2A4D32] transition-colors"
                style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
              >
                {acta.title}
              </h3>

              {/* Description */}
              <p className="text-xs text-[#526657] leading-relaxed line-clamp-3">
                {acta.description}
              </p>
            </div>

            {/* Footer and Actions */}
            <div className="pt-4 mt-4 border-t border-[#EFEAE0] flex items-center justify-between text-xs">
              <span className="text-[10px] text-[#7A8E7E] font-mono">
                {acta.fileSize}
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedDoc(acta)}
                  className="px-2.5 py-1.5 bg-[#FAF8F5] hover:bg-[#F2EDE1] border border-[#DDD5BF] text-[#163323] font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Ver detalles y archivo adjunto de la acta"
                >
                  <Eye className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>Ver Acta</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadActa(acta)}
                  className="px-2.5 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Descargar copia del acta"
                >
                  <Download className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>Descargar</span>
                </button>

                {(isAdmin || isFid || isLeader) && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSingleActa(acta.id, acta.title)}
                    className="p-1.5 bg-white hover:bg-red-50 border border-red-200 text-red-700 transition-colors cursor-pointer"
                    title="Eliminar esta acta"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredActas.length === 0 && (
        <div className="p-12 text-center bg-white border border-[#E3DFC8] text-[#7A8E7E] text-xs space-y-3">
          <BookOpen className="w-10 h-10 mx-auto text-[#DDD5BF]" />
          <p className="font-semibold text-base text-[#163323]">No hay actas registradas</p>
          <p className="max-w-md mx-auto text-[#526657]">
            Haga clic en el botón <strong>"+ Cargar Nueva Acta"</strong> para adjuntar una foto, PDF o Word y completar sus datos.
          </p>
          {(isAdmin || isFid || isLeader) && (
            <button
              onClick={() => setIsNewActaModalOpen(true)}
              className="mt-2 px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer inline-flex items-center gap-2 shadow-xs"
            >
              <Plus className="w-4 h-4 text-[#BFA270]" />
              <span>Cargar Mi Primera Acta</span>
            </button>
          )}
        </div>
      )}

      {/* Reader Modal (Parchment Legal View) */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-4xl border border-[#D5CDBC] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#17341B] text-[#FAF8F5] flex items-center justify-between border-b border-[#BFA270]/40 shrink-0">
              <div className="flex items-center gap-2.5">
                <BrandLogo size="sm" variant="seal-only" />
                <div>
                  <h3
                    className="text-base font-bold tracking-wide"
                    style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
                  >
                    Lectura Notarial de Acta Oficial
                  </h3>
                  <span className="text-[11px] text-[#D7CFBA]">
                    {selectedDoc.version} · Fecha {formatActaDate(selectedDoc.date)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedDoc(null)}
                className="text-[#C9D6CC] hover:text-white p-1 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Legal Content Styled */}
            <div className="p-6 overflow-y-auto space-y-4 bg-[#FBF9F5] text-xs leading-relaxed text-[#2C3B30]">
              <div className="p-4 bg-white border border-[#E5DEC9] shadow-2xs space-y-4">
                <div className="text-center pb-3 border-b border-[#EFEAE0]">
                  <span className="text-[10px] tracking-widest uppercase font-bold text-[#A68853] block">
                    FIDEICOMISO "EL DESAYUNO SOCIEDAD"
                  </span>
                  <h4
                    className="text-base font-bold text-[#163323] mt-1"
                    style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
                  >
                    {selectedDoc.title}
                  </h4>
                  <span className="text-[10px] text-[#7A8E7E] font-mono mt-0.5 block">
                    Fecha Protocolar: {formatActaDate(selectedDoc.date)} · Estancia El Desayuno, San Antonio de Areco
                  </span>
                </div>

                {/* The correct viewer is used for each kind of attachment. */}
                {isImageAttachment(selectedDoc) && attachmentUrlOf(selectedDoc) && (
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#637568] block">
                      Foto Adjunta:
                    </span>
                    <div className="p-2 bg-[#FAF8F5] border border-[#DDD5BF] rounded-2xs flex flex-col items-center justify-center">
                      <img
                        src={attachmentUrlOf(selectedDoc)}
                        alt={selectedDoc.title}
                        className="max-h-96 w-auto object-contain border border-[#E5DEC9] shadow-sm rounded-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          window.open(attachmentUrlOf(selectedDoc), '_blank', 'noopener,noreferrer');
                        }}
                        className="mt-2 text-[11px] font-semibold text-[#1B3B2B] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Abrir Imagen en Tamaño Completo
                      </button>
                    </div>
                  </div>
                )}

                {isPdfAttachment(selectedDoc) && attachmentUrlOf(selectedDoc) && (
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#637568] block">
                      PDF Adjunto:
                    </span>
                    <iframe
                      title={`Vista previa de ${selectedDoc.title}`}
                      src={attachmentUrlOf(selectedDoc)}
                      className="w-full h-[55vh] border border-[#DDD5BF] bg-white"
                    />
                  </div>
                )}

                {isWordAttachment(selectedDoc) && attachmentUrlOf(selectedDoc) && (
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#637568] block">
                      Documento Word en vivo:
                    </span>
                    <iframe
                      title={`Vista de ${selectedDoc.title}`}
                      src={wordViewerUrl(selectedDoc)}
                      className="w-full h-[55vh] border border-[#DDD5BF] bg-white"
                    />
                    <p className="text-[10px] text-[#637568]">Si el visor tarda en cargar, puede descargar el documento sin perder el acta.</p>
                  </div>
                )}

                {attachmentUrlOf(selectedDoc) && !isImageAttachment(selectedDoc) && !isPdfAttachment(selectedDoc) && !isWordAttachment(selectedDoc) && (
                  <div className="p-4 bg-[#FAF8F5] border border-[#DDD5BF] flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-[#163323]">
                      <FileText className="w-6 h-6 text-[#A68853]" />
                      <div>
                        <strong className="block text-xs">Archivo adjunto</strong>
                        <span className="text-[10px] text-[#637568]">{selectedDoc.attachmentName || 'Archivo de la acta'}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadActa(selectedDoc)}
                      className="px-3 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-[11px] font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#BFA270]" /> Descargar Word
                    </button>
                  </div>
                )}

                <div className="space-y-2 text-justify">
                  <p>
                    <strong>DESCRIPCIÓN & RESUMEN DE RESOLUCIONES:</strong>
                  </p>
                  <p className="p-3 bg-[#FAF8F5] border border-[#E3DFC8] text-xs leading-relaxed text-[#163323] whitespace-pre-line font-serif">
                    {selectedDoc.description || 'Sin descripción.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#EFEAE0]">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#637568] block mb-2">
                    Atestación & Órganos Firmantes:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                    <div className="p-2 bg-[#FAF8F5] border border-[#DDD5BF] rounded-2xs text-center">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-800 mx-auto mb-1" />
                      <strong className="block text-[#163323]">Administrador General</strong>
                      <span className="text-[#7A8E7E]">Efraín Rodríguez</span>
                    </div>
                    <div className="p-2 bg-[#FAF8F5] border border-[#DDD5BF] rounded-2xs text-center">
                      <Landmark className="w-3.5 h-3.5 text-indigo-800 mx-auto mb-1" />
                      <strong className="block text-[#163323]">Fiduciante</strong>
                      <span className="text-[#7A8E7E]">Órgano Fiduciario</span>
                    </div>
                    <div className="p-2 bg-[#FAF8F5] border border-[#DDD5BF] rounded-2xs text-center">
                      <Award className="w-3.5 h-3.5 text-amber-700 mx-auto mb-1" />
                      <strong className="block text-[#163323]">Cabezas de Equipo</strong>
                      <span className="text-[#7A8E7E]">Cabezas 1, 2, 3 y 4</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-[#FAF8F5] border-t border-[#E5DEC9] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => handleDownloadActa(selectedDoc)}
                className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5 text-[#BFA270]" />
                <span>{attachmentUrlOf(selectedDoc) ? 'Descargar Archivo' : 'Descargar Copia Certificada'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-2 bg-white hover:bg-[#F2EDE1] border border-[#DDD5BF] text-[#163323] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Acta Modal */}
      {isNewActaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#D5CDBC] shadow-2xl overflow-hidden flex flex-col my-8">
            <div className="px-6 py-4 bg-[#17341B] text-[#FAF8F5] flex items-center justify-between shrink-0">
              <h3
                className="text-base font-bold tracking-wide flex items-center gap-2"
                style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
              >
                <Camera className="w-5 h-5 text-[#BFA270]" />
                <span>Registrar Nueva Acta de Asamblea</span>
              </h3>
              <button
                onClick={() => setIsNewActaModalOpen(false)}
                className="text-[#C9D6CC] hover:text-white p-1 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewActa} className="p-6 space-y-4 text-xs">
              {/* 1. Título */}
              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  1. Título del Acta
                </label>
                <input
                  type="text"
                  placeholder="ej. Acta N° 1 - Asamblea Ordinaria de Socios"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold text-sm focus:outline-none focus:border-[#163323]"
                />
              </div>

              {/* 2. Fecha Manual */}
              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  2. Fecha del Acta
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold text-xs focus:outline-none focus:border-[#163323]"
                />
                <span className="text-[10px] text-[#7A8E7E] mt-0.5 block">
                  Seleccione una fecha. Puede dejarla vacía si todavía no la tiene.
                </span>
              </div>

              {/* 3. Archivo del Acta */}
              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  3. Adjuntar Archivo del Acta
                </label>
                <div className="p-3 bg-[#FAF8F5] border border-[#DCD4C0] space-y-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white font-semibold uppercase tracking-wider cursor-pointer shadow-xs text-xs">
                    <Upload className="w-4 h-4 text-[#BFA270]" />
                    <span>{isUploadingPhoto ? 'Guardando Archivo...' : 'Seleccionar Archivo'}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
                      onChange={handleFileUploadPhoto}
                      disabled={isUploadingPhoto}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[10px] text-[#637568]">Admite fotos, PDF y Word (.doc o .docx), hasta 15 MB. El archivo se guarda en el servidor.</p>

                  {newAttachment && (
                    <div className="pt-2 flex items-center gap-3 border-t border-[#E3DFC8]">
                      {newAttachment.mimeType.startsWith('image/') ? (
                        <img
                          src={newAttachment.url}
                          alt="Vista previa"
                          className="w-16 h-16 object-cover border border-[#DCD4C0] rounded-2xs"
                        />
                      ) : (
                        <div className="w-16 h-16 border border-[#DCD4C0] bg-white flex items-center justify-center">
                          <FileText className="w-7 h-7 text-[#A68853]" />
                        </div>
                      )}
                      <div className="flex-1">
                        <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Archivo adjuntado con éxito
                        </span>
                        <span className="block mt-0.5 text-[10px] text-[#637568] truncate">{newAttachment.name}</span>
                        <button
                          type="button"
                          onClick={() => setNewAttachment(null)}
                          className="mt-1 text-[10px] text-red-700 underline hover:text-red-900"
                        >
                          Quitar archivo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Descripción */}
              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  4. Descripción & Resumen de Resoluciones
                </label>
                <textarea
                  rows={4}
                  placeholder="Escriba la descripción o un resumen de los puntos tratadas y resoluciones aprobadas..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] focus:outline-none focus:border-[#163323] leading-relaxed"
                />
              </div>

              {/* 5. Versión / Libro */}
              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  5. Registro / Libro / Tipo
                </label>
                <input
                  type="text"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  placeholder="ej. Acta Oficial Notariada"
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold text-xs focus:outline-none focus:border-[#163323]"
                />
              </div>

              <div className="pt-3 border-t border-[#EFEAE0] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewActaModalOpen(false)}
                  className="px-4 py-2 font-semibold text-[#637568] hover:text-[#163323] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Check className="w-4 h-4 text-[#BFA270]" />
                  <span>Guardar Acta</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Dialog Modal */}
      <CustomDialogModal
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type || 'warning'}
        confirmText={dialogState.confirmText || 'Aceptar'}
        cancelText={dialogState.cancelText || 'Cancelar'}
        onConfirm={dialogState.onConfirm}
        onClose={() => setDialogState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
