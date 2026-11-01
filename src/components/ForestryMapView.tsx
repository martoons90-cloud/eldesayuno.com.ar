import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Eraser, MapPinned, MousePointer2, PaintBucket, TreePine, ZoomIn, ZoomOut } from 'lucide-react';

interface ForestryMapViewProps {
  onGoToIncome: () => void;
}

const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;
const SVG_SOURCE = '/forestry-plan.svg?revision=vector-cad-v1';

/**
 * Vista del plano forestal en formato 100% vectorial CAD nativo (SVG):
 * - Líneas finas nítidas que no se pixelan sin importar cuánto zoom se aplique.
 * - Carga instantánea en pocos milisegundos y navegación fluida sin trabas ni tildes.
 * - Prueba de marcado de parcelas con balde de pintura sobre capa interactiva.
 */
export const ForestryMapView: React.FC<ForestryMapViewProps> = ({ onGoToIncome }) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasInitialScrolledRef = useRef(false);
  const [markedAreas, setMarkedAreas] = useState(0);
  const [zoom, setZoom] = useState(50); // 5000% zoom inicial
  const prevZoomRef = useRef(zoom);
  const [viewportBox, setViewportBox] = useState({ left: 0, top: 0, width: 100, height: 100 });
  const [message, setMessage] = useState('Tocá dentro de una parcela para probar el marcado.');

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

  const loadOffscreenBuffer = () => {
    const img = new Image();
    img.src = SVG_SOURCE;
    img.onload = () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = 3200;
      offscreen.height = 2400;
      const ctx = offscreen.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 3200, 2400);
        ctx.drawImage(img, 0, 0, 3200, 2400);
        offscreenCanvasRef.current = offscreen;
      }
    };
  };

  useEffect(() => {
    loadOffscreenBuffer();
  }, []);

  // Centrado inicial automático en la zona de parcelas
  useEffect(() => {
    if (!hasInitialScrolledRef.current && viewportRef.current) {
      hasInitialScrolledRef.current = true;
      const displayW = Math.round(MAP_WIDTH * zoom);
      const displayH = Math.round(MAP_HEIGHT * zoom);
      const targetX = Math.round(0.58 * displayW - viewportRef.current.clientWidth / 2);
      const targetY = Math.round(0.50 * displayH - viewportRef.current.clientHeight / 2);
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

  const handlePaint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const offscreen = offscreenCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!offscreen || !overlay) return;
    const overlayCtx = overlay.getContext('2d');
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!overlayCtx || !offCtx) return;

    const bounds = overlay.getBoundingClientRect();
    const clickX = event.clientX - bounds.left;
    const clickY = event.clientY - bounds.top;

    const scaleX = offscreen.width / bounds.width;
    const scaleY = offscreen.height / bounds.height;
    const startX = Math.floor(clickX * scaleX);
    const startY = Math.floor(clickY * scaleY);

    const BOX = 350;
    const x0 = Math.max(0, startX - BOX);
    const y0 = Math.max(0, startY - BOX);
    const x1 = Math.min(offscreen.width, startX + BOX);
    const y1 = Math.min(offscreen.height, startY + BOX);
    const w = x1 - x0;
    const h = y1 - y0;

    const image = offCtx.getImageData(x0, y0, w, h);
    const { data } = image;
    const localStartX = startX - x0;
    const localStartY = startY - y0;
    const startIndex = (localStartY * w + localStartX) * 4;

    if (data[startIndex] < 200 || data[startIndex + 1] < 200 || data[startIndex + 2] < 200) {
      setMessage('Tocaste una línea del plano. Probá dentro del área blanca de una parcela.');
      return;
    }

    const pendingX: number[] = [localStartX];
    const pendingY: number[] = [localStartY];
    data[startIndex] = 174;
    data[startIndex + 1] = 220;
    data[startIndex + 2] = 181;
    data[startIndex + 3] = 255;
    let paintedPixels = 1;
    const maxPixels = 60_000;

    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = w;
    patchCanvas.height = h;
    const patchCtx = patchCanvas.getContext('2d')!;
    const patchImage = patchCtx.createImageData(w, h);
    const pData = patchImage.data;
    pData[startIndex] = 174;
    pData[startIndex + 1] = 220;
    pData[startIndex + 2] = 181;
    pData[startIndex + 3] = 180;

    while (pendingX.length > 0 && paintedPixels < maxPixels) {
      const cx = pendingX.pop()!;
      const cy = pendingY.pop()!;

      const neighbors = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ];

      for (let i = 0; i < 4; i++) {
        const nx = neighbors[i][0];
        const ny = neighbors[i][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nIndex = (ny * w + nx) * 4;
        if (data[nIndex] >= 220 && data[nIndex + 1] >= 220 && data[nIndex + 2] >= 220) {
          data[nIndex] = 174;
          data[nIndex + 1] = 220;
          data[nIndex + 2] = 181;
          data[nIndex + 3] = 255;

          pData[nIndex] = 174;
          pData[nIndex + 1] = 220;
          pData[nIndex + 2] = 181;
          pData[nIndex + 3] = 180;

          paintedPixels++;
          pendingX.push(nx);
          pendingY.push(ny);
          if (paintedPixels >= maxPixels) break;
        }
      }
    }

    if (paintedPixels >= maxPixels) {
      setMessage('Esta zona se comunica con una superficie muy grande o no cerrada. Para marcarla bien habrá que cerrar esas líneas.');
      return;
    }

    offCtx.putImageData(image, x0, y0);
    patchCtx.putImageData(patchImage, 0, 0);
    overlayCtx.drawImage(patchCanvas, x0, y0, w, h);

    setMarkedAreas((prev) => prev + 1);
    setMessage(`Área marcada de prueba (${paintedPixels.toLocaleString('es-AR')} píxeles). Todavía no se guardó ningún dato.`);
  };

  const resetTest = () => {
    const overlay = overlayCanvasRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
    }
    loadOffscreenBuffer();
    setMarkedAreas(0);
    setMessage('Plano restablecido. Podés volver a probar otra parcela.');
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
            <TreePine className="w-4 h-4" /> Control forestal · Vista vectorial CAD
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#163323] mt-1" style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}>
            Mapa de deforestación
          </h1>
          <p className="text-xs text-[#526657] mt-1 max-w-2xl">
            Plano 100% vectorial nativo con líneas finas CAD. Hacé todo el zoom que quieras sin pixelado y con navegación instantánea y fluida.
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
              className="bg-white border border-[#202020] shadow-sm mx-auto"
            >
              <img
                src={SVG_SOURCE}
                alt="Plano forestal vectorial CAD"
                className="w-full h-full block select-none pointer-events-none"
                draggable={false}
              />
              <canvas
                ref={overlayCanvasRef}
                width={3200}
                height={2400}
                onPointerDown={handlePaint}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                aria-label="Capa interactiva de marcado de parcelas"
              />
            </div>
          </div>
        </div>

        <aside className="bg-white border border-[#E3DFC8] shadow-xs p-4 space-y-4 text-xs">
          <div className="flex items-center gap-2 text-[#163323] font-bold uppercase tracking-wider"><PaintBucket className="w-4 h-4 text-emerald-700" /> Balde de pintura</div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-950 leading-relaxed">{message}</div>
          <div className="border border-[#E5DEC9] p-3 bg-[#FAF8F5] space-y-2">
            <p className="font-bold text-[#35483A] uppercase tracking-wide text-[10px]">Mapa general</p>
            <div onPointerDown={focusFromMinimap} className="relative aspect-[4/3] bg-white border border-[#202020] cursor-pointer overflow-hidden" title="Tocá una zona para ir allí">
              <img src={SVG_SOURCE} alt="Vista general de todo el plano forestal" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
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
            Plano 100% vectorial CAD con líneas finas nítidas sin pixelado. Navegación fluida y rápida en cualquier nivel de zoom.
          </div>
        </aside>
      </section>
    </div>
  );
};
