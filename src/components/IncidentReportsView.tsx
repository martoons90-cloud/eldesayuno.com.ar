import React, { useState } from 'react';
import { IncidentReport, IncidentStatus, IncidentUrgency, User, Booking, TrustSettings, isUserIntendente } from '../types';
import { storageService } from '../services/storageService';
import { r2Service } from '../services/r2Service';
import {
  AlertTriangle,
  Camera,
  Plus,
  CheckCircle2,
  Clock,
  Wrench,
  XCircle,
  Eye,
  Trash2,
  MessageSquare,
  Sparkles,
  MapPin,
  Calendar,
  Image as ImageIcon,
  Upload,
  X,
  Filter,
  Search,
} from 'lucide-react';

interface IncidentReportsViewProps {
  currentUser: User;
  bookings: Booking[];
  settings: TrustSettings;
}

export const IncidentReportsView: React.FC<IncidentReportsViewProps> = ({
  currentUser,
  bookings,
  settings,
}) => {
  const isAdmin = isUserIntendente(currentUser);

  const [incidents, setIncidents] = useState<IncidentReport[]>(storageService.getIncidents());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // New Incident Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    bookingId: '',
    title: '',
    location: '',
    category: 'rotura' as IncidentReport['category'],
    urgency: 'media' as IncidentUrgency,
    description: '',
  });

  // Admin Response Modal
  const [respondingIncident, setRespondingIncident] = useState<IncidentReport | null>(null);
  const [responseStatus, setResponseStatus] = useState<IncidentStatus>('en_reparacion');
  const [responseText, setResponseText] = useState('');

  // Photo Lightbox Modal
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  // Success alert
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // Filtered upcoming or recent bookings of the user
  const relevantBookings = bookings.filter((b) =>
    isAdmin ? true : b.userId === currentUser.id
  );

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('La foto es demasiado grande. Seleccione una imagen de hasta 15MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      if (base64) {
        setPhotoPreview(base64);
        setIsUploadingPhoto(true);
        try {
          const r2Res = await r2Service.uploadPhoto(base64, file.name || 'incidente', 'incidentes');
          if (r2Res.success && r2Res.url) {
            setPhotoPreview(r2Res.url);
          }
        } catch {
          // fallback to base64 preview
        } finally {
          setIsUploadingPhoto(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitNewIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      alert('Por favor complete el título y la descripción del reporte.');
      return;
    }

    storageService.createIncident({
      bookingId: formData.bookingId || undefined,
      reporterUserId: currentUser.id,
      reporterName: currentUser.name,
      reporterPartName: currentUser.partName,
      title: formData.title,
      description: formData.description,
      location: formData.location || 'Área General de la Estancia',
      category: formData.category,
      urgency: formData.urgency,
      photoUrl: photoPreview || undefined,
    });

    setIncidents(storageService.getIncidents());
    setIsNewModalOpen(false);
    setPhotoPreview(null);
    setFormData({
      bookingId: '',
      title: '',
      location: '',
      category: 'rotura',
      urgency: 'media',
      description: '',
    });
    showToast('Reporte enviado con éxito. El Administrador y el casero han sido notificados.');
  };

  const handleSaveAdminResponse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondingIncident) return;

    const updated: IncidentReport = {
      ...respondingIncident,
      status: responseStatus,
      adminResponse: responseText.trim() || respondingIncident.adminResponse,
      resolvedAt: responseStatus === 'resuelto' ? new Date().toISOString() : undefined,
      resolvedBy: responseStatus === 'resuelto' ? `${currentUser.name} (Admin)` : undefined,
    };

    storageService.updateIncident(updated);
    setIncidents(storageService.getIncidents());
    setRespondingIncident(null);
    setResponseText('');
    showToast(`Estado del reporte actualizado a: ${responseStatus.toUpperCase()}`);
  };

  const handleDeleteIncident = (id: string) => {
    if (confirm('¿Eliminar este reporte de novedad del registro histórico?')) {
      storageService.deleteIncident(id);
      setIncidents(storageService.getIncidents());
      showToast('Reporte eliminado.');
    }
  };

  const filteredIncidents = incidents.filter((inc) => {
    if (filterStatus !== 'all' && inc.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        inc.title.toLowerCase().includes(q) ||
        inc.location.toLowerCase().includes(q) ||
        inc.description.toLowerCase().includes(q) ||
        inc.reporterName.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const getUrgencyBadge = (urg: IncidentUrgency) => {
    switch (urg) {
      case 'urgente':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-900 border border-red-300 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-red-700" />
            Urgente
          </span>
        );
      case 'alta':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
            Alta
          </span>
        );
      case 'media':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200">
            Media
          </span>
        );
      case 'baja':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-700 border border-neutral-200">
            Baja
          </span>
        );
    }
  };

  const getStatusBadge = (status: IncidentStatus) => {
    switch (status) {
      case 'pendiente':
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-900 border border-amber-300 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-700" />
            Pendiente de Revisión
          </span>
        );
      case 'en_reparacion':
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-900 border border-blue-300 flex items-center gap-1">
            <Wrench className="w-3 h-3 text-blue-700" />
            En Reparación / Service
          </span>
        );
      case 'resuelto':
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-900 border border-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            Resuelto
          </span>
        );
      case 'desestimado':
        return (
          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-600 line-through">
            Desestimado
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#7A8E7E]">
            <span>{settings.houseName}</span>
            <span>·</span>
            <span className="font-semibold text-[#8C6D3B]">Mantenimiento & Convivencia</span>
          </div>
          <h2
            className="text-2xl font-bold text-[#163323] mt-1"
            style={{ fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif" }}
          >
            Reportes de Novedades, Daños & Mantenimiento
          </h2>
          <p className="text-xs text-[#526657] mt-1">
            Canal oficial para informar cualquier desperfecto, rotura o reposición necesaria al ingresar o durante su estadía.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => {
              setPhotoPreview(null);
              setFormData({
                bookingId: relevantBookings[0]?.id || '',
                title: '',
                location: '',
                category: 'rotura',
                urgency: 'media',
                description: '',
              });
              setIsNewModalOpen(true);
            }}
            className="px-4 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
          >
            <Camera className="w-4 h-4 text-[#BFA270]" />
            <span>+ Reportar Novedad / Daño</span>
          </button>
        </div>
      </div>

      {/* Success alert */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-medium flex items-center gap-2.5 animate-fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Quick Summary Filters */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8E7E]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, lugar o socio..."
            className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] border border-[#DCD4C0] text-xs focus:outline-none focus:border-[#1B3B2B]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: `Todos (${incidents.length})` },
            { id: 'pendiente', label: `Pendientes (${incidents.filter((i) => i.status === 'pendiente').length})` },
            { id: 'en_reparacion', label: `En Reparación (${incidents.filter((i) => i.status === 'en_reparacion').length})` },
            { id: 'resuelto', label: `Resueltos (${incidents.filter((i) => i.status === 'resuelto').length})` },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setFilterStatus(st.id)}
              className={`px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                filterStatus === st.id
                  ? 'bg-[#1B3B2B] text-white border-[#1B3B2B]'
                  : 'bg-white hover:bg-[#FAF8F5] text-[#4F6254] border-[#E3DFC8]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Incidents Feed */}
      <div className="space-y-4">
        {filteredIncidents.length === 0 ? (
          <div className="bg-white border border-[#E3DFC8] p-12 text-center text-[#7A8E7E]">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-700/60 mb-3" />
            <h4 className="text-base font-bold text-[#163323]">Sin novedades pendientes</h4>
            <p className="text-xs mt-1 text-[#637568]">
              No se registran incidentes ni desperfectos con los filtros seleccionados.
            </p>
          </div>
        ) : (
          filteredIncidents.map((incident) => (
            <div
              key={incident.id}
              className="bg-white border border-[#E3DFC8] p-5 shadow-xs flex flex-col md:flex-row items-start justify-between gap-5 transition-colors hover:border-[#1B3B2B]/40"
            >
              <div className="flex-1 space-y-3">
                {/* Meta Header */}
                <div className="flex flex-wrap items-center gap-2">
                  {getStatusBadge(incident.status)}
                  {getUrgencyBadge(incident.urgency)}
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-[#F2EDE1] text-[#163323]">
                    {incident.category}
                  </span>
                  <span className="text-[11px] text-[#7A8E7E] flex items-center gap-1 font-mono">
                    <Calendar className="w-3 h-3" />
                    {new Date(incident.createdAt).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Title and location */}
                <div>
                  <h3 className="text-base font-bold text-[#163323]">{incident.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-[#637568] mt-0.5">
                    <span className="flex items-center gap-1 font-semibold text-[#1B3B2B]">
                      <MapPin className="w-3 h-3 text-red-700" />
                      {incident.location}
                    </span>
                    <span>·</span>
                    <span>Reportado por: <strong>{incident.reporterName}</strong> ({incident.reporterPartName})</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-[#4F6254] leading-relaxed bg-[#FAF8F5] p-3 border border-[#EFEAE0]">
                  {incident.description}
                </p>

                {/* Admin / Resolution Response if present */}
                {incident.adminResponse && (
                  <div className="p-3 bg-emerald-50/70 border-l-3 border-l-emerald-700 border-y border-r border-emerald-200 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-950 mb-1">
                      <span className="flex items-center gap-1">
                        <Wrench className="w-3.5 h-3.5 text-emerald-800" />
                        Respuesta / Acción de la Administración:
                      </span>
                      {incident.resolvedAt && (
                        <span className="font-mono text-[10px] text-emerald-800 font-normal">
                          Resuelto: {new Date(incident.resolvedAt).toLocaleDateString('es-AR')}
                        </span>
                      )}
                    </div>
                    <p className="text-emerald-900 leading-snug">{incident.adminResponse}</p>
                  </div>
                )}
              </div>

              {/* Photo Attachment Thumbnail + Actions */}
              <div className="shrink-0 flex flex-col items-end gap-3 w-full md:w-auto">
                {incident.photoUrl ? (
                  <div
                    onClick={() => setLightboxPhoto({ url: incident.photoUrl!, title: incident.title })}
                    className="relative group cursor-pointer border border-[#DDD5BF] overflow-hidden shadow-2xs w-32 h-24 bg-neutral-100 flex items-center justify-center"
                  >
                    <img
                      src={incident.photoUrl}
                      alt={incident.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold uppercase gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver Foto</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-32 h-20 bg-[#F5F1E8] border border-dashed border-[#DDD5BF] flex flex-col items-center justify-center text-[#9E907B] text-[10px]">
                    <ImageIcon className="w-4 h-4 mb-1" />
                    <span>Sin foto adjunta</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => {
                          setRespondingIncident(incident);
                          setResponseStatus(incident.status === 'resuelto' ? 'resuelto' : 'en_reparacion');
                          setResponseText(incident.adminResponse || '');
                        }}
                        className="px-3 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#BFA270]" />
                        <span>Gestionar</span>
                      </button>

                      <button
                        onClick={() => handleDeleteIncident(incident.id)}
                        className="p-1.5 hover:bg-red-50 text-red-700 transition-colors cursor-pointer"
                        title="Eliminar reporte"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: New Incident Form */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#DED7C2] shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE0]">
              <h3 className="text-base font-bold text-[#163323] flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#1B3B2B]" />
                <span>Reportar Novedad o Desperfecto en la Estancia</span>
              </h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 hover:bg-[#FAF8F5] text-[#7A8E7E]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewIncident} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Título del Reporte / Resumen Breve
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="ej. Vidrio rajado en puerta de quincho, cafetera no enciende"
                  required
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Ubicación en la Casa
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="ej. Deck Pileta, Cocina, Suite 2"
                    required
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Categoría
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as IncidentReport['category'] })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  >
                    <option value="rotura">Rotura / Daño de Mobiliario o Vajilla</option>
                    <option value="desperfecto_tecnico">Desperfecto Eléctrico / Agua / Caldera</option>
                    <option value="faltante">Faltante de Ítem de Inventario</option>
                    <option value="limpieza">Higiene / Limpieza Especial</option>
                    <option value="mantenimiento">Mantenimiento General Parque / Pileta</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Nivel de Urgencia
                  </label>
                  <select
                    value={formData.urgency}
                    onChange={(e) => setFormData({ ...formData, urgency: e.target.value as IncidentUrgency })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  >
                    <option value="baja">Baja (Informativo / Para revisar)</option>
                    <option value="media">Media (Atención habitual del casero)</option>
                    <option value="alta">Alta (Afecta el confort de la estadía)</option>
                    <option value="urgente">Urgente (Requiere técnico de guardia)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Turno / Estadía Relacionada
                  </label>
                  <select
                    value={formData.bookingId}
                    onChange={(e) => setFormData({ ...formData, bookingId: e.target.value })}
                    className="w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0]"
                  >
                    <option value="">(Sin turno específico / General)</option>
                    {relevantBookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.checkInDate} al {b.checkOutDate} ({b.userName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Descripción Detallada
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Describa qué ocurrió, cómo se detectó o qué repuesto hace falta..."
                  required
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0]"
                />
              </div>

              {/* Photo Upload Area */}
              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Foto / Evidencia Fotográfica (Opcional pero recomendado)
                </label>

                {photoPreview ? (
                  <div className="relative border border-[#DDD5BF] p-2 bg-[#FAF8F5] flex items-center justify-between">
                    <img
                      src={photoPreview}
                      alt="Vista previa"
                      className="h-20 w-28 object-cover border border-[#DCD4C0]"
                    />
                    <div className="flex-1 px-3">
                      <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Foto lista para adjuntar
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPhotoPreview(null)}
                      className="px-2.5 py-1 bg-white hover:bg-red-50 border border-red-200 text-red-700 text-xs font-semibold"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-[#DCD4C0] hover:border-[#1B3B2B] p-4 bg-[#FAF8F5] flex flex-col items-center justify-center cursor-pointer transition-colors">
                    <Camera className="w-6 h-6 text-[#8C7A53] mb-1" />
                    <span className="text-xs font-semibold text-[#163323]">
                      Subir foto o capturar con cámara
                    </span>
                    <span className="text-[10px] text-[#7A8E7E]">PNG, JPG, WebP hasta 8MB</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#EFEAE0]">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 text-[#637568] hover:text-[#19231A]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#1B3B2B] text-white font-semibold uppercase tracking-wider hover:bg-[#132A1F] flex items-center gap-1.5 shadow-xs"
                >
                  <Camera className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>Enviar Reporte Oficial</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Manage / Response */}
      {respondingIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#DED7C2] shadow-2xl p-6">
            <h3 className="text-base font-bold text-[#163323] pb-3 border-b border-[#EFEAE0] flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#1B3B2B]" />
              <span>Gestión Administrativa de Novedad</span>
            </h3>

            <div className="mt-3 p-3 bg-[#FAF8F5] border border-[#EFEAE0] text-xs">
              <span className="font-bold text-[#163323] block">{respondingIncident.title}</span>
              <span className="text-[11px] text-[#637568]">Lugar: {respondingIncident.location} · {respondingIncident.reporterName}</span>
            </div>

            <form onSubmit={handleSaveAdminResponse} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Actualizar Estado de la Novedad
                </label>
                <select
                  value={responseStatus}
                  onChange={(e) => setResponseStatus(e.target.value as IncidentStatus)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold text-xs"
                >
                  <option value="pendiente">Pendiente de Revisión</option>
                  <option value="en_reparacion">En Reparación / Técnico Asignado</option>
                  <option value="resuelto">Resuelto / Solucionado</option>
                  <option value="desestimado">Desestimado / Sin Acción Requerida</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Respuesta Oficial / Detalle de la Solución
                </label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={3}
                  placeholder="Indique qué trabajo realizó el casero, fecha de arreglo o compra de reposición..."
                  required
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0]"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#EFEAE0]">
                <button
                  type="button"
                  onClick={() => setRespondingIncident(null)}
                  className="px-4 py-2 text-[#637568] hover:text-[#19231A]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#1B3B2B] text-white font-semibold uppercase tracking-wider hover:bg-[#132A1F]"
                >
                  Guardar y Notificar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Photo Preview Modal */}
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white max-w-3xl max-h-[90vh] overflow-hidden border border-[#DED7C2] shadow-2xl p-4 flex flex-col"
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#EFEAE0]">
              <span className="font-bold text-sm text-[#163323] truncate max-w-md">
                Foto: {lightboxPhoto.title}
              </span>
              <button
                onClick={() => setLightboxPhoto(null)}
                className="p-1 hover:bg-[#FAF8F5] text-[#163323] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-center max-h-[70vh] overflow-hidden bg-black/5">
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.title}
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
