import React, { useState, useEffect } from 'react';
import { User, DocumentItem, TrustSettings, hasPrivilegedAccess, isUserAdmin, isUserFiduciante, isUserCabezaDeEquipo } from '../types';
import { storageService } from '../services/storageService';
import { UserRoleBadge } from './UserRoleBadge';
import { BrandLogo } from './BrandLogo';
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
  Sparkles,
  Check,
  ExternalLink,
  BookOpen,
} from 'lucide-react';

interface ActasViewProps {
  currentUser: User;
  settings: TrustSettings;
  onGoBack?: () => void;
}

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
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newVersion, setNewVersion] = useState('Acta Ordinaria Libro II');
  const [newDescription, setNewDescription] = useState('');
  const [newFileSize, setNewFileSize] = useState('2.4 MB');

  useEffect(() => {
    const loadDocs = () => {
      const allDocs = storageService.getDocuments();
      // Filter category 'acta' or official contracts
      const actasOnly = allDocs.filter(
        (d) => d.category === 'acta' || d.category === 'contrato' || d.title.toLowerCase().includes('acta')
      );
      setDocuments(actasOnly);
    };
    loadDocs();
    const unsub = storageService.subscribe(loadDocs);
    return () => unsub();
  }, []);

  // Filtered list
  const filteredActas = documents.filter((acta) => {
    const matchesSearch =
      acta.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acta.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acta.version.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesYear =
      selectedYear === 'all' ||
      acta.date.includes(selectedYear) ||
      (selectedYear === '2026' && (acta.date.includes('2026') || acta.date.includes('/26'))) ||
      (selectedYear === '2025' && (acta.date.includes('2025') || acta.date.includes('/25')));

    return matchesSearch && matchesYear;
  });

  const handleCreateNewActa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newDoc: DocumentItem = {
      id: `doc-acta-${Date.now()}`,
      title: newTitle.trim(),
      category: 'acta',
      version: newVersion.trim() || 'Acta Oficial Notariada',
      date: newDate,
      fileSize: newFileSize.trim() || '1.8 MB',
      description: newDescription.trim() || 'Acta de Asamblea y decisiones fiduciarias de los copropietarios.',
    };

    storageService.saveDocument(newDoc);
    setIsNewActaModalOpen(false);
    setNewTitle('');
    setNewDescription('');
  };

  const handleDownloadActa = (acta: DocumentItem) => {
    const legalContent = `========================================================================
FIDEICOMISO "EL DESAYUNO SOCIEDAD" - LIBRO DE ACTAS NOTARIALES
========================================================================
DOCUMENTO: ${acta.title}
REGISTRO / VERSIÓN: ${acta.version}
FECHA PROTOCOLAR: ${acta.date}
ÓRGANO EMISOR: Asamblea General Fiduciaria & Administración General
ESTABLECIMIENTO: Estancia El Desayuno (Ruta Provincial 41, San Antonio de Areco)
========================================================================

RESUMEN EJECUTIVO:
${acta.description}

ORDEN DEL DÍA Y CONSTANCIAS LEGALES:
1. Quórum y Representación: Asistencia del 100% de las Partes Indivisas (Cabezas 1, 2, 3 y 4).
   - Presencia del Fiduciante Constitutivo y del Administrador General del Fideicomiso.
2. Tratamiento de los Puntos del Orden del Día conforme estatuto fiduciario y reglamentos de uso.
3. Resoluciones Aprobadas por Mayoría Calificada / Unanimidad según correspondiese.
4. Validez Notarial: El presente instrumento conforma constancia fehaciente en el Libro de Actas.

SUSCRIBEN:
- Administrador General: Efraín Rodríguez
- Fiduciante del Fideicomiso: Órgano de Control Fiduciario
- Cabeza 1 (25% Indiviso): Representante de Grupo
- Cabeza 2 (25% Indiviso): Representante de Grupo
- Cabeza 3 (25% Indiviso): Representante de Grupo
- Cabeza 4 (25% Indiviso): Representante de Grupo

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

          {(isAdmin || isFid) && (
            <button
              onClick={() => setIsNewActaModalOpen(true)}
              className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
            >
              <Plus className="w-4 h-4 text-[#BFA270]" />
              <span>+ Cargar Nueva Acta</span>
            </button>
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
            <span>Ejercicio:</span>
          </span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-1.5 bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-semibold text-[#163323] focus:outline-none cursor-pointer"
          >
            <option value="all">Todos los Períodos ({documents.length})</option>
            <option value="2026">Temporada 2026</option>
            <option value="2025">Temporada 2025</option>
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
                <span className="text-[11px] font-mono text-[#7A8E7E] flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#A68853]" />
                  <span>{acta.date}</span>
                </span>
              </div>

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
                Tamaño: {acta.fileSize}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDoc(acta)}
                  className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#F2EDE1] border border-[#DDD5BF] text-[#163323] font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="Leer acta completa con firmas y sellos"
                >
                  <Eye className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>Lectura Digital</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadActa(acta)}
                  className="px-3 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="Descargar copia del acta"
                >
                  <Download className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>Descargar</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredActas.length === 0 && (
        <div className="p-12 text-center bg-white border border-[#E3DFC8] text-[#7A8E7E] text-xs space-y-2">
          <BookOpen className="w-8 h-8 mx-auto text-[#DDD5BF]" />
          <p className="font-semibold text-sm text-[#163323]">No se encontraron actas registradas</p>
          <p>Pruebe con otros términos de búsqueda o modifique el filtro de ejercicio.</p>
        </div>
      )}

      {/* Reader Modal (Parchment Legal View) */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-2xl border border-[#D5CDBC] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
                    {selectedDoc.version} · Fecha {selectedDoc.date}
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
              <div className="p-4 bg-white border border-[#E5DEC9] shadow-2xs space-y-3">
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
                    Protocolo Notarial · {selectedDoc.date} · Estancia El Desayuno, San Antonio de Areco
                  </span>
                </div>

                <div className="space-y-2 text-justify">
                  <p>
                    <strong>VISTO Y CONSIDERANDO:</strong> Las facultades conferidas por el Contrato Fiduciario Constitutivo celebrado entre los copropietarios de las cuatro partes indivisas (25% cada una) de la Estancia El Desayuno.
                  </p>
                  <p>
                    <strong>SUMARIO DE RESOLUCIONES:</strong> {selectedDoc.description}
                  </p>
                  <p>
                    <strong>RÉGIMEN Y CUMPLIMIENTO:</strong> Se deja constancia de la plena conformidad del Administrador General, del Órgano Fiduciario y de los representantes (Cabezas de Equipo) de los grupos indivisos, disponiéndose su incorporación al Libro de Actas formal del Fideicomiso y notificación general a través del portal de gestión.
                  </p>
                </div>

                <div className="pt-4 border-t border-[#EFEAE0]">
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
                <span>Descargar Copia Certificada</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-lg border border-[#D5CDBC] shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-[#17341B] text-[#FAF8F5] flex items-center justify-between shrink-0">
              <h3
                className="text-base font-bold tracking-wide"
                style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
              >
                Registrar Nueva Acta de Asamblea
              </h3>
              <button
                onClick={() => setIsNewActaModalOpen(false)}
                className="text-[#C9D6CC] hover:text-white p-1 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewActa} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Título del Acta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Acta N° 14 - Asamblea Extraordinaria: Aprobación de Presupuesto"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold text-sm focus:outline-none focus:border-[#163323]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Fecha de Celebración *
                  </label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold focus:outline-none focus:border-[#163323]"
                  />
                </div>
                <div>
                  <label className="block font-semibold uppercase text-[#35483A] mb-1">
                    Libro / Folio / Registro
                  </label>
                  <input
                    type="text"
                    value={newVersion}
                    onChange={(e) => setNewVersion(e.target.value)}
                    placeholder="ej. Acta Ordinaria Libro II"
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold focus:outline-none focus:border-[#163323]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Resumen Ejecutivo & Resoluciones *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Detalle los puntos aprobados, quórum, rendición de gastos o acuerdos tomados por las Cabezas..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] focus:outline-none focus:border-[#163323] leading-relaxed"
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
    </div>
  );
};
