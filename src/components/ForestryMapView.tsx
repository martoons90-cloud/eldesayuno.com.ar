import React, { useEffect, useRef, useState } from 'react';
import type { DxfViewer as DxfViewerInstance } from 'dxf-viewer';
import { ArrowLeft, Eraser, MapPinned, MousePointer2, PaintBucket, TreePine, ZoomIn, ZoomOut } from 'lucide-react';

interface ForestryMapViewProps { onGoToIncome: () => void; }
const MAP_WIDTH = 1180;
const MAP_HEIGHT = 1044;
const MAP_SOURCE = '/forestry-map-full.svg';
const ORIGINAL_DXF_SOURCE = '/forestry-original.dxf';
// Límites de modelo declarados por el propio DXF. Se usan para evitar que las
// coordenadas globales del plano desplacen el encuadre fuera del visor.
const ORIGINAL_DXF_EXTENTS = {
  minX: 3557088.065824,
  maxX: 3598138.919864098,
  minY: 7314183.411286832,
  maxY: 7334470.404189366,
};
type SelectionBox = { startX: number; startY: number; endX: number; endY: number };
type ForestryStatus = 'pendiente' | 'en_proceso' | 'deforestado';
type LotForm = { padron: string; product: string; cubicMeters: string; income: string; status: ForestryStatus };
const STATUS_COLORS: Record<ForestryStatus, [number, number, number, number]> = {
  pendiente: [107, 114, 128, 110],
  en_proceso: [234, 179, 8, 145],
  deforestado: [34, 139, 72, 155],
};

/** Plano CAD vectorial: el SVG se mantiene nítido al ampliar; canvas sólo pinta la selección temporal. */
export const ForestryMapView: React.FC<ForestryMapViewProps> = ({ onGoToIncome }) => {
  const paintCanvasRef = useRef<HTMLCanvasElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const mapContentRef = useRef<HTMLDivElement>(null);
  const vectorMapRef = useRef<HTMLDivElement>(null);
  const dxfMapRef = useRef<HTMLDivElement>(null);
  const dxfViewerRef = useRef<DxfViewerInstance | null>(null);
  const lastPaintIndexesRef = useRef<number[]>([]);
  const [zoom, setZoom] = useState(1);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selection, setSelection] = useState<SelectionBox | null>(null);
  const [markedAreas, setMarkedAreas] = useState(0);
  const [message, setMessage] = useState('Plano CAD cargado. Usá el zoom para acercarte y tocá dentro de una parcela para probar el marcado.');
  const [lotForm, setLotForm] = useState<LotForm | null>(null);
  const [mapMarkup, setMapMarkup] = useState('');
  const [dxfLoading, setDxfLoading] = useState(true);

  const prepareMap = () => {
    const paintCanvas = paintCanvasRef.current;
    if (!paintCanvas) return;
    const paintContext = paintCanvas.getContext('2d', { willReadFrequently: true });
    if (!paintContext) return;
    paintContext.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = MAP_WIDTH;
    baseCanvas.height = MAP_HEIGHT;
    const baseContext = baseCanvas.getContext('2d', { willReadFrequently: true });
    if (!baseContext) return;
    const map = new Image();
    map.onload = () => {
      baseContext.fillStyle = '#ffffff';
      baseContext.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
      baseContext.drawImage(map, 0, 0, MAP_WIDTH, MAP_HEIGHT);
      baseCanvasRef.current = baseCanvas;
    };
    map.src = MAP_SOURCE;
  };

  useEffect(() => {
    prepareMap();
    setMarkedAreas(0);
    setLotForm(null);
    setSelection(null);
    setZoom(1);
    setMessage('Plano CAD cargado. Usá el zoom para acercarte a la zona del loteo.');
  }, []);

  // El SVG se inserta en la página para conservar cada línea original del CAD
  // y compensar su grosor en forma inversa al zoom.
  useEffect(() => {
    let cancelled = false;
    fetch(MAP_SOURCE)
      .then((response) => response.ok ? response.text() : Promise.reject(new Error('No se pudo cargar el plano.')))
      .then((markup) => { if (!cancelled) setMapMarkup(markup); })
      .catch(() => { /* La imagen de respaldo se mantiene visible. */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const svg = vectorMapRef.current?.querySelector('svg');
    const drawing = svg?.querySelector('g');
    if (!svg || !drawing) return;
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.display = 'block';
    drawing.setAttribute('stroke-width', (0.65 / zoom).toFixed(4));
  }, [mapMarkup, zoom]);

  useEffect(() => {
    const host = dxfMapRef.current;
    if (!host) return;
    let cancelled = false;
    let viewer: DxfViewerInstance | null = null;

    import('dxf-viewer').then(({ DxfViewer }) => {
      if (cancelled) return;
      const loadedViewer = new DxfViewer(host, {
        autoResize: true,
        colorCorrection: true,
        blackWhiteInversion: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      viewer = loadedViewer;
      dxfViewerRef.current = loadedViewer;
      loadedViewer.SetClearColor('#ffffff');

      if (!loadedViewer.HasRenderer()) {
        setDxfLoading(false);
        setMessage('Este navegador no pudo iniciar el visor CAD. Probá actualizar la página.');
        return;
      }

      loadedViewer.Load({
        url: ORIGINAL_DXF_SOURCE,
        progressCbk: (phase) => {
          if (phase === 'parse' || phase === 'prepare') setMessage('Cargando el DXF original con todas sus líneas…');
        },
      }).then(() => {
        if (cancelled) return;
        ['Imagen', 'Imagen_ZonaUrbanizable', 'fondo'].forEach((layer) => loadedViewer.ShowLayer(layer, false));
        loadedViewer.GetScene().traverse((object) => {
          const material = (object as { material?: unknown }).material;
          const materials = Array.isArray(material) ? material : [material];
          materials.forEach((item) => {
            const color = (item as { uniforms?: { color?: { value?: { setHex: (value: number) => void } } } })?.uniforms?.color?.value;
            color?.setHex(0x161616);
          });
        });
        const origin = loadedViewer.GetOrigin();
        loadedViewer.FitView(
          ORIGINAL_DXF_EXTENTS.minX - origin.x,
          ORIGINAL_DXF_EXTENTS.maxX - origin.x,
          ORIGINAL_DXF_EXTENTS.minY - origin.y,
          ORIGINAL_DXF_EXTENTS.maxY - origin.y,
          0.04,
        );
        loadedViewer.Render();
        let pointerDown: { x: number; y: number } | null = null;
        loadedViewer.Subscribe('pointerdown', (event) => { pointerDown = event.detail.canvasCoord; });
        loadedViewer.Subscribe('pointerup', (event) => {
          const point = event.detail.canvasCoord as { x: number; y: number };
          if (pointerDown && Math.hypot(point.x - pointerDown.x, point.y - pointerDown.y) < 6) paintDxfLot(point.x, point.y, loadedViewer);
          pointerDown = null;
        });
        loadedViewer.Subscribe('viewChanged', () => clearPaintLayer());
        setDxfLoading(false);
        setMessage('DXF original cargado. Usá la rueda para hacer zoom y arrastrá para recorrer el plano.');
      }).catch(() => {
        if (cancelled) return;
        setDxfLoading(false);
        setMessage('No se pudo abrir el DXF original. La vista de respaldo sigue disponible al recargar.');
      });
    }).catch(() => {
      if (cancelled) return;
      setDxfLoading(false);
      setMessage('No se pudo iniciar el visor del DXF original.');
    });

    return () => {
      cancelled = true;
      if (dxfViewerRef.current === viewer) dxfViewerRef.current = null;
      viewer?.Destroy();
    };
  }, []);

  const adjustDxfZoom = (factor: number) => {
    const viewer = dxfViewerRef.current;
    if (!viewer) return;
    const camera = viewer.GetCamera();
    viewer.SetView(camera.position, (camera.right - camera.left) / factor);
  };

  function clearPaintLayer() {
    const canvas = paintCanvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    lastPaintIndexesRef.current = [];
  }

  function paintDxfLot(cssX: number, cssY: number, viewer: DxfViewerInstance) {
    const source = viewer.GetCanvas();
    const canvas = paintCanvasRef.current;
    if (!canvas || !source.clientWidth || !source.clientHeight) return;
    if (canvas.width !== source.width || canvas.height !== source.height) {
      canvas.width = source.width;
      canvas.height = source.height;
    }
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    const base = document.createElement('canvas');
    base.width = source.width;
    base.height = source.height;
    const baseContext = base.getContext('2d', { willReadFrequently: true });
    if (!baseContext) return;
    baseContext.drawImage(source, 0, 0);
    const basePixels = baseContext.getImageData(0, 0, base.width, base.height);
    const paintPixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(cssX * canvas.width / source.clientWidth)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(cssY * canvas.height / source.clientHeight)));
    const start = (y * canvas.width + x) * 4;
    if (paintPixels.data[start + 3] > 0) {
      setMessage('Esa área ya está marcada. Elegí otra parcela o usá “Limpiar prueba”.');
      return;
    }
    if (basePixels.data[start] < 235 || basePixels.data[start + 1] < 235 || basePixels.data[start + 2] < 235) {
      setMessage('Tocaste una línea. Probá dentro del área blanca de una parcela.');
      return;
    }
    const pending: Array<[number, number]> = [[x, y]];
    const paintedIndexes: number[] = [];
    const color = STATUS_COLORS.en_proceso;
    const maxPixels = Math.floor(canvas.width * canvas.height * 0.1);
    while (pending.length && paintedIndexes.length < maxPixels) {
      const [currentX, currentY] = pending.pop()!;
      if (currentX < 0 || currentY < 0 || currentX >= canvas.width || currentY >= canvas.height) continue;
      const index = (currentY * canvas.width + currentX) * 4;
      if (basePixels.data[index] < 235 || basePixels.data[index + 1] < 235 || basePixels.data[index + 2] < 235 || paintPixels.data[index + 3] > 0) continue;
      paintPixels.data[index] = color[0];
      paintPixels.data[index + 1] = color[1];
      paintPixels.data[index + 2] = color[2];
      paintPixels.data[index + 3] = color[3];
      paintedIndexes.push(index);
      pending.push([currentX + 1, currentY], [currentX - 1, currentY], [currentX, currentY + 1], [currentX, currentY - 1]);
    }
    if (paintedIndexes.length >= maxPixels) {
      setMessage('Esa superficie no está cerrada como un lote. Probá otra parcela más delimitada.');
      return;
    }
    context.putImageData(paintPixels, 0, 0);
    lastPaintIndexesRef.current = paintedIndexes;
    setMarkedAreas((current) => current + 1);
    setLotForm({ padron: '', product: 'Madera', cubicMeters: '', income: '', status: 'en_proceso' });
    setMessage(`Lote seleccionado (${paintedIndexes.length.toLocaleString('es-AR')} píxeles). Cargá sus datos a la derecha.`);
  }

  const pointFromEvent = (clientX: number, clientY: number) => {
    const content = mapContentRef.current;
    if (!content) return null;
    const bounds = content.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(MAP_WIDTH - 1, Math.floor((clientX - bounds.left) * MAP_WIDTH / bounds.width))),
      y: Math.max(0, Math.min(MAP_HEIGHT - 1, Math.floor((clientY - bounds.top) * MAP_HEIGHT / bounds.height))),
      cssX: clientX - bounds.left, cssY: clientY - bounds.top, width: bounds.width, height: bounds.height,
    };
  };

  const paintArea = (clientX: number, clientY: number) => {
    const paintCanvas = paintCanvasRef.current;
    const baseCanvas = baseCanvasRef.current;
    const point = pointFromEvent(clientX, clientY);
    if (!paintCanvas || !baseCanvas || !point) return;
    const paintContext = paintCanvas.getContext('2d', { willReadFrequently: true });
    const baseContext = baseCanvas.getContext('2d', { willReadFrequently: true });
    if (!paintContext || !baseContext) return;
    const base = baseContext.getImageData(0, 0, MAP_WIDTH, MAP_HEIGHT);
    const paint = paintContext.getImageData(0, 0, MAP_WIDTH, MAP_HEIGHT);
    const start = (point.y * MAP_WIDTH + point.x) * 4;
    if (paint.data[start + 3] > 0) { setMessage('Esa área ya está marcada en esta prueba. Seleccioná otra o usá “Limpiar prueba”.'); return; }
    if (base.data[start] < 220 || base.data[start + 1] < 220 || base.data[start + 2] < 220) { setMessage('Tocaste una línea del plano. Probá dentro del área blanca de una parcela.'); return; }
    const pending: Array<[number, number]> = [[point.x, point.y]];
    const paintedIndexes: number[] = [];
    const color = STATUS_COLORS.en_proceso;
    let count = 0;
    const maxPixels = Math.floor(MAP_WIDTH * MAP_HEIGHT * 0.14);
    while (pending.length && count < maxPixels) {
      const [x, y] = pending.pop()!;
      if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) continue;
      const index = (y * MAP_WIDTH + x) * 4;
      if (base.data[index] < 230 || base.data[index + 1] < 230 || base.data[index + 2] < 230 || paint.data[index + 3] > 0) continue;
      paint.data[index] = color[0]; paint.data[index + 1] = color[1]; paint.data[index + 2] = color[2]; paint.data[index + 3] = color[3];
      paintedIndexes.push(index);
      count++;
      pending.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    if (count >= maxPixels) { setMessage('Esta zona se comunica con una superficie muy grande. Para marcarla correctamente habrá que cerrar esas líneas del plano.'); return; }
    paintContext.putImageData(paint, 0, 0);
    lastPaintIndexesRef.current = paintedIndexes;
    setMarkedAreas((current) => current + 1);
    setLotForm({ padron: '', product: 'Madera', cubicMeters: '', income: '', status: 'en_proceso' });
    setMessage(`Área seleccionada (${count.toLocaleString('es-AR')} píxeles). Cargá los datos del padrón a la derecha.`);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = pointFromEvent(event.clientX, event.clientY);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!selectionMode) { paintArea(event.clientX, event.clientY); return; }
    setSelection({ startX: point.cssX, startY: point.cssY, endX: point.cssX, endY: point.cssY });
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!selectionMode || !selection) return;
    const point = pointFromEvent(event.clientX, event.clientY);
    if (point) setSelection((current) => current ? { ...current, endX: point.cssX, endY: point.cssY } : null);
  };
  const handlePointerUp = () => {
    if (!selectionMode || !selection) return;
    const content = mapContentRef.current;
    const viewport = viewportRef.current;
    if (!content || !viewport) return;
    const bounds = content.getBoundingClientRect();
    const width = Math.abs(selection.endX - selection.startX);
    const height = Math.abs(selection.endY - selection.startY);
    if (width < 24 || height < 24) { setSelection(null); setMessage('Arrastrá un rectángulo un poco más grande para seleccionar la zona a ampliar.'); return; }
    const scale = Math.min(bounds.width / width, bounds.height / height) * 0.82;
    const nextZoom = Math.min(12, Math.max(zoom, Number((zoom * scale).toFixed(2))));
    const focusX = (Math.min(selection.startX, selection.endX) + width / 2) / bounds.width;
    const focusY = (Math.min(selection.startY, selection.endY) + height / 2) / bounds.height;
    setZoom(nextZoom); setSelection(null);
    setMessage(`Zoom aplicado al ${Math.round(nextZoom * 100)}%. Podés desplazarte dentro del plano y marcar un lote.`);
    window.setTimeout(() => { viewport.scrollLeft = Math.max(0, focusX * viewport.scrollWidth - viewport.clientWidth / 2); viewport.scrollTop = Math.max(0, focusY * viewport.scrollHeight - viewport.clientHeight / 2); }, 0);
  };
  const resetTest = () => {
    clearPaintLayer();
    setMarkedAreas(0);
    setLotForm(null);
    setMessage('Plano restablecido. Podés volver a probar otra parcela.');
  };
  const updateLotStatus = (status: ForestryStatus) => {
    if (!lotForm) return;
    setLotForm({ ...lotForm, status });
    const context = paintCanvasRef.current?.getContext('2d', { willReadFrequently: true });
    if (!context || lastPaintIndexesRef.current.length === 0) return;
    const canvas = paintCanvasRef.current;
    if (!canvas) return;
    const paint = context.getImageData(0, 0, canvas.width, canvas.height);
    const color = STATUS_COLORS[status];
    lastPaintIndexesRef.current.forEach((index) => {
      paint.data[index] = color[0]; paint.data[index + 1] = color[1]; paint.data[index + 2] = color[2]; paint.data[index + 3] = color[3];
    });
    context.putImageData(paint, 0, 0);
    setMessage(`Estado visual actualizado: ${status === 'pendiente' ? 'pendiente' : status === 'en_proceso' ? 'en deforestación' : 'deforestado'}.`);
  };
  const selectionStyle = selection ? { left: `${Math.min(selection.startX, selection.endX)}px`, top: `${Math.min(selection.startY, selection.endY)}px`, width: `${Math.abs(selection.endX - selection.startX)}px`, height: `${Math.abs(selection.endY - selection.startY)}px` } : undefined;

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
          <p className="text-xs text-[#526657] mt-1 max-w-2xl">Plano CAD completo: usá el zoom para recorrer y trabajar cualquier sector sin perder nitidez.</p>
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
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"><MapPinned className="w-4 h-4 text-[#BFA270]" /> Plano CAD completo</span>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-1 text-[10px] font-bold uppercase bg-white/10 text-white"><MousePointer2 className="w-3 h-3 inline mr-1" />Rueda: zoom · arrastrar: mover</span>
              <button type="button" onClick={() => adjustDxfZoom(1 / 1.5)} className="p-1 text-white hover:bg-white/15 cursor-pointer" title="Alejar">
                <ZoomOut className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => adjustDxfZoom(1.5)} className="p-1 text-white hover:bg-white/15 cursor-pointer" title="Acercar">
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative bg-[#F7F7F5] h-[72vh] min-h-[520px] overflow-hidden">
            <div ref={dxfMapRef} className="absolute inset-0" aria-label="Plano DXF forestal original" />
            <canvas ref={paintCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />
            {dxfLoading && <div className="absolute inset-0 grid place-items-center bg-white/90 text-xs font-bold text-[#163323]">Cargando DXF original…</div>}
          </div>
        </div>

        <aside className="bg-white border border-[#E3DFC8] shadow-xs p-4 space-y-4 text-xs">
          <div className="flex items-center gap-2 text-[#163323] font-bold uppercase tracking-wider"><PaintBucket className="w-4 h-4 text-emerald-700" /> {lotForm ? 'Lote seleccionado' : 'Balde de pintura'}</div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-950 leading-relaxed">{message}</div>
          <div className="p-3 border border-[#E8E2D2] bg-[#FAF8F5] space-y-2">
            <p className="font-bold text-[#35483A] uppercase tracking-wide text-[10px]">Estados del plano</p>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-slate-500 border border-slate-600" /> Pendiente</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-yellow-500 border border-yellow-600" /> En deforestación</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-emerald-700 border border-emerald-800" /> Deforestado</div>
          </div>
          {lotForm ? (
            <div className="space-y-3 border-t border-[#E8E2D2] pt-4">
              <p className="font-bold text-[#163323]">Datos del padrón seleccionado</p>
              <label className="block font-semibold text-[#35483A]">Estado
                <select value={lotForm.status} onChange={(event) => updateLotStatus(event.target.value as ForestryStatus)} className="mt-1 w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] font-normal">
                  <option value="pendiente">Pendiente</option>
                  <option value="en_proceso">En deforestación</option>
                  <option value="deforestado">Deforestado</option>
                </select>
              </label>
              <label className="block font-semibold text-[#35483A]">Padrón
                <input value={lotForm.padron} onChange={(event) => setLotForm({ ...lotForm, padron: event.target.value })} placeholder="Ej. 123234" className="mt-1 w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] font-mono font-normal" />
              </label>
              <label className="block font-semibold text-[#35483A]">Producto
                <select value={lotForm.product} onChange={(event) => setLotForm({ ...lotForm, product: event.target.value })} className="mt-1 w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] font-normal"><option>Madera</option><option>Leña</option><option>Biomasa</option><option>Otro producto forestal</option></select>
              </label>
              <label className="block font-semibold text-[#35483A]">Volumen (m³)
                <input type="number" min="0" step="0.01" value={lotForm.cubicMeters} onChange={(event) => setLotForm({ ...lotForm, cubicMeters: event.target.value })} placeholder="0,00" className="mt-1 w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] font-mono font-normal" />
              </label>
              <label className="block font-semibold text-[#35483A]">Ingreso estimado (ARS)
                <input type="number" min="0" step="0.01" value={lotForm.income} onChange={(event) => setLotForm({ ...lotForm, income: event.target.value })} placeholder="0,00" className="mt-1 w-full p-2 bg-[#FAF8F5] border border-[#DCD4C0] font-mono font-normal" />
              </label>
              <p className="text-[10px] text-[#7A8E7E] leading-relaxed">Esta ficha es de prueba: todavía no se graba. Cuando confirmemos que el lote marcado es correcto, la vinculamos al ingreso real.</p>
            </div>
          ) : (
            <div className="p-3 bg-[#FAF8F5] border border-[#E5DEC9] space-y-2">
              <div className="flex justify-between"><span className="text-[#637568]">Áreas probadas</span><strong className="font-mono text-[#163323]">{markedAreas}</strong></div>
              <div className="flex justify-between"><span className="text-[#637568]">Estado</span><strong className="text-amber-800">Sin guardar</strong></div>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
};
