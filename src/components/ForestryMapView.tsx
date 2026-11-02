import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Box,
  Check,
  CircleDot,
  Edit3,
  Eraser,
  FileSpreadsheet,
  Layers,
  MapPinned,
  MousePointer2,
  Plus,
  Scale,
  Trash2,
  TreePine,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface ForestryMapViewProps {
  onGoToIncome: () => void;
}

export type LotStatus = 'extraido' | 'trabajando' | 'vacio';

export interface LotStatusConfig {
  id: LotStatus;
  label: string;
  fill: string;
  stroke: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

export const LOT_STATUSES: Record<LotStatus, LotStatusConfig> = {
  extraido: {
    id: 'extraido',
    label: 'Extraído',
    fill: '#22C55E', // Verde
    stroke: '#15803D',
    textColor: 'text-emerald-800',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
    description: 'Madera extraída / cosechada',
  },
  trabajando: {
    id: 'trabajando',
    label: 'Trabajando',
    fill: '#EAB308', // Amarillo / Dorado
    stroke: '#A16207',
    textColor: 'text-amber-800',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    description: 'En proceso de tala / cuadrilla activa',
  },
  vacio: {
    id: 'vacio',
    label: 'Vacío',
    fill: '#EF4444', // Rojo
    stroke: '#B91C1C',
    textColor: 'text-rose-800',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-300',
    description: 'Lote virgen / sin intervención',
  },
};

export interface MarkedLot {
  id: string;
  x: number;
  y: number;
  r: number;
  status: LotStatus;
  padron: string;
  manzana: string;
  lote: string;
  extractedUnit: 'm3' | 'toneladas';
  extractedAmount: number;
  notes?: string;
  updatedAt: string;
}

const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;
const SVG_SOURCE = '/forestry-plan.svg?v=2.33.00-clean';
const STORAGE_KEY = 'eldesayuno_forestry_marked_lots_v1';
const DEFAULT_RADIUS = 0.065; // Medida exacta calibrada para entrar dentro del lote

export const ForestryMapView: React.FC<ForestryMapViewProps> = ({ onGoToIncome }) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const hasInitialScrolledRef = useRef(false);

  // Inicializar lotes desde localStorage si existen
  const [markedLots, setMarkedLots] = useState<MarkedLot[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error al cargar lotes guardados:', e);
    }
    return [];
  });

  const [zoom, setZoom] = useState(50); // 5000% zoom inicial
  const prevZoomRef = useRef(zoom);
  const [viewportBox, setViewportBox] = useState({ left: 0, top: 0, width: 100, height: 100 });
  const [message, setMessage] = useState('Hacé clic en cualquier lote para abrir su ficha y registrar los datos.');

  // Estado del modal de registro/edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<MarkedLot | null>(null);
  const [pendingCoords, setPendingCoords] = useState<{ x: number; y: number } | null>(null);

  // Campos del formulario
  const [formStatus, setFormStatus] = useState<LotStatus>('extraido');
  const [formPadron, setFormPadron] = useState('');
  const [formManzana, setFormManzana] = useState('');
  const [formLote, setFormLote] = useState('');
  const [formUnit, setFormUnit] = useState<'m3' | 'toneladas'>('m3');
  const [formAmount, setFormAmount] = useState<string>('0');
  const [formNotes, setFormNotes] = useState('');

  // Persistir en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(markedLots));
    } catch (e) {
      console.error('Error al guardar lotes:', e);
    }
  }, [markedLots]);

  const syncMinimap = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const displayWidth = Math.round(MAP_WIDTH * zoom);
    const displayHeight = Math.round(MAP_HEIGHT * zoom);
    if (displayWidth <= 0 || displayHeight <= 0) return;

    setViewportBox({
      left: Math.max(0, Math.min(100, (viewport.scrollLeft / displayWidth) * 100)),
      top: Math.max(0, Math.min(100, (viewport.scrollTop / displayHeight) * 100)),
      width: Math.min(100, (viewport.clientWidth / displayWidth) * 100),
      height: Math.min(100, (viewport.clientHeight / displayHeight) * 100),
    });
  };

  // Centrado inicial automático en la zona de parcelas
  useEffect(() => {
    if (!hasInitialScrolledRef.current && viewportRef.current) {
      hasInitialScrolledRef.current = true;
      const displayW = Math.round(MAP_WIDTH * zoom);
      const displayH = Math.round(MAP_HEIGHT * zoom);
      const targetX = Math.round(0.48 * displayW - viewportRef.current.clientWidth / 2);
      const targetY = Math.round(0.49 * displayH - viewportRef.current.clientHeight / 2);
      viewportRef.current.scrollLeft = Math.max(0, targetX);
      viewportRef.current.scrollTop = Math.max(0, targetY);
      requestAnimationFrame(syncMinimap);
    }
  }, []);

  // Mantener centrado suave cuando cambia el zoom
  useEffect(() => {
    const prev = prevZoomRef.current;
    if (prev !== zoom && viewportRef.current) {
      const ratio = zoom / prev;
      const vp = viewportRef.current;
      const centerX = vp.scrollLeft + vp.clientWidth / 2;
      const centerY = vp.scrollTop + vp.clientHeight / 2;
      vp.scrollLeft = Math.max(0, Math.round(centerX * ratio - vp.clientWidth / 2));
      vp.scrollTop = Math.max(0, Math.round(centerY * ratio - vp.clientHeight / 2));
      prevZoomRef.current = zoom;
      requestAnimationFrame(syncMinimap);
    }
  }, [zoom]);

  // Al hacer clic en el mapa: detectar si es un lote existente o uno nuevo
  const handleMapClick = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - bounds.left;
    const clickY = event.clientY - bounds.top;

    const svgX = Number(((clickX / bounds.width) * MAP_WIDTH).toFixed(3));
    const svgY = Number(((clickY / bounds.height) * MAP_HEIGHT).toFixed(3));

    // Radio de detección adaptable al zoom (~10 píxeles de tolerancia)
    const hitRadiusSvg = Math.max(0.10, 10 / zoom);
    const existing = markedLots.find(
      (lot) => Math.hypot(lot.x - svgX, lot.y - svgY) <= Math.max(lot.r * 1.5, hitRadiusSvg)
    );

    if (existing) {
      // Abrir para editar el lote existente
      setEditingLot(existing);
      setPendingCoords(null);
      setFormStatus(existing.status);
      setFormPadron(existing.padron);
      setFormManzana(existing.manzana);
      setFormLote(existing.lote);
      setFormUnit(existing.extractedUnit);
      setFormAmount(existing.extractedAmount ? existing.extractedAmount.toString() : '0');
      setFormNotes(existing.notes || '');
      setIsModalOpen(true);
      return;
    }

    // Nuevo lote: abrir modal para cargar sus datos
    setEditingLot(null);
    setPendingCoords({ x: svgX, y: svgY });
    setFormStatus('extraido'); // Por defecto Extraído (Verde)
    setFormPadron('');
    setFormManzana('');
    setFormLote('');
    setFormUnit('m3');
    setFormAmount('0');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleSaveLot = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = parseFloat(formAmount) || 0;
    const nowIso = new Date().toISOString();

    if (editingLot) {
      // Actualizar existente
      setMarkedLots((prev) =>
        prev.map((lot) =>
          lot.id === editingLot.id
            ? {
                ...lot,
                status: formStatus,
                padron: formPadron.trim() || 'S/N',
                manzana: formManzana.trim(),
                lote: formLote.trim(),
                extractedUnit: formUnit,
                extractedAmount: parsedAmount,
                notes: formNotes.trim(),
                updatedAt: nowIso,
              }
            : lot
        )
      );
      setMessage(`Lote ${formManzana ? `Mz ${formManzana} ` : ''}${formLote ? `Lote ${formLote}` : ''} actualizado.`);
    } else if (pendingCoords) {
      // Crear nuevo
      const newLot: MarkedLot = {
        id: `lot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        x: pendingCoords.x,
        y: pendingCoords.y,
        r: DEFAULT_RADIUS,
        status: formStatus,
        padron: formPadron.trim() || 'S/N',
        manzana: formManzana.trim(),
        lote: formLote.trim(),
        extractedUnit: formUnit,
        extractedAmount: parsedAmount,
        notes: formNotes.trim(),
        updatedAt: nowIso,
      };

      setMarkedLots((prev) => [...prev, newLot]);
      setMessage(`Lote guardado con éxito. Total registrados: ${markedLots.length + 1}.`);
    }

    setIsModalOpen(false);
    setEditingLot(null);
    setPendingCoords(null);
  };

  const handleDeleteLot = () => {
    if (!editingLot) return;
    setMarkedLots((prev) => prev.filter((lot) => lot.id !== editingLot.id));
    setMessage(`Lote eliminado del plano.`);
    setIsModalOpen(false);
    setEditingLot(null);
  };

  const resetAll = () => {
    if (markedLots.length === 0) return;
    if (window.confirm('¿Seguro que querés limpiar todos los lotes marcados de la prueba?')) {
      setMarkedLots([]);
      setMessage('Plano restablecido. Podés volver a registrar lotes.');
    }
  };

  const focusFromMinimap = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    const displayW = Math.round(MAP_WIDTH * zoom);
    const displayH = Math.round(MAP_HEIGHT * zoom);
    viewport.scrollLeft = Math.max(0, Math.round(x * displayW - viewport.clientWidth / 2));
    viewport.scrollTop = Math.max(0, Math.round(y * displayH - viewport.clientHeight / 2));
    syncMinimap();
  };

  const jumpToLot = (lot: MarkedLot) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const displayW = Math.round(MAP_WIDTH * zoom);
    const displayH = Math.round(MAP_HEIGHT * zoom);
    const targetX = (lot.x / MAP_WIDTH) * displayW - viewport.clientWidth / 2;
    const targetY = (lot.y / MAP_HEIGHT) * displayH - viewport.clientHeight / 2;
    viewport.scrollLeft = Math.max(0, Math.round(targetX));
    viewport.scrollTop = Math.max(0, Math.round(targetY));
    syncMinimap();
  };

  // Cálculos de resumen
  const extraidos = markedLots.filter((l) => l.status === 'extraido');
  const trabajando = markedLots.filter((l) => l.status === 'trabajando');
  const vacios = markedLots.filter((l) => l.status === 'vacio');

  const totalM3 = markedLots
    .filter((l) => l.extractedUnit === 'm3')
    .reduce((acc, l) => acc + (l.extractedAmount || 0), 0);

  const totalTon = markedLots
    .filter((l) => l.extractedUnit === 'toneladas')
    .reduce((acc, l) => acc + (l.extractedAmount || 0), 0);

  return (
    <div className="max-w-[1440px] mx-auto space-y-5 animate-fade-in pb-10">
      {/* Header superior */}
      <section className="bg-white border border-[#E3DFC8] p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            <TreePine className="w-4 h-4" /> Control forestal · Registro y extracción de lotes
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#163323] mt-1" style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}>
            Mapa de deforestación
          </h1>
          <p className="text-xs text-[#526657] mt-1 max-w-2xl">
            Hacé clic en cualquier cuadradito para abrir la ficha de lote (Padrón, Manzana, Lote, Extracción en m³ o Toneladas y Estado con su color).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetAll}
            disabled={markedLots.length === 0}
            className="px-3 py-2 bg-white border border-[#DCD4C0] text-xs font-bold uppercase tracking-wider text-[#163323] hover:bg-[#F4EFE6] disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
          >
            <Eraser className="w-3.5 h-3.5" /> Limpiar prueba
          </button>
          <button
            type="button"
            onClick={onGoToIncome}
            className="px-3 py-2 bg-[#1B3B2B] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#132A1F] flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#BFA270]" /> Ir a Ingresos
          </button>
        </div>
      </section>

      {/* Área principal: Plano + Barra lateral */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        {/* Contenedor del Plano */}
        <div className="bg-white border border-[#DCD4C0] shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-[#163323] text-white flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <MapPinned className="w-4 h-4 text-[#BFA270]" /> Plano Forestal · Detalle de lotes (Vectorial)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-emerald-100 hidden md:inline">Tocá un lote para editar o registrar</span>
              <div className="flex items-center bg-black/30 rounded px-1.5 py-0.5 border border-white/10 gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.max(10, prev - 10))}
                  disabled={zoom <= 10}
                  className="p-1 hover:bg-white/20 disabled:opacity-30 rounded cursor-pointer transition-colors"
                  title="Alejar (1000%)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-bold min-w-16 text-center text-[#F4EFE6]">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.min(100, prev + 10))}
                  disabled={zoom >= 100}
                  className="p-1 hover:bg-white/20 disabled:opacity-30 rounded cursor-pointer transition-colors"
                  title="Acercar (1000%)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="hidden sm:flex items-center gap-1 bg-black/30 p-0.5 rounded border border-white/10">
                {[20, 30, 50, 75].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setZoom(level)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                      zoom === level
                        ? 'bg-[#BFA270] text-[#163323]'
                        : 'text-white/80 hover:text-white hover:bg-white/15'
                    }`}
                  >
                    {level * 100}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div ref={viewportRef} onScroll={syncMinimap} className="p-3 sm:p-5 bg-[#F7F7F5] overflow-auto h-[72vh] min-h-[520px]">
            <div
              style={{
                width: `${Math.round(MAP_WIDTH * zoom)}px`,
                height: `${Math.round(MAP_HEIGHT * zoom)}px`,
                position: 'relative',
                maxWidth: 'none',
              }}
              onPointerDown={handleMapClick}
              className="bg-white border border-[#202020] shadow-sm mx-auto select-none cursor-crosshair"
            >
              {/* Plano CAD Vectorial limpio con líneas finas nítidas */}
              <img
                src={SVG_SOURCE}
                alt="Plano forestal vectorial CAD limpio"
                className="w-full h-full block select-none pointer-events-none"
                draggable={false}
              />

              {/* Capa de puntos de color dentro de cada lote */}
              <svg
                viewBox="0 0 800 600"
                className="absolute inset-0 w-full h-full pointer-events-none"
                preserveAspectRatio="none"
              >
                {markedLots.map((lot) => {
                  const cfg = LOT_STATUSES[lot.status] || LOT_STATUSES.extraido;
                  return (
                    <g key={lot.id}>
                      <circle
                        cx={lot.x}
                        cy={lot.y}
                        r={lot.r || DEFAULT_RADIUS}
                        fill={cfg.fill}
                        stroke="#0B1A10"
                        strokeWidth={0.012}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* Barra lateral */}
        <aside className="bg-white border border-[#E3DFC8] shadow-xs p-4 space-y-4 text-xs">
          <div className="flex items-center gap-2 text-[#163323] font-bold uppercase tracking-wider">
            <Layers className="w-4 h-4 text-emerald-700" /> Control de lotes
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-950 leading-relaxed rounded">
            {message}
          </div>

          {/* Leyenda de estados */}
          <div className="border border-[#E5DEC9] p-3 bg-[#FAF8F5] space-y-2.5 rounded">
            <p className="font-bold text-[#35483A] uppercase tracking-wide text-[10px]">Estados del lote</p>
            <div className="space-y-1.5">
              {(Object.keys(LOT_STATUSES) as LotStatus[]).map((stKey) => {
                const cfg = LOT_STATUSES[stKey];
                const count = markedLots.filter((l) => l.status === stKey).length;
                return (
                  <div key={stKey} className="flex items-center justify-between p-1.5 rounded bg-white border border-[#E7DFCF]">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full border shrink-0"
                        style={{ backgroundColor: cfg.fill, borderColor: cfg.stroke }}
                      />
                      <span className="font-semibold text-[#163323]">{cfg.label}</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#163323] bg-[#F7F4EE] px-2 py-0.5 rounded">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totales de extracción */}
          <div className="border border-[#E5DEC9] p-3 bg-[#FAF8F5] space-y-2 rounded">
            <p className="font-bold text-[#35483A] uppercase tracking-wide text-[10px] flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Extracción acumulada
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-[#EAE3D2]">
                <span className="text-[#637568] flex items-center gap-1">
                  <Box className="w-3 h-3 text-[#BFA270]" /> Total en m³
                </span>
                <strong className="font-mono text-[#163323]">{totalM3.toLocaleString('es-AR')} m³</strong>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[#637568] flex items-center gap-1">
                  <Scale className="w-3 h-3 text-[#BFA270]" /> Total en Toneladas
                </span>
                <strong className="font-mono text-[#163323]">{totalTon.toLocaleString('es-AR')} ton</strong>
              </div>
            </div>
          </div>

          {/* Minimapa */}
          <div className="border border-[#E5DEC9] p-3 bg-[#FAF8F5] space-y-2 rounded">
            <p className="font-bold text-[#35483A] uppercase tracking-wide text-[10px]">Mapa general</p>
            <div
              onPointerDown={focusFromMinimap}
              className="relative aspect-[4/3] bg-white border border-[#202020] cursor-pointer overflow-hidden rounded-xs"
              title="Tocá una zona para ir allí"
            >
              <img
                src={SVG_SOURCE}
                alt="Vista general de todo el plano forestal"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              />
              <svg viewBox="0 0 800 600" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                {markedLots.map((lot) => {
                  const cfg = LOT_STATUSES[lot.status] || LOT_STATUSES.extraido;
                  return (
                    <circle
                      key={lot.id}
                      cx={lot.x}
                      cy={lot.y}
                      r={2.5}
                      fill={cfg.fill}
                      stroke="#0F172A"
                      strokeWidth={0.5}
                    />
                  );
                })}
              </svg>
              <div
                className="absolute border-2 border-[#E8B64B] bg-[#E8B64B]/15 pointer-events-none"
                style={{
                  left: `${viewportBox.left}%`,
                  top: `${viewportBox.top}%`,
                  width: `${viewportBox.width}%`,
                  height: `${viewportBox.height}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-[#637568] leading-relaxed">
              El marco dorado indica la zona visible. Tocá para moverte rápidamente.
            </p>
          </div>

          {/* Lista de últimos lotes registrados */}
          {markedLots.length > 0 && (
            <div className="border border-[#E5DEC9] p-3 bg-[#FAF8F5] space-y-2 rounded max-h-56 overflow-y-auto">
              <p className="font-bold text-[#35483A] uppercase tracking-wide text-[10px]">
                Lotes registrados ({markedLots.length})
              </p>
              <div className="space-y-1">
                {markedLots.slice(-6).reverse().map((lot) => {
                  const cfg = LOT_STATUSES[lot.status] || LOT_STATUSES.extraido;
                  return (
                    <button
                      key={lot.id}
                      type="button"
                      onClick={() => jumpToLot(lot)}
                      className="w-full text-left p-1.5 bg-white border border-[#EAE3D2] rounded hover:border-[#163323] flex items-center justify-between gap-1 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.fill }} />
                        <span className="font-semibold text-[#163323] truncate">
                          {lot.manzana ? `Mz ${lot.manzana} ` : ''}{lot.lote ? `Lote ${lot.lote}` : `Padrón ${lot.padron}`}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#637568] shrink-0">
                        {lot.extractedAmount > 0 ? `${lot.extractedAmount} ${lot.extractedUnit}` : cfg.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t border-[#E8E2D2] pt-3 text-[#637568] leading-relaxed flex gap-2">
            <MousePointer2 className="w-4 h-4 shrink-0 text-[#BFA270]" />
            Hacé clic en cualquier lote para registrar o editar sus datos. Los puntos se guardan automáticamente.
          </div>
        </aside>
      </section>

      {/* Modal / Formulario para el Lote */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#DCD4C0] shadow-xl w-full max-w-md overflow-hidden rounded">
            {/* Header del Modal */}
            <div className="px-5 py-4 bg-[#163323] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CircleDot className="w-5 h-5 text-[#BFA270]" />
                <h3 className="font-bold text-sm tracking-wide" style={{ fontFamily: "'Cinzel', serif" }}>
                  {editingLot ? 'Editar Lote' : 'Registrar Lote'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingLot(null);
                  setPendingCoords(null);
                }}
                className="p-1 hover:bg-white/10 rounded cursor-pointer transition-colors text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveLot} className="p-5 space-y-4 text-xs">
              {/* Estado del lote (define color) */}
              <div className="space-y-1.5">
                <label className="block font-bold text-[#163323] uppercase tracking-wider text-[11px]">
                  Estado del lote (Color del punto)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(LOT_STATUSES) as LotStatus[]).map((stKey) => {
                    const cfg = LOT_STATUSES[stKey];
                    const isSelected = formStatus === stKey;
                    return (
                      <button
                        key={stKey}
                        type="button"
                        onClick={() => setFormStatus(stKey)}
                        className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded border text-center cursor-pointer transition-all ${
                          isSelected
                            ? `${cfg.borderColor} ${cfg.bgColor} shadow-xs ring-1 ring-offset-1`
                            : 'border-[#DCD4C0] bg-white hover:bg-[#FAF8F5]'
                        }`}
                        style={{ borderColor: isSelected ? cfg.stroke : undefined }}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border"
                          style={{ backgroundColor: cfg.fill, borderColor: cfg.stroke }}
                        />
                        <span className={`text-[11px] font-bold ${isSelected ? cfg.textColor : 'text-[#35483A]'}`}>
                          {cfg.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nombre de Padrón */}
              <div className="space-y-1">
                <label className="block font-bold text-[#163323] text-[11px]">
                  Nombre o N° de Padrón
                </label>
                <input
                  type="text"
                  required
                  value={formPadron}
                  onChange={(e) => setFormPadron(e.target.value)}
                  placeholder="Ej: Padrón 4082 / Chacra Norte"
                  className="w-full px-3 py-2 border border-[#DCD4C0] rounded bg-white text-[#163323] text-xs focus:outline-none focus:border-[#163323] focus:ring-1 focus:ring-[#163323]"
                />
              </div>

              {/* Manzana y Lote */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-[#163323] text-[11px]">
                    Manzana
                  </label>
                  <input
                    type="text"
                    value={formManzana}
                    onChange={(e) => setFormManzana(e.target.value)}
                    placeholder="Ej: Mz 4 o B"
                    className="w-full px-3 py-2 border border-[#DCD4C0] rounded bg-white text-[#163323] text-xs focus:outline-none focus:border-[#163323] focus:ring-1 focus:ring-[#163323]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-bold text-[#163323] text-[11px]">
                    Lote
                  </label>
                  <input
                    type="text"
                    value={formLote}
                    onChange={(e) => setFormLote(e.target.value)}
                    placeholder="Ej: Lote 12"
                    className="w-full px-3 py-2 border border-[#DCD4C0] rounded bg-white text-[#163323] text-xs focus:outline-none focus:border-[#163323] focus:ring-1 focus:ring-[#163323]"
                  />
                </div>
              </div>

              {/* Extracción de madera */}
              <div className="border border-[#E5DEC9] p-3 bg-[#FAF8F5] rounded space-y-2">
                <label className="block font-bold text-[#163323] text-[11px]">
                  Madera extraída del lote
                </label>
                <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-[#DCD4C0] rounded bg-white font-mono text-xs focus:outline-none focus:border-[#163323]"
                  />
                  <div className="flex bg-white border border-[#DCD4C0] rounded p-0.5">
                    <button
                      type="button"
                      onClick={() => setFormUnit('m3')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded cursor-pointer transition-colors ${
                        formUnit === 'm3' ? 'bg-[#163323] text-white' : 'text-[#637568] hover:text-[#163323]'
                      }`}
                    >
                      m³
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormUnit('toneladas')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded cursor-pointer transition-colors ${
                        formUnit === 'toneladas' ? 'bg-[#163323] text-white' : 'text-[#637568] hover:text-[#163323]'
                      }`}
                    >
                      Toneladas
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-[#637568]">
                  Ingresá la cantidad en metros cúbicos (m³) o toneladas según corresponda.
                </p>
              </div>

              {/* Observaciones */}
              <div className="space-y-1">
                <label className="block font-bold text-[#163323] text-[11px]">
                  Observaciones / Especies (opcional)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ej: Eucalipto grandis, cuadrilla Este..."
                  className="w-full px-3 py-2 border border-[#DCD4C0] rounded bg-white text-[#163323] text-xs focus:outline-none focus:border-[#163323]"
                />
              </div>

              {/* Botones de acción */}
              <div className="pt-2 flex items-center justify-between gap-2">
                {editingLot ? (
                  <button
                    type="button"
                    onClick={handleDeleteLot}
                    className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingLot(null);
                      setPendingCoords(null);
                    }}
                    className="px-3 py-2 bg-white text-[#526657] hover:bg-[#F4EFE6] border border-[#DCD4C0] rounded text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#1B3B2B] text-white hover:bg-[#132A1F] rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5 text-[#BFA270]" /> Guardar lote
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
