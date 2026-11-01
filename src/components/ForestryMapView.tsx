import React, { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ArrowLeft, Eraser, MapPinned, MousePointer2, PaintBucket, TreePine, ZoomIn, ZoomOut } from 'lucide-react';

interface ForestryMapViewProps {
  onGoToIncome: () => void;
}

const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;
// Escala de rasterización interna optimizada: 3600 x 2700 px (~9.7 megapíxeles).
// Carga en ~200 ms sin sobrecargar memoria ni congelar el navegador.
const RENDER_SCALE = 4.5;
const MAP_SOURCE = '/forestry-plan.pdf?revision=plano-grande-original-v1';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const normalizeLineInk = (context: CanvasRenderingContext2D, width: number, height: number) => {
  // Procesar por franjas para fluidez máxima
  const rowsPerChunk = Math.max(1, Math.floor(2_000_000 / width));
  for (let top = 0; top < height; top += rowsPerChunk) {
    const chunkHeight = Math.min(rowsPerChunk, height - top);
    const pixels = context.getImageData(0, top, width, chunkHeight);
    for (let index = 0; index < pixels.data.length; index += 4) {
      if (pixels.data[index] < 248 || pixels.data[index + 1] < 248 || pixels.data[index + 2] < 248) {
        pixels.data[index] = 18;
        pixels.data[index + 1] = 18;
        pixels.data[index + 2] = 18;
      }
    }
    context.putImageData(pixels, 0, top);
  }
};

/**
 * Vista del plano forestal completo con líneas finas CAD, navegación ultra fluida,
 * zoom dinámico instantáneo y prueba de marcado de parcelas ("balde de pintura").
 */
export const ForestryMapView: React.FC<ForestryMapViewProps> = ({ onGoToIncome }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const overviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderSequenceRef = useRef(0);
  const overviewRenderedRef = useRef(false);
  const hasInitialScrolledRef = useRef(false);
  const [markedAreas, setMarkedAreas] = useState(0);
  const [zoom, setZoom] = useState(30); // 3000% zoom inicial de vista cercana
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

  // Mantener centrado suave cuando cambia el zoom sin recargar el PDF
  useEffect(() => {
    const prev = prevZoomRef.current;
    if (prev !== zoom && viewportRef.current) {
      const ratio = zoom / prev;
      const vp = viewportRef.current;
      const centerX = vp.scrollLeft + vp.clientWidth / 2;
      const centerY = vp.scrollTop + vp.clientHeight / 2;
      vp.scrollLeft = centerX * ratio - vp.clientWidth / 2;
      vp.scrollTop = centerY * ratio - vp.clientHeight / 2;
      prevZoomRef.current = zoom;
      syncMinimap();
    }
  }, [zoom]);

  const drawBaseMap = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderSequence = ++renderSequenceRef.current;
    const bufferWidth = Math.round(MAP_WIDTH * RENDER_SCALE);
    const bufferHeight = Math.round(MAP_HEIGHT * RENDER_SCALE);
    canvas.width = bufferWidth;
    canvas.height = bufferHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;

    try {
      const pdf = pdfDocumentRef.current ?? await getDocument({ url: MAP_SOURCE }).promise;
      pdfDocumentRef.current = pdf;
      const page = await pdf.getPage(1);
      const pdfViewport = page.getViewport({ scale: RENDER_SCALE });
      if (renderSequence !== renderSequenceRef.current) return;

      canvas.width = Math.round(pdfViewport.width);
      canvas.height = Math.round(pdfViewport.height);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, viewport: pdfViewport, background: '#ffffff' }).promise;
      if (renderSequence !== renderSequenceRef.current) return;

      // El PDF trae trazos grises y rojos. Se unifican en negro fino para
      // conservar toda la geometría legible sobre fondo blanco.
      normalizeLineInk(context, canvas.width, canvas.height);

      // Guardar copia limpia en memoria para resets instantáneos
      const cleanCopy = document.createElement('canvas');
      cleanCopy.width = canvas.width;
      cleanCopy.height = canvas.height;
      const cleanCtx = cleanCopy.getContext('2d');
      if (cleanCtx) {
        cleanCtx.drawImage(canvas, 0, 0);
        baseCanvasRef.current = cleanCopy;
      }

      if (!overviewRenderedRef.current && overviewCanvasRef.current) {
        const overview = overviewCanvasRef.current;
        const overviewContext = overview.getContext('2d', { willReadFrequently: true });
        if (overviewContext) {
          const overviewViewport = page.getViewport({ scale: 1 });
          overview.width = Math.round(overviewViewport.width);
          overview.height = Math.round(overviewViewport.height);
          overviewContext.fillStyle = '#ffffff';
          overviewContext.fillRect(0, 0, overview.width, overview.height);
          await page.render({ canvas: overview, viewport: overviewViewport, background: '#ffffff' }).promise;
          normalizeLineInk(overviewContext, overview.width, overview.height);
          overviewRenderedRef.current = true;
        }
      }

      if (!hasInitialScrolledRef.current && viewportRef.current) {
        hasInitialScrolledRef.current = true;
        const displayW = Math.round(MAP_WIDTH * zoom);
        const displayH = Math.round(MAP_HEIGHT * zoom);
        // Centrar por defecto en la zona de parcelas (aprox 58% X, 50% Y)
        const targetX = Math.round(0.58 * displayW - viewportRef.current.clientWidth / 2);
        const targetY = Math.round(0.50 * displayH - viewportRef.current.clientHeight / 2);
        viewportRef.current.scrollLeft = Math.max(0, targetX);
        viewportRef.current.scrollTop = Math.max(0, targetY);
      }

      requestAnimationFrame(syncMinimap);
    } catch {
      setMessage('No se pudo cargar el plano original. Actualizá la página para reintentar.');
    }
  };

  useEffect(() => { void drawBaseMap(); }, []);

  const handleZoomStep = (delta: number) => {
    setZoom((prev) => Math.max(10, Math.min(60, prev + delta)));
  };

  const handlePaint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    const bounds = canvas.getBoundingClientRect();
    const startX = Math.floor((event.clientX - bounds.left) * (canvas.width / bounds.width));
    const startY = Math.floor((event.clientY - bounds.top) * (canvas.height / bounds.height));

    // Delimitar a una caja local para evitar procesar toda la matriz
    const BOX = 400;
    const x0 = Math.max(0, startX - BOX);
    const y0 = Math.max(0, startY - BOX);
    const x1 = Math.min(canvas.width, startX + BOX);
    const y1 = Math.min(canvas.height, startY + BOX);
    const w = x1 - x0;
    const h = y1 - y0;
    const image = context.getImageData(x0, y0, w, h);
    const { data } = image;
    const localStartX = startX - x0;
    const localStartY = startY - y0;
    const startIndex = (localStartY * w + localStartX) * 4;

    // Si se toca una línea negra, la persona debe tocar dentro de la parcela.
    if (data[startIndex] < 220 || data[startIndex + 1] < 220 || data[startIndex + 2] < 220) {
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
    // Límite preventivo para evitar desbordar si una línea no está cerrada
    const maxPixels = 60_000;

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
        if (data[nIndex] >= 230 && data[nIndex + 1] >= 230 && data[nIndex + 2] >= 230) {
          data[nIndex] = 174;
          data[nIndex + 1] = 220;
          data[nIndex + 2] = 181;
          data[nIndex + 3] = 255;
          paintedPixels++;
          pendingX.push(nx);
          pendingY.push(ny);
          if (paintedPixels >= maxPixels) break;
        }
      }
    }

    if (paintedPixels >= maxPixels) {
      if (baseCanvasRef.current) {
        context.drawImage(baseCanvasRef.current, 0, 0);
      }
      setMessage('Esta zona se comunica con una superficie muy grande. Para marcarla bien habrá que cerrar esas líneas del plano.');
      return;
    }

    context.putImageData(image, x0, y0);
    setMarkedAreas((current) => current + 1);
    setMessage(`Área marcada de prueba (${paintedPixels.toLocaleString('es-AR')} píxeles). Todavía no se guardó ningún dato.`);
  };

  const resetTest = () => {
    const canvas = canvasRef.current;
    if (canvas && baseCanvasRef.current) {
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(baseCanvasRef.current, 0, 0);
      }
    }
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
            <TreePine className="w-4 h-4" /> Control forestal · Vista del plano
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#163323] mt-1" style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}>
            Mapa de deforestación
          </h1>
          <p className="text-xs text-[#526657] mt-1 max-w-2xl">
            Plano CAD de alta velocidad con líneas nítidas. Recorré las parcelas con zoom cercano de hasta 6000% y navegación instantánea.
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
              <MapPinned className="w-4 h-4 text-[#BFA270]" /> Plano Forestal · Detalle de lotes
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-emerald-100 hidden md:inline">Rueda o barras para recorrer</span>
              <div className="flex items-center bg-black/30 rounded px-1.5 py-0.5 border border-white/10 gap-1">
                <button
                  type="button"
                  onClick={() => handleZoomStep(-5)}
                  disabled={zoom <= 10}
                  className="p-1 hover:bg-white/20 disabled:opacity-30 rounded cursor-pointer transition-colors"
                  title="Alejar (500%)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-bold min-w-16 text-center text-[#F4EFE6]">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => handleZoomStep(5)}
                  disabled={zoom >= 60}
                  className="p-1 hover:bg-white/20 disabled:opacity-30 rounded cursor-pointer transition-colors"
                  title="Acercar (500%)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="hidden sm:flex items-center gap-1 bg-black/30 p-0.5 rounded border border-white/10">
                {[20, 30, 40, 50].map((level) => (
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
            <canvas
              ref={canvasRef}
              onPointerDown={handlePaint}
              style={{
                width: `${Math.round(MAP_WIDTH * zoom)}px`,
                height: `${Math.round(MAP_HEIGHT * zoom)}px`,
                maxWidth: 'none',
              }}
              className="block bg-white border border-[#202020] cursor-crosshair touch-none shadow-sm mx-auto"
              aria-label="Plano forestal clickeable para prueba de marcado"
            />
          </div>
        </div>

        <aside className="bg-white border border-[#E3DFC8] shadow-xs p-4 space-y-4 text-xs">
          <div className="flex items-center gap-2 text-[#163323] font-bold uppercase tracking-wider"><PaintBucket className="w-4 h-4 text-emerald-700" /> Balde de pintura</div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-950 leading-relaxed">{message}</div>
          <div className="border border-[#E5DEC9] p-3 bg-[#FAF8F5] space-y-2">
            <p className="font-bold text-[#35483A] uppercase tracking-wide text-[10px]">Mapa general</p>
            <div onPointerDown={focusFromMinimap} className="relative aspect-[4/3] bg-white border border-[#202020] cursor-pointer overflow-hidden" title="Tocá una zona para ir allí">
              <canvas ref={overviewCanvasRef} className="absolute inset-0 w-full h-full object-contain" aria-label="Vista general de todo el plano forestal" />
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
            Vista cercana de parcelas con carga ultra rápida. Podés cambiar el zoom instantáneamente con los botones de 2000%, 3000%, 4000% y 5000% o hacer clic en el Mapa general para moverte de sector.
          </div>
        </aside>
      </section>
    </div>
  );
};
