import React, { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ArrowLeft, Eraser, Eye, LayoutGrid, MapPinned, MousePointer2, PaintBucket, TreePine, ZoomIn, ZoomOut } from 'lucide-react';

interface ForestryMapViewProps {
  onGoToIncome: () => void;
}

const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;
const MAP_SOURCE = '/forestry-plan.pdf?revision=plano-grande-original-v1';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const normalizeLineInk = (context: CanvasRenderingContext2D, width: number, height: number) => {
  // Procesar por franjas evita un pico de memoria al usar el zoom de 1500%.
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
 * Vista del plano forestal completo con líneas finas CAD, navegación fluida,
 * zoom dinámico (desde vista completa 100% de todo el loteo hasta detalle cercano)
 * y prueba de marcado de parcelas ("balde de pintura").
 */
export const ForestryMapView: React.FC<ForestryMapViewProps> = ({ onGoToIncome }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const overviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
  const renderSequenceRef = useRef(0);
  const overviewRenderedRef = useRef(false);
  const hasInitialScrolledRef = useRef(false);
  const focalPointRef = useRef<{ x: number; y: number } | null>(null);
  const [markedAreas, setMarkedAreas] = useState(0);
  const [zoom, setZoom] = useState(0.85);
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

  const drawBaseMap = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderSequence = ++renderSequenceRef.current;
    canvas.width = Math.round(MAP_WIDTH * zoom);
    canvas.height = Math.round(MAP_HEIGHT * zoom);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;

    try {
      const pdf = pdfDocumentRef.current ?? await getDocument({ url: MAP_SOURCE }).promise;
      pdfDocumentRef.current = pdf;
      const page = await pdf.getPage(1);
      const pdfViewport = page.getViewport({ scale: zoom });
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
        // Al abrir, ajustar automáticamente para ver el plano completo en pantalla
        const vp = viewportRef.current;
        const fitScale = Math.min((vp.clientWidth - 20) / MAP_WIDTH, (vp.clientHeight - 20) / MAP_HEIGHT);
        if (fitScale > 0 && fitScale < 1.2) {
          setZoom(Number(fitScale.toFixed(2)));
        }
      } else if (focalPointRef.current && viewportRef.current) {
        const displayW = Math.round(MAP_WIDTH * zoom);
        const displayH = Math.round(MAP_HEIGHT * zoom);
        const targetX = Math.round(focalPointRef.current.x * displayW - viewportRef.current.clientWidth / 2);
        const targetY = Math.round(focalPointRef.current.y * displayH - viewportRef.current.clientHeight / 2);
        viewportRef.current.scrollLeft = Math.max(0, targetX);
        viewportRef.current.scrollTop = Math.max(0, targetY);
        focalPointRef.current = null;
      }

      requestAnimationFrame(syncMinimap);
    } catch {
      setMessage('No se pudo cargar el plano original. Actualizá la página para reintentar.');
    }
  };

  useEffect(() => { void drawBaseMap(); }, [zoom]);

  const handleZoomChange = (nextZoom: number) => {
    const clamped = Math.max(0.4, Math.min(15, Number(nextZoom.toFixed(2))));
    if (clamped === zoom) return;
    const viewport = viewportRef.current;
    if (viewport) {
      const displayW = Math.round(MAP_WIDTH * zoom);
      const displayH = Math.round(MAP_HEIGHT * zoom);
      focalPointRef.current = {
        x: (viewport.scrollLeft + viewport.clientWidth / 2) / displayW,
        y: (viewport.scrollTop + viewport.clientHeight / 2) / displayH,
      };
    }
    setZoom(clamped);
  };

  const fitFullPlan = () => {
    const vp = viewportRef.current;
    if (!vp) return;
    const fitScale = Math.min((vp.clientWidth - 20) / MAP_WIDTH, (vp.clientHeight - 20) / MAP_HEIGHT);
    const targetZoom = Number(Math.max(0.4, Math.min(1, fitScale)).toFixed(2));
    focalPointRef.current = { x: 0.5, y: 0.5 };
    setZoom(targetZoom);
    setMessage('Plano completo ajustado a pantalla.');
  };

  const focusDetail = () => {
    focalPointRef.current = { x: 0.45, y: 0.45 };
    setZoom(2.2);
    setMessage('Vista ampliada: detalle de manzanas y parcelas individuales.');
  };

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
      void drawBaseMap();
      setMessage('Esta zona se comunica con una superficie muy grande. Para marcarla bien habrá que cerrar esas líneas del plano.');
      return;
    }

    context.putImageData(image, 0, 0);
    setMarkedAreas((current) => current + 1);
    setMessage(`Área marcada de prueba (${paintedPixels.toLocaleString('es-AR')} píxeles). Todavía no se guardó ningún dato.`);
  };

  const resetTest = () => {
    void drawBaseMap();
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
            Plano CAD completo con líneas finas nítidas en fondo blanco. Navegá el plano entero o acercate a cada manzana sin pérdida de trazado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={fitFullPlan} className={`px-3 py-2 border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${zoom <= 1 ? 'bg-[#163323] text-white border-[#163323]' : 'bg-white text-[#163323] border-[#DCD4C0] hover:bg-[#F4EFE6]'}`}>
            <LayoutGrid className="w-3.5 h-3.5" /> Plano completo
          </button>
          <button type="button" onClick={focusDetail} className={`px-3 py-2 border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${zoom > 1.5 ? 'bg-[#163323] text-white border-[#163323]' : 'bg-white text-[#163323] border-[#DCD4C0] hover:bg-[#F4EFE6]'}`}>
            <Eye className="w-3.5 h-3.5" /> Vista detalle
          </button>
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
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"><MapPinned className="w-4 h-4 text-[#BFA270]" /> Plano Forestal · {zoom <= 1 ? 'Plano completo' : 'Detalle de lotes'}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-emerald-100 hidden sm:inline">Rueda o barras para recorrer</span>
              <button type="button" onClick={() => handleZoomChange(zoom - 1)} disabled={zoom <= 0.4} className="p-1 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer" title="Alejar">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] min-w-8 text-center">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => handleZoomChange(zoom + 1)} disabled={zoom >= 15} className="p-1 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer" title="Acercar">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
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
            Usá "Plano completo" para ver todo el desarrollo de punta a punta, o "Vista detalle" para recorrer los lotes con gran tamaño y líneas nítidas.
          </div>
        </aside>
      </section>
    </div>
  );
};
