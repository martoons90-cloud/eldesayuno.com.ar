import React, { useState, useEffect } from 'react';
import { HouseRule, UsefulContact, DocumentItem, TrustSettings } from '../types';
import { storageService } from '../services/storageService';
import {
  BookOpen,
  Wifi,
  Phone,
  FileText,
  Clock,
  Users,
  Dog,
  Waves,
  Flame,
  Volume2,
  Copy,
  Check,
  Download,
  Eye,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface HouseGuideViewProps {
  settings: TrustSettings;
}

export const HouseGuideView: React.FC<HouseGuideViewProps> = ({ settings }) => {
  const [activeSubTab, setActiveSubTab] = useState<'rules' | 'contacts' | 'wifi' | 'documents'>('rules');
  const [copiedWifi, setCopiedWifi] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  const [rules, setRules] = useState<HouseRule[]>(storageService.getRules());
  const [contacts, setContacts] = useState<UsefulContact[]>(storageService.getContacts());
  const [documents, setDocuments] = useState<DocumentItem[]>(storageService.getDocuments());

  useEffect(() => {
    setRules(storageService.getRules());
    setContacts(storageService.getContacts());
    setDocuments(storageService.getDocuments());
  }, []);

  const handleCopyWifi = () => {
    navigator.clipboard.writeText(settings.wifiPassword);
    setCopiedWifi(true);
    setTimeout(() => setCopiedWifi(false), 2500);
  };

  const getRuleIcon = (name: string) => {
    switch (name) {
      case 'Clock':
        return <Clock className="w-5 h-5 text-[#1B3B2B]" />;
      case 'Users':
        return <Users className="w-5 h-5 text-[#1B3B2B]" />;
      case 'Dog':
        return <Dog className="w-5 h-5 text-[#1B3B2B]" />;
      case 'Waves':
        return <Waves className="w-5 h-5 text-[#1B3B2B]" />;
      case 'Flame':
        return <Flame className="w-5 h-5 text-[#1B3B2B]" />;
      case 'Volume2':
        return <Volume2 className="w-5 h-5 text-[#1B3B2B]" />;
      default:
        return <BookOpen className="w-5 h-5 text-[#1B3B2B]" />;
    }
  };

  const handleDownloadDoc = (doc: DocumentItem) => {
    // Generate text/pdf simulation download
    const content = `=====================================================
FIDEICOMISO "EL DESAYUNO SOCIEDAD"
${doc.title}
Versión: ${doc.version} · Fecha: ${doc.date}
=====================================================

DESCRIPCIÓN:
${doc.description}

DISPOSICIONES PRINCIPALES:
1. Cuatro Partes Indivisas de igual proporción (25% cada una).
2. Asignación de 30 días anuales por copropietario.
3. Reglas de uso exclusivo para beneficiarios y familiares directos.
4. Mantenimiento del orden edilicio, piscina, quincho y parque.
5. Vigencia del período 2026.

Fiduciario Administrador: Martín Benítez
Estancia El Desayuno - San Antonio de Areco / Mercedes
=====================================================`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${doc.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-[#8C7A53] block">
            Guía de Estadía y Fideicomiso
          </span>
          <h2
            className="text-2xl font-bold text-[#163323]"
            style={{ fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif" }}
          >
            Información, Convivencia y Documentación
          </h2>
          <p className="text-xs text-[#526657] mt-1">
            Normas de uso, contactos de guardia, credenciales Wi-Fi e instrumentos societarios.
          </p>
        </div>

        {/* Sub-tabs bar */}
        <div className="inline-flex p-1 bg-[#F4EFE6] border border-[#DCD4C0] self-start sm:self-auto flex-wrap">
          <button
            onClick={() => setActiveSubTab('rules')}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
              activeSubTab === 'rules'
                ? 'bg-[#1B3B2B] text-white shadow-xs'
                : 'text-[#4F6254] hover:text-[#19231A]'
            }`}
          >
            Reglamento
          </button>
          <button
            onClick={() => setActiveSubTab('contacts')}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
              activeSubTab === 'contacts'
                ? 'bg-[#1B3B2B] text-white shadow-xs'
                : 'text-[#4F6254] hover:text-[#19231A]'
            }`}
          >
            Contactos Útiles
          </button>
          <button
            onClick={() => setActiveSubTab('wifi')}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
              activeSubTab === 'wifi'
                ? 'bg-[#1B3B2B] text-white shadow-xs'
                : 'text-[#4F6254] hover:text-[#19231A]'
            }`}
          >
            Wi-Fi & Servicios
          </button>
          <button
            onClick={() => setActiveSubTab('documents')}
            className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
              activeSubTab === 'documents'
                ? 'bg-[#1B3B2B] text-white shadow-xs'
                : 'text-[#4F6254] hover:text-[#19231A]'
            }`}
          >
            Documentos PDF
          </button>
        </div>
      </div>

      {/* 1. REGLAMENTO DE CONVIVENCIA */}
      {activeSubTab === 'rules' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="bg-[#FFFFFF] border border-[#E3DFC8] p-5 shadow-xs flex items-start gap-4"
              >
                <div className="p-2.5 bg-[#FAF8F5] border border-[#E8E2D2] shrink-0">
                  {getRuleIcon(rule.iconName)}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#163323]">{rule.title}</h4>
                  <p className="text-xs text-[#4F6254] mt-1.5 leading-relaxed">
                    {rule.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Special notice card */}
          <div className="p-5 bg-[#FAF8F5] border border-[#E3DFC8] text-xs text-[#3E5244] flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#8C7A53] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#163323] block text-sm">
                Compromiso de las Cuatro Partes
              </span>
              <p className="mt-1 leading-relaxed">
                El cuidado de la infraestructura, los muebles coloniales, la vajilla y las
                instalaciones es responsabilidad compartida. Ante cualquier desperfecto surgido
                durante su estadía, favor de avisar inmediatamente a Don Raúl (Casero) para su
                reparación sin demoras para el próximo turno.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. CONTACTOS ÚTILES Y EMERGENCIAS */}
      {activeSubTab === 'contacts' && (
        <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs">
          <div className="pb-4 mb-4 border-b border-[#EFEAE0]">
            <h3 className="text-base font-bold text-[#163323]">
              Directorio de Contactos de Emergencia y Personal de Campo
            </h3>
            <p className="text-xs text-[#7A8E7E] mt-0.5">
              Disponible las 24 hs para resolución de contingencias en la estancia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contacts.map((cnt) => (
              <div
                key={cnt.id}
                className={`p-4 border flex flex-col justify-between ${
                  cnt.isEmergency
                    ? 'bg-[#FFFDFB] border-red-200'
                    : 'bg-[#FAF8F5] border-[#E8E2D2]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        cnt.isEmergency ? 'text-red-700' : 'text-[#8C7A53]'
                      }`}
                    >
                      {cnt.category.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-[#7A8E7E]">{cnt.availableHours}</span>
                  </div>
                  <h4 className="text-sm font-bold text-[#163323] mt-1">{cnt.name}</h4>
                  <p className="text-xs text-[#4F6254] font-medium">{cnt.role}</p>

                  {cnt.notes && (
                    <p className="text-[11px] text-[#637568] mt-2 bg-white p-2 border border-[#EDE7D8]">
                      {cnt.notes}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[#EFEAE0] flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#17341B] flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#BFA270]" />
                    {cnt.phone}
                  </span>
                  <a
                    href={`tel:${cnt.phone.replace(/[^0-9+]/g, '')}`}
                    className="text-[11px] font-semibold text-[#1B3B2B] hover:underline"
                  >
                    Llamar →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. WI-FI Y SERVICIOS */}
      {activeSubTab === 'wifi' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Wi-Fi Card */}
          <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 pb-4 border-b border-[#EFEAE0]">
                <Wifi className="w-5 h-5 text-[#1B3B2B]" />
                <h3 className="text-base font-bold text-[#163323]">
                  Conexión Wi-Fi de la Estancia
                </h3>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-[#6C7E70] block">
                    Nombre de Red (SSID)
                  </span>
                  <div className="mt-1 p-3 bg-[#FAF8F5] border border-[#E0D9C5] font-mono text-sm font-bold text-[#163323]">
                    {settings.wifiSsid}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-[#6C7E70] block">
                    Contraseña de Acceso
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 p-3 bg-[#FAF8F5] border border-[#E0D9C5] font-mono text-sm font-bold text-[#163323] select-all">
                      {settings.wifiPassword}
                    </div>
                    <button
                      onClick={handleCopyWifi}
                      className="px-3.5 py-3 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                    >
                      {copiedWifi ? (
                        <>
                          <Check className="w-4 h-4 text-[#BFA270]" />
                          <span>¡Copiada!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-[#F8F5EE] border border-[#E6E0CF] text-xs text-[#526657]">
                  <p className="font-semibold text-[#163323] mb-1">Cobertura del Servicio:</p>
                  <p>
                    {settings.wifiCoverageNotes ||
                      'La red cuenta con repetidores mesh cubriendo la Casa Principal, Quincho, Solárium y Galerías Exteriores. Velocidad simétrica por enlace de fibra rural.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#EFEAE0] text-[11px] text-[#7A8E7E]">
              Router ubicado en el mueble del escritorio del living principal.
            </div>
          </div>

          {/* QR & Equipamiento */}
          <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="pb-4 border-b border-[#EFEAE0]">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#A68853]">
                  Conexión Instantánea por Móvil
                </span>
                <h3 className="text-base font-bold text-[#163323] mt-0.5">
                  Escanear Código QR
                </h3>
              </div>

              <div className="mt-5 flex flex-col items-center justify-center p-6 bg-[#FAF8F5] border border-[#E8E2D2]">
                {/* Visual QR Code Generator Simulation */}
                <div className="w-44 h-44 bg-white p-3 border-2 border-[#163323] shadow-xs flex flex-col items-center justify-center">
                  <div className="grid grid-cols-6 gap-1 w-full h-full p-2 bg-neutral-900">
                    <div className="bg-white col-span-2 row-span-2" />
                    <div className="bg-white col-span-2" />
                    <div className="bg-white col-span-2 row-span-2" />
                    <div className="bg-white" />
                    <div className="bg-white col-span-2" />
                    <div className="bg-white" />
                    <div className="bg-white col-span-2 row-span-2" />
                    <div className="bg-white col-span-2" />
                    <div className="bg-white col-span-2 row-span-2" />
                  </div>
                </div>
                <span className="text-xs font-semibold text-[#163323] mt-3">
                  Apunta con la cámara de tu celular
                </span>
                <span className="text-[10px] text-[#7A8E7E]">
                  Se conectará automáticamente a {settings.wifiSsid}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#EFEAE0] text-xs text-[#526657]">
              En caso de corte de energía, el grupo electrógeno automático mantiene encendido el
              sistema de Wi-Fi y heladeras.
            </div>
          </div>
        </div>
      )}

      {/* 4. DOCUMENTOS DEL FIDEICOMISO (PDF) */}
      {activeSubTab === 'documents' && (
        <div className="bg-[#FFFFFF] border border-[#E3DFC8] p-6 shadow-xs">
          <div className="pb-4 mb-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#163323]">
                Biblioteca Documental del Fideicomiso El Desayuno
              </h3>
              <p className="text-xs text-[#7A8E7E] mt-0.5">
                Actas societarias, reglamentos, contratos fiduciarios y manuales técnicos.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8F5EE] border-b border-[#E3DFC8] text-[#55695B] uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-3">Categoría</th>
                  <th className="py-3 px-3">Versión / Fecha</th>
                  <th className="py-3 px-3">Tamaño</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEAE0]">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-[#163323]">
                      <div className="flex items-start gap-2.5">
                        <FileText className="w-4 h-4 text-[#8C7A53] shrink-0 mt-0.5" />
                        <div>
                          <span>{doc.title}</span>
                          <span className="block text-[11px] text-[#7A8E7E] font-normal mt-0.5">
                            {doc.description}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#637568]">
                        {doc.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-[#4F6254]">
                      <span className="font-semibold block">{doc.version}</span>
                      <span className="text-[10px] text-[#7A8E7E]">{doc.date}</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono tabular-nums text-[#637568]">
                      {doc.fileSize}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="px-2.5 py-1.5 bg-white hover:bg-[#FAF8F5] border border-[#DDD5BF] text-xs font-semibold text-[#163323] transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#8C7A53]" />
                          <span>Ver</span>
                        </button>
                        <button
                          onClick={() => handleDownloadDoc(doc)}
                          className="px-2.5 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5 text-[#BFA270]" />
                          <span>Descargar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-[#FFFFFF] w-full max-w-2xl border border-[#DED7C2] shadow-2xl flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-[#17341B] text-[#FAF8F5] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#BFA270]" />
                <div>
                  <h3
                    className="text-base font-bold"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    {previewDoc.title}
                  </h3>
                  <span className="text-[11px] text-[#C9D6CC]">
                    {previewDoc.version} · Fecha: {previewDoc.date}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-[#C9D6CC] hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 text-xs space-y-4 bg-[#FAF8F5] font-serif leading-relaxed text-[#19231A]">
              <div className="p-4 bg-white border border-[#E3DFC8] text-center">
                <h4 className="font-bold text-sm uppercase tracking-wider text-[#163323]">
                  Fideicomiso El Desayuno Sociedad
                </h4>
                <p className="text-[11px] text-[#7A8E7E]">
                  Instrumento de Registro Notarial y Asignación de Turnos
                </p>
              </div>

              <div className="p-4 bg-white border border-[#E3DFC8] space-y-3">
                <p className="font-bold text-[#163323]">1. Objeto y Alcance:</p>
                <p className="text-[#4E6152]">{previewDoc.description}</p>

                <p className="font-bold text-[#163323] pt-2">2. Cláusulas Notariales:</p>
                <p className="text-[#4E6152]">
                  Las partes acuerdan que la presente reglamentación rige para el año en curso
                  (2026), estableciendo una asignación equitativa de 30 días de estadía anual para cada
                  uno de los cuatro socios fundadores, respetando la regla de indivisión y cuidado de
                  bienes comunes.
                </p>

                <p className="font-bold text-[#163323] pt-2">3. Mantenimiento y Responsabilidad:</p>
                <p className="text-[#4E6152]">
                  Cualquier intervención edilicia o gasto extraordinario será evaluado y administrado
                  por el Fiduciario Martín Benítez con rendición semestral a los cuatro fiduciantes.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-[#EFEAE0] bg-white flex items-center justify-between">
              <span className="text-xs text-[#7A8E7E]">Tamaño: {previewDoc.fileSize}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#637568] hover:text-[#19231A] cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    handleDownloadDoc(previewDoc);
                    setPreviewDoc(null);
                  }}
                  className="px-4 py-2 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>Descargar Archivo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
