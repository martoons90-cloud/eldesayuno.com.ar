import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CircleDot,
  Eraser,
  Layers,
  MapPinned,
  MousePointer2,
  Plus,
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
    borderColor: 'border-emerald-400',
    description: 'Madera extraída / cosechada',
  },
  trabajando: {
    id: 'trabajando',
    label: 'Trabajando',
    fill: '#EAB308', // Amarillo
    stroke: '#A16207',
    textColor: 'text-amber-800',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-400',
    description: 'En proceso de tala / faena activa',
  },
  vacio: {
    id: 'vacio',
    label: 'Vacío',
    fill: '#EF4444', // Rojo
    stroke: '#B91C1C',
    textColor: 'text-rose-800',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-400',
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

  // Lotes persistidos
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
  const [message, setMessage] = useState('Posicionate sobre un punto para ver sus datos o hacé clic para abrirlos al costado.');

  // Lote seleccionado para editar/ver en la barra lateral
  // null = ninguno, 'new' = creando nuevo, string = id de lote existente
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [newLotCoords, setNewLotCoords] = useState<{ x: number; y: number } | null>(null);

  // Cuadro flotante al posicionarse (hover)
  const [hoveredLot, setHoveredLot] = useState<MarkedLot | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Campos del formulario lateral
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

  // Posicionarse sobre el mapa (hover) para mostrar cuadro de datos
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - bounds.left;
    const clickY = event.clientY - bounds.top;

    setMousePos({ x: event.clientX, y: event.clientY });

    const svgX = (clickX / bounds.width) * MAP_WIDTH;
    const svgY = (clickY / bounds.height) * MAP_HEIGHT;

    // Tolerancia para detectar hover sobre el punto (~14 píxeles en pantalla)
    const hitRadiusSvg = Math.max(0.12, 14 / zoom);
    const found = markedLots.find(
      (lot) => Math.hypot(lot.x - svgX, lot.y - svgY) <= Math.max(lot.r * 2.5, hitRadiusSvg)
    );

    setHoveredLot(found || null);
  };

  const handlePointerLeave = () => {
    setHoveredLot(null);
  };

  // Clic en el mapa: abre los datos al costado
  const handleMapClick = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - bounds.left;
    const clickY = event.clientY - bounds.top;

    const svgX = Number(((clickX / bounds.width) * MAP_WIDTH).toFixed(3));
    const svgY = Number(((clickY / bounds.height) * MAP_HEIGHT).toFixed(3));

    const hitRadiusSvg = Math.max(0.12, 14 / zoom);
    const existing = markedLots.find(
      (lot) => Math.hypot(lot.x - svgX, lot.y - svgY) <= Math.max(lot.r * 2.5, hitRadiusSvg)
    );

    if (existing) {
      // Clic en un círculo existente: abrir datos al costado
      setSelectedLotId(existing.id);
      setNewLotCoords(null);
      setFormStatus(existing.status);
      setFormPadron(existing.padron);
      setFormManzana(existing.manzana);
      setFormLote(existing.lote);
      setFormUnit(existing.extractedUnit);
      setFormAmount(existing.extractedAmount ? existing.extractedAmount.toString() : '0');
      setFormNotes(existing.notes || '');
      setMessage(`Ficha abierta al costado: ${existing.manzana ? `Mz ${existing.manzana} ` : ''}${existing.lote ? `Lote ${existing.lote}` : `Padrón ${existing.padron}`}.`);
      return;
    }

    // Clic en un lugar vacío: abrir formulario para registrar nuevo lote al costado
    setSelectedLotId('new');
    setNewLotCoords({ x: svgX, y: svgY });
    setFormStatus('extraido');
    setFormPadron('');
    setFormManzana('');
    setFormLote('');
    setFormUnit('m3');
    setFormAmount('0');
    setFormNotes('');
    setMessage('Ingresá los datos al costado para registrar este nuevo lote.');
  };

  const handleSaveSidebarLot = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(formAmount) || 0;
    const nowIso = new Date().toISOString();

    if (selectedLotId && selectedLotId !== 'new') {
      // Modificar existente
      setMarkedLots((prev) =>
        prev.map((lot) =>
          lot.id === selectedLotId
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
      setMessage(`Lote guardado correctamente.`);
    } else if (newLotCoords) {
      // Crear nuevo
      const newLot: MarkedLot = {
        id: `lot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        x: newLotCoords.x,
        y: newLotCoords.y,
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
      setSelectedLotId(newLot.id);
      setNewLotCoords(null);
      setMessage(`Nuevo lote registrado y guardado.`);
    }
  };

  const handleDeleteSidebarLot = () => {
    if (!selectedLotId || selectedLotId === 'new') {
      setSelectedLotId(null);
      setNewLotCoords(null);
      return;
    }
    setMarkedLots((prev) => prev.filter((lot) => lot.id !== selectedLotId));
    setSelectedLotId(null);
    setNewLotCoords(null);
    setMessage(`Lote y punto eliminados del plano.`);
  };

  const resetAll = () => {
    if (markedLots.length === 0) return;
    if (window.confirm('¿Seguro que querés limpiar todos los puntos marcados?')) {
      setMarkedLots([]);
      setSelectedLotId(null);
      setNewLotCoords(null);
      setMessage('Plano restablecido.');
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

    // Seleccionar lote al costado
    setSelectedLotId(lot.id);
    setNewLotCoords(null);
    setFormStatus(lot.status);
    setFormPadron(lot.padron);
    setFormManzana(lot.manzana);
    setFormLote(lot.lote);
    setFormUnit(lot.extractedUnit);
    setFormAmount(lot.extractedAmount ? lot.extractedAmount.toString() : '0');
    setFormNotes(lot.notes || '');
  };

  const currentSelectedLot = markedLots.find((l) => l.id === selectedLotId);

  return (
    <div className="max-w-[1440px] mx-auto space-y-5 animate-fade-in pb-10">
      {/* Header superior */}
      <section className="bg-white border border-[#E3DFC8] p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            <TreePine className="w-4 h-4" /> Control forestal · Ficha de lotes y extracción
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#163323] mt-1" style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}>
            Mapa de deforestación
          </h1>
          <p className="text-xs text-[#526657] mt-1 max-w-2xl">
            Posicionate sobre cualquier círculo para ver sus datos flotantes, o hacé clic sobre el lote para abrir y editar sus datos al costado.
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

      {/* Área principal: Plano + Barra lateral con datos al costado */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
        {/* Contenedor del Plano */}
        <div className="bg-white border border-[#DCD4C0] shadow-xs overflow-hidden relative">
          <div className="px-4 py-3 bg-[#163323] text-white flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <MapPinned className="w-4 h-4 text-[#BFA270]" /> Plano Forestal · Detalle de lotes (Vectorial)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-emerald-100 hidden md:inline">Tocá un lote para ver sus datos al costado</span>
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

          <div
            ref={viewportRef}
            onScroll={syncMinimap}
            className="p-3 sm:p-5 bg-[#F7F7F5] overflow-auto h-[74vh] min-h-[540px]"
          >
            <div
              style={{
                width: `${Math.round(MAP_WIDTH * zoom)}px`,
                height: `${Math.round(MAP_HEIGHT * zoom)}px`,
                position: 'relative',
                maxWidth: 'none',
              }}
              onPointerDown={handleMapClick}
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
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
                  const isSelected = selectedLotId === lot.id;
                  return (
                    <g key={lot.id}>
                      {/* Anillo de selección si está abierto al costado */}
                      {isSelected && (
                        <circle
                          cx={lot.x}
                          cy={lot.y}
                          r={(lot.r || DEFAULT_RADIUS) * 2.2}
                          fill="none"
                          stroke="#163323"
                          strokeWidth={0.02}
                          strokeDasharray="0.04 0.02"
                        />
                      )}
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

                {/* Marcador provisorio de nuevo lote en carga */}
                {selectedLotId === 'new' && newLotCoords && (
                  <circle
                    cx={newLotCoords.x}
                    cy={newLotCoords.y}
                    r={DEFAULT_RADIUS}
                    fill={LOT_STATUSES[formStatus].fill}
                    stroke="#163323"
                    strokeWidth={0.02}
                    strokeDasharray="0.03 0.02"
                  />
                )}
              </svg>
            </div>
          </div>

          {/* Cuadro de datos flotante (Tooltip) al posicionarse arriba de un círculo */}
          {hoveredLot && (
            <div
              className="fixed z-50 pointer-events-none bg-[#163323] text-white p-3 rounded-lg shadow-2xl border border-[#BFA270]/50 text-xs animate-fade-in min-w-[210px]"
              style={{
                left: `${Math.min(window.innerWidth - 240, mousePos.x + 16)}px`,
                top: `${Math.max(20, mousePos.y - 40)}px`,
              }}
            >
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-white/20">
                <span
                  className="w-3 h-3 rounded-full shrink-0 border border-white/30"
                  style={{ backgroundColor: LOT_STATUSES[hoveredLot.status].fill }}
                />
                <span className="font-bold text-sm text-[#F4EFE6] tracking-wide" style={{ fontFamily: "'Cinzel', serif" }}>
                  {hoveredLot.manzana ? `Mz ${hoveredLot.manzana} · ` : ''}
                  {hoveredLot.lote ? `Lote ${hoveredLot.lote}` : `Padrón ${hoveredLot.padron}`}
                </span>
              </div>

              <div className="space-y-1.5 text-[11px] text-[#D4DFD8]">
                <div className="flex justify-between">
                  <span className="text-white/70">Padrón:</span>
                  <strong className="text-white">{hoveredLot.padron || 'S/N'}</strong>
                </div>
                {hoveredLot.manzana && (
                  <div className="flex justify-between">
                    <span className="text-white/70">Manzana:</span>
                    <strong className="text-white">{hoveredLot.manzana}</strong>
                  </div>
                )}
                {hoveredLot.lote && (
                  <div className="flex justify-between">
                    <span className="text-white/70">Lote:</span>
                    <strong className="text-white">{hoveredLot.lote}</strong>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-white/70">Estado:</span>
                  <span
                    className="font-bold px-1.5 py-0.5 rounded text-[10px]"
                    style={{
                      backgroundColor: `${LOT_STATUSES[hoveredLot.status].fill}25`,
                      color: LOT_STATUSES[hoveredLot.status].fill,
                      border: `1px solid ${LOT_STATUSES[hoveredLot.status].fill}60`,
                    }}
                  >
                    {LOT_STATUSES[hoveredLot.status].label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Extraído:</span>
                  <strong className="text-emerald-300 font-mono">
                    {hoveredLot.extractedAmount} {hoveredLot.extractedUnit}
                  </strong>
                </div>
                {hoveredLot.notes && (
                  <div className="pt-1 border-t border-white/10 text-[10px] text-white/90 italic">
                    "{hoveredLot.notes}"
                  </div>
                )}
              </div>

              <div className="text-[10px] text-[#BFA270] mt-2 pt-1.5 border-t border-white/15 flex items-center gap-1">
                <MousePointer2 className="w-3 h-3" /> Hacé clic para abrir al costado
              </div>
            </div>
          )}
        </div>

        {/* Barra lateral: Datos del lote al costado */}
        <aside className="bg-white border border-[#E3DFC8] shadow-xs p-4 space-y-4 text-xs">
          <div className="flex items-center justify-between text-[#163323] font-bold uppercase tracking-wider pb-1 border-b border-[#EAE3D2]">
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700" /> Datos del Lote
            </span>
            {selectedLotId && (
              <button
                type="button"
                onClick={() => {
                  setSelectedLotId(null);
                  setNewLotCoords(null);
                }}
                className="text-[11px] font-bold text-[#637568] hover:text-[#163323] flex items-center gap-1 cursor-pointer"
                title="Cerrar ficha"
              >
                <X className="w-3.5 h-3.5" /> Cerrar
              </button>
            )}
          </div>

          {/* Formulario lateral cuando hay un lote seleccionado o nuevo */}
          {selectedLotId ? (
            <form onSubmit={handleSaveSidebarLot} className="space-y-3.5 animate-fade-in">
              <div className="p-2.5 bg-[#FAF8F5] border border-[#E5DEC9] rounded">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block mb-1">
                  {selectedLotId === 'new' ? 'Registrando nuevo lote' : 'Ficha del lote seleccionado'}
                </span>
                <p className="text-[11px] text-[#35483A] font-semibold">
                  {selectedLotId === 'new'
                    ? 'Completá los datos y presioná Guardar'
                    : `${currentSelectedLot?.manzana ? `Mz ${currentSelectedLot.manzana} · ` : ''}${currentSelectedLot?.lote ? `Lote ${currentSelectedLot.lote}` : `Padrón ${currentSelectedLot?.padron}`}`}
                </p>
              </div>

              {/* Selector de Estado (Color) */}
              <div className="space-y-1">
                <label className="block font-bold text-[#163323] text-[11px]">
                  Estado del lote (Color)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(LOT_STATUSES) as LotStatus[]).map((stKey) => {
                    const cfg = LOT_STATUSES[stKey];
                    const isSelected = formStatus === stKey;
                    return (
                      <button
                        key={stKey}
                        type="button"
                        onClick={() => setFormStatus(stKey)}
                        className={`p-2 rounded border text-center cursor-pointer transition-all flex flex-col items-center gap-1 ${
                          isSelected
                            ? `${cfg.borderColor} ${cfg.bgColor} shadow-xs font-bold`
                            : 'border-[#DCD4C0] bg-white hover:bg-[#FAF8F5]'
                        }`}
                        style={{ borderColor: isSelected ? cfg.stroke : undefined }}
                      >
                        <span
                          className="w-3 h-3 rounded-full border shrink-0"
                          style={{ backgroundColor: cfg.fill, borderColor: cfg.stroke }}
                        />
                        <span className={`text-[10px] ${isSelected ? cfg.textColor : 'text-[#35483A]'}`}>
                          {cfg.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nombre / N° de Padrón */}
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
                  className="w-full px-2.5 py-1.5 border border-[#DCD4C0] rounded bg-white text-[#163323] text-xs focus:outline-none focus:border-[#163323]"
                />
              </div>

              {/* Manzana y Lote */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block font-bold text-[#163323] text-[11px]">
                    Manzana
                  </label>
                  <input
                    type="text"
                    value={formManzana}
                    onChange={(e) => setFormManzana(e.target.value)}
                    placeholder="Ej: Mz 4"
                    className="w-full px-2.5 py-1.5 border border-[#DCD4C0] rounded bg-white text-[#163323] text-xs focus:outline-none focus:border-[#163323]"
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
                    className="w-full px-2.5 py-1.5 border border-[#DCD4C0] rounded bg-white text-[#163323] text-xs focus:outline-none focus:border-[#163323]"
                  />
                </div>
              </div>

              {/* Extracción de madera */}
              <div className="border border-[#E5DEC9] p-2.5 bg-[#FAF8F5] rounded space-y-1.5">
                <label className="block font-bold text-[#163323] text-[11px]">
                  Madera extraída del lote
                </label>
                <div className="grid grid-cols-[1fr_auto] gap-1.5 items-center">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 border border-[#DCD4C0] rounded bg-white font-mono text-xs focus:outline-none focus:border-[#163323]"
                  />
                  <div className="flex bg-white border border-[#DCD4C0] rounded p-0.5">
                    <button
                      type="button"
                      onClick={() => setFormUnit('m3')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                        formUnit === 'm3' ? 'bg-[#163323] text-white' : 'text-[#637568]'
                      }`}
                    >
                      m³
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormUnit('toneladas')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                        formUnit === 'toneladas' ? 'bg-[#163323] text-white' : 'text-[#637568]'
                      }`}
                    >
                      Toneladas
                    </button>
                  </div>
                </div>
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
                  placeholder="Ej: Eucalipto grandis, tala terminada..."
                  className="w-full px-2.5 py-1.5 border border-[#DCD4C0] rounded bg-white text-[#163323] text-xs focus:outline-none focus:border-[#163323]"
                />
              </div>

              {/* Acciones */}
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#EAE3D2]">
                {selectedLotId !== 'new' ? (
                  <button
                    type="button"
                    onClick={handleDeleteSidebarLot}
                    className="px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLotId(null);
                      setNewLotCoords(null);
                    }}
                    className="px-2.5 py-1.5 bg-white text-[#526657] hover:bg-[#F4EFE6] border border-[#DCD4C0] rounded text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}

                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#1B3B2B] text-white hover:bg-[#132A1F] rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs ml-auto"
                >
                  <Check className="w-3.5 h-3.5 text-[#BFA270]" /> Guardar lote
                </button>
              </div>
            </form>
          ) : (
            /* Vista por defecto cuando ningún lote está seleccionado para editar */
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-950 leading-relaxed rounded">
                {message}
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

              {/* Lista de lotes registrados para acceso directo */}
              <div className="border border-[#E5DEC9] p-3 bg-[#FAF8F5] space-y-2 rounded">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-[#35483A] uppercase tracking-wide text-[10px]">
                    Lotes registrados ({markedLots.length})
                  </p>
                </div>
                {markedLots.length > 0 ? (
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                    {markedLots.map((lot) => {
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
                            <span className="font-semibold text-[#163323] truncate text-[11px]">
                              {lot.manzana ? `Mz ${lot.manzana} · ` : ''}{lot.lote ? `Lote ${lot.lote}` : `Padrón ${lot.padron}`}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-[#637568] shrink-0">
                            {lot.extractedAmount > 0 ? `${lot.extractedAmount} ${lot.extractedUnit}` : cfg.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-[#637568] py-2 text-center">
                    Aún no hay lotes registrados. Hacé clic en cualquier lote del mapa para registrarlo.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-[#E8E2D2] pt-3 text-[#637568] leading-relaxed flex gap-2">
            <MousePointer2 className="w-4 h-4 shrink-0 text-[#BFA270]" />
            <span>
              <strong>Hover:</strong> muestra el cuadro flotante sobre el lote. <strong>Click:</strong> abre la ficha editable aquí al costado.
            </span>
          </div>
        </aside>
      </section>
    </div>
  );
};
