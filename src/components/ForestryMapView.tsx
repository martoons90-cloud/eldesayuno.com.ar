import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Eraser, MapPinned, MousePointer2, PaintBucket, TreePine, ZoomIn, ZoomOut } from 'lucide-react';

interface ForestryMapViewProps {
  onGoToIncome: () => void;
}

const MAP_WIDTH = 1180;
const MAP_HEIGHT = 1044;
// Lámina CAD con trazado detallado y nítido de cada lote y manzana.
const MAP_SOURCE = '/forestry-map.svg?revision=plano-dxf-detalle-v4';
// El mapa general muestra la lámina completa de referencia y ubica la zona visible.
const MAP_OVERVIEW_SOURCE = MAP_SOURCE;

/**
 * Prueba visual de selección por "balde de pintura" sobre el detalle del
 * plano Forestal entregado por el usuario. No persiste ningún dato todavía:
 * primero validamos que las divisiones se comporten bien al tocarse.
 */
export const ForestryMapView: React.FC<ForestryMapViewProps> = ({ onGoToIncome }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const hasInitialScrolledRef = useRef(false);
  const [markedAreas, setMarkedAreas] = useState(0);
  const [zoom, setZoom] = useState(3);
  const [viewportBox, setViewportBox] = useState({ left: 0, top: 0, width: 25, height: 25 });
  const [message, setMessage] = useState('Tocá dentro de una parcela para probar el marcado.');

  const syncMinimap = () => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return;
    setViewportBox({
      left: (viewport.scrollLeft / canvas.width) * 100,
      top: (viewport.scrollTop / canvas.height) * 100,
      width: Math.min(100, (viewport.clientWidth / canvas.width) * 100),
      height: Math.min(100, (viewport.clientHeight / canvas.height) * 100),
    });
  };

  const drawBaseMap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = Math.round(MAP_WIDTH * zoom);
    canvas.height = Math.round(MAP_HEIGHT * zoom);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    const map = new Image();
    map.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(map, 0, 0, canvas.width, canvas.height);

      if (!hasInitialScrolledRef.current && viewportRef.current) {
        hasInitialScrolledRef.current = true;
        viewportRef.current.scrollLeft = Math.round((canvas.width - viewportRef.current.clientWidth) * 0.28);
        viewportRef.current.scrollTop = Math.round((canvas.height - viewportRef.current.clientHeight) * 0.31);
      }

      requestAnimationFrame(syncMinimap);
    };
    map.src = MAP_SOURCE;
  };

  useEffect(() => { drawBaseMap(); }, [zoom]);

  const handlePaint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    const bounds = canvas.getBoundingClientRect();
    const startX = Math.floor((event.clientX - bounds.left) * (canvas.width / bounds.width));
    const startY = Math.floor((event.clientY - bounds.top) * (canvas.height / bounds.height));
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = image;
    const startIndex = (startY * canvas.width + startX) * 4;

    // Si se toca una línea negra, la persona debe tocar dentro de la parcela.
    if (data[startIndex] < 220 || data[startIndex + 1] < 220 || data[startIndex + 2] < 220) {
      setMessage('Tocaste una línea del plano. Probá dentro del área blanca de una parcela.');
      return;
    }

    const pending: Array<[number, number]> = [[startX, startY]];
    let paintedPixels = 0;
    // Límite preventivo: evita que una abertura del dibujo pinte todo el plano.
    const maxPixels = Math.floor(canvas.width * canvas.height * 0.14);

    while (pending.length > 0 && paintedPixels < maxPixels) {
      const [x, y] = pending.pop()!;
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
      const index = (y * canvas.width + x) * 4;
      if (data[index] < 230 || data[index + 1] < 230 || data[index + 2] < 230) continue;

      data[index] = 174;
      data[index + 1] = 220;
      data[index + 2] = 181;
      data[index + 3] = 255;
      paintedPixels++;
      pending.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    if (paintedPixels >= maxPixels) {
      drawBaseMap();
      setMessage('Esta zona se comunica con una superficie muy grande. Para marcarla bien habrá que cerrar esas líneas del plano.');
      return;
    }

    context.putImageData(image, 0, 0);
    setMarkedAreas((current) => current + 1);
    setMessage(`Área marcada de prueba (${paintedPixels.toLocaleString('es-AR')} píxeles). Todavía no se guardó ningún dato.`);
  };

  const resetTest = () => {
    drawBaseMap();
    setMarkedAreas(0);
    setMessage('Plano restablecido. Podés volver a probar otra parcela.');
  };

  const focusFromMinimap = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    viewport.scrollLeft = Math.max(0, x * canvas.width - viewport.clientWidth / 2);
    viewport.scrollTop = Math.max(0, y * canvas.height - viewport.clientHeight / 2);
    syncMinimap();
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-5 animate-fade-in pb-10">
      <section className="bg-white border border-[#E3DFC8] p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            <TreePine className="w-4 h-4" /> Control forestal · Vista de prueba
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#163323] mt-1" style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}>
            Mapa de deforestación
          </h1>
          <p className="text-xs text-[#526657] mt-1 max-w-2xl">
            Plano CAD en fondo blanco y líneas negras con detalle de lotes y manzanas. Recorrélo con desplazamiento y ubicá tu posición en el mapa general.
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
          <div className="px-4 py-3 bg-[#163323] text-white flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"><MapPinned className="w-4 h-4 text-[#BFA270]" /> Plano Forestal detallado</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-emerald-100">Rueda o barras para recorrer</span>
              <button type="button" onClick={() => setZoom((value) => Math.max(1, Number((value - 0.5).toFixed(1))))} className="p-1 hover:bg-white/15 cursor-pointer" title="Alejar">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] min-w-8 text-center">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((value) => Math.min(6, Number((value + 0.5).toFixed(1))))} className="p-1 hover:bg-white/15 cursor-pointer" title="Acercar">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div ref={viewportRef} onScroll={syncMinimap} className="p-3 sm:p-5 bg-[#F7F7F5] overflow-auto h-[72vh] min-h-[520px]">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePaint}
              className="block bg-white border border-[#202020] cursor-crosshair touch-none shadow-sm max-w-none"
              aria-label="Plano forestal clickeable para prueba de marcado"
            />
          </div>
        </div>

        <aside className="bg-white border border-[#E3DFC8] shadow-xs p-4 space-y-4 text-xs">
          <div className="flex items-center gap-2 text-[#163323] font-bold uppercase tracking-wider"><PaintBucket className="w-4 h-4 text-emerald-700" /> Balde de pintura</div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-950 leading-relaxed">{message}</div>
          <div className="border border-[#E5DEC9] p-3 bg-[#FAF8F5] space-y-2">
            <p className="font-bold text-[#35483A] uppercase tracking-wide text-[10px]">Mapa general</p>
            <div onPointerDown={focusFromMinimap} className="relative aspect-[1180/1044] bg-black border border-[#202020] cursor-pointer overflow-hidden" title="Tocá una zona para ir allí">
              <img src={MAP_OVERVIEW_SOURCE} alt="Vista general de todo el plano forestal" className="absolute inset-0 w-full h-full invert opacity-90" />
              <div className="absolute border-2 border-[#E8B64B] bg-[#E8B64B]/15 pointer-events-none" style={{ left: `${viewportBox.left}%`, top: `${viewportBox.top}%`, width: `${viewportBox.width}%`, height: `${viewportBox.height}%` }} />
            </div>
            <p className="text-[10px] text-[#637568] leading-relaxed">El marco dorado indica la zona visible. Tocá en este mapa para moverte directamente.</p>
          </div>
          <div className="p-3 bg-[#FAF8F5] border border-[#E5DEC9] space-y-2">
            <div className="flex justify-between"><span className="text-[#637568]">Áreas probadas</span><strong className="font-mono text-[#163323]">{markedAreas}</strong></div>
            <div className="flex justify-between"><span className="text-[#637568]">Estado</span><strong className="text-amber-800">Sin guardar</strong></div>
          </div>
          <div className="border-t border-[#E8E2D2] pt-3 text-[#637568] leading-relaxed flex gap-2">
            <MousePointer2 className="w-4 h-4 shrink-0 text-[#BFA270]" />
            El mapa principal conserva un zoom detallado y se recorre con las barras o la rueda. El marcado sigue siendo una prueba sin guardar.
          </div>
        </aside>
      </section>
    </div>
  );
};
