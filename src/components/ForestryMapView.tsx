import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CircleDot, Eraser, MapPinned, MousePointer2, TreePine, ZoomIn, ZoomOut } from 'lucide-react';

interface ForestryMapViewProps {
  onGoToIncome: () => void;
}

interface MarkedLot {
  id: string;
  x: number;
  y: number;
  color: string;
}

const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;
const SVG_SOURCE = '/forestry-plan.svg?v=2.33.00-clean';

const COLOR_OPTIONS = [
  { id: 'green', label: 'Verde (Disponible/Activo)', fill: '#22C55E', stroke: '#15803D' },
  { id: 'amber', label: 'Dorado (En proceso)', fill: '#EAB308', stroke: '#A16207' },
  { id: 'blue', label: 'Azul (Reservado)', fill: '#3B82F6', stroke: '#1D4ED8' },
  { id: 'red', label: 'Rojo (Ocupado)', fill: '#EF4444', stroke: '#B91C1C' },
];

/**
 * Vista del plano forestal en formato 100% vectorial CAD nativo (SVG):
 * - Plano original CAD limpio: sin líneas raras de límites externos ni curvas topográficas cruzadas.
 * - Marcado de lotes con círculo de color de alta definición en el centro de cada cuadradito.
 * - Clic sobre un círculo existente para desmarcarlo.
 * - Zoom 5000% ultra fluido sin píxeles ni ralentizaciones.
 */
export const ForestryMapView: React.FC<ForestryMapViewProps> = ({ onGoToIncome }) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const hasInitialScrolledRef = useRef(false);
  const [markedLots, setMarkedLots] = useState<MarkedLot[]>([]);
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [zoom, setZoom] = useState(50); // 5000% zoom inicial
  const prevZoomRef = useRef(zoom);
  const [viewportBox, setViewportBox] = useState({ left: 0, top: 0, width: 100, height: 100 });
  const [message, setMessage] = useState('Hacé clic en el centro de cualquier lote para colocar un círculo de color.');

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

  const handleMapClick = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - bounds.left;
    const clickY = event.clientY - bounds.top;

    const svgX = (clickX / bounds.width) * MAP_WIDTH;
    const svgY = (clickY / bounds.height) * MAP_HEIGHT;

    // Detectar si se hizo clic cerca de un círculo existente para desmarcarlo
    // Radio de detección adaptable al zoom (~14 píxeles en pantalla)
    const hitRadiusSvg = Math.max(0.65, 14 / zoom);
    const existingIndex = markedLots.findIndex(
      (lot) => Math.hypot(lot.x - svgX, lot.y - svgY) <= hitRadiusSvg
    );

    if (existingIndex !== -1) {
      setMarkedLots((prev) => prev.filter((_, i) => i !== existingIndex));
      setMessage('Lote desmarcado.');
      return;
    }

    const newLot: MarkedLot = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      x: Number(svgX.toFixed(2)),
      y: Number(svgY.toFixed(2)),
      color: selectedColor.fill,
    };

    setMarkedLots((prev) => [...prev, newLot]);
    setMessage(`Lote marcado. Total: ${markedLots.length + 1}.`);
  };

  const resetTest = () => {
    setMarkedLots([]);
    setMessage('Plano restablecido. Podés volver a marcar lotes con círculos.');
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

  return (
    <div className="max-w-[1440px] mx-auto space-y-5 animate-fade-in pb-10">
      <section className="bg-white border border-[#E3DFC8] p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            <TreePine className="w-4 h-4" /> Control forestal · Marcado de lotes
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#163323] mt-1" style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}>
            Mapa de deforestación
          </h1>
          <p className="text-xs text-[#526657] mt-1 max-w-2xl">
            Plano 100% vectorial CAD con líneas nítidas. Hacé clic en el centro de cualquier lote para colocar un círculo de color o volvé a tocarlo para desmarcarlo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={resetTest} className="px-3 py-2 bg-white border border-[#DCD4C0] text-xs font-bold uppercase tracking-wider text-[#163323] hover:bg-[#F4EFE6] flex items-center gap-1.5 cursor-pointer">
            <Eraser className="w-3.5 h-3.5" /> Limpiar prueba
          </button>
          <button type="button" onClick={onGoToIncome} className="px-3 py-2 bg-[#1B3B2B] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#132A1F] flex items-center gap-1.5 cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5 text-[#BFA270]" /> Ir a Ingresos
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
        <div className="bg-white border border-[#DCD4C0] shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-[#163323] text-white flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <MapPinned className="w-4 h-4 text-[#BFA270]" /> Plano Forestal · Detalle de lotes (Vectorial)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-emerald-100 hidden md:inline">Rueda o barras para recorrer</span>
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

              {/* Capa de círculos de color en cada lote */}
              <svg
                viewBox="0 0 800 600"
                className="absolute inset-0 w-full h-full pointer-events-none"
                preserveAspectRatio="none"
              >
                {markedLots.map((lot) => (
                  <g key={lot.id}>
                    <circle
                      cx={lot.x}
                      cy={lot.y}
                      r={0.65}
                      fill={lot.color}
                      stroke="#0F172A"
                      strokeWidth={0.12}
                    />
                    <circle
                      cx={lot.x}
                      cy={lot.y}
                      r={0.22}
                      fill="#FFFFFF"
                      opacity={0.9}
                    />
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>

        <aside className="bg-white border border-[#E3DFC8] shadow-xs p-4 space-y-4 text-xs">
          <div className="flex items-center gap-2 text-[#163323] font-bold uppercase tracking-wider">
            <CircleDot className="w-4 h-4 text-emerald-700" /> Marcador de lotes
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-950 leading-relaxed">
            {message}
          </div>

          {/* Selector de color */}
          <div className="border border-[#E5DEC9] p-3 bg-[#FAF8F5] space-y-2">
            <p className="font-bold text-[#35483A] uppercase tracking-wide text-[10px]">Color del marcador</p>
            <div className="grid grid-cols-2 gap-1.5">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`flex items-center gap-2 p-1.5 rounded border text-left cursor-pointer transition-all ${
                    selectedColor.id === c.id
                      ? 'border-[#163323] bg-white shadow-xs font-bold'
                      : 'border-transparent hover:bg-white/60'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border shrink-0"
                    style={{ backgroundColor: c.fill, borderColor: c.stroke }}
                  />
                  <span className="text-[11px] text-[#163323] truncate">{c.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="border border-[#E5DEC9] p-3 bg-[#FAF8F5] space-y-2">
            <p className="font-bold text-[#35483A] uppercase tracking-wide text-[10px]">Mapa general</p>
            <div onPointerDown={focusFromMinimap} className="relative aspect-[4/3] bg-white border border-[#202020] cursor-pointer overflow-hidden" title="Tocá una zona para ir allí">
              <img src={SVG_SOURCE} alt="Vista general de todo el plano forestal" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
              <svg viewBox="0 0 800 600" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                {markedLots.map((lot) => (
                  <circle
                    key={lot.id}
                    cx={lot.x}
                    cy={lot.y}
                    r={3.5}
                    fill={lot.color}
                    stroke="#0F172A"
                    strokeWidth={0.8}
                  />
                ))}
              </svg>
              <div className="absolute border-2 border-[#E8B64B] bg-[#E8B64B]/15 pointer-events-none" style={{ left: `${viewportBox.left}%`, top: `${viewportBox.top}%`, width: `${viewportBox.width}%`, height: `${viewportBox.height}%` }} />
            </div>
            <p className="text-[10px] text-[#637568] leading-relaxed">El marco dorado indica la zona visible. Tocá en este mapa para moverte directamente.</p>
          </div>

          <div className="p-3 bg-[#FAF8F5] border border-[#E5DEC9] space-y-2">
            <div className="flex justify-between"><span className="text-[#637568]">Lotes marcados</span><strong className="font-mono text-[#163323]">{markedLots.length}</strong></div>
            <div className="flex justify-between"><span className="text-[#637568]">Estado</span><strong className="text-amber-800">Sin guardar</strong></div>
          </div>

          <div className="border-t border-[#E8E2D2] pt-3 text-[#637568] leading-relaxed flex gap-2">
            <MousePointer2 className="w-4 h-4 shrink-0 text-[#BFA270]" />
            Hacé clic en cualquier lote para colocar un círculo. Tocá sobre un círculo existente para desmarcarlo.
          </div>
        </aside>
      </section>
    </div>
  );
};
