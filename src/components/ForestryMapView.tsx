import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Eraser, MapPinned, MousePointer2, PaintBucket, TreePine } from 'lucide-react';

interface ForestryMapViewProps {
  onGoToIncome: () => void;
}

const MAP_WIDTH = 1180;
const MAP_HEIGHT = 1044;

/**
 * Prueba visual de selección por "balde de pintura" sobre el detalle del
 * plano Forestal entregado por el usuario. No persiste ningún dato todavía:
 * primero validamos que las divisiones se comporten bien al tocarse.
 */
export const ForestryMapView: React.FC<ForestryMapViewProps> = ({ onGoToIncome }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [markedAreas, setMarkedAreas] = useState(0);
  const [message, setMessage] = useState('Tocá dentro de una parcela para probar el marcado.');

  const drawBaseMap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    const map = new Image();
    map.onload = () => {
      context.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
      context.drawImage(map, 0, 0, MAP_WIDTH, MAP_HEIGHT);
    };
    map.src = '/forestry-map.svg';
  };

  useEffect(() => {
    drawBaseMap();
  }, []);

  const handlePaint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    const bounds = canvas.getBoundingClientRect();
    const startX = Math.floor((event.clientX - bounds.left) * (MAP_WIDTH / bounds.width));
    const startY = Math.floor((event.clientY - bounds.top) * (MAP_HEIGHT / bounds.height));
    const image = context.getImageData(0, 0, MAP_WIDTH, MAP_HEIGHT);
    const { data } = image;
    const startIndex = (startY * MAP_WIDTH + startX) * 4;

    // Si se toca una línea negra, la persona debe tocar dentro de la parcela.
    if (data[startIndex] < 220 || data[startIndex + 1] < 220 || data[startIndex + 2] < 220) {
      setMessage('Tocaste una línea del plano. Probá dentro del área blanca de una parcela.');
      return;
    }

    const pending: Array<[number, number]> = [[startX, startY]];
    let paintedPixels = 0;
    // Límite preventivo: evita que una abertura del dibujo pinte todo el plano.
    const maxPixels = Math.floor(MAP_WIDTH * MAP_HEIGHT * 0.14);

    while (pending.length > 0 && paintedPixels < maxPixels) {
      const [x, y] = pending.pop()!;
      if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) continue;
      const index = (y * MAP_WIDTH + x) * 4;
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
            Plano CAD en fondo blanco y líneas negras. Probá el marcado antes de vincular cada lote con su padrón e ingreso.
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

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
        <div className="bg-white border border-[#DCD4C0] shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-[#163323] text-white flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2"><MapPinned className="w-4 h-4 text-[#BFA270]" /> Plano Forestal</span>
            <span className="text-[10px] text-emerald-100">Prueba sin guardar</span>
          </div>
          <div className="p-3 sm:p-5 bg-[#F7F7F5]">
            <canvas
              ref={canvasRef}
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              onPointerDown={handlePaint}
              className="w-full h-auto bg-white border border-[#202020] cursor-crosshair touch-none shadow-sm"
              aria-label="Plano forestal clickeable para prueba de marcado"
            />
          </div>
        </div>

        <aside className="bg-white border border-[#E3DFC8] shadow-xs p-4 space-y-4 text-xs">
          <div className="flex items-center gap-2 text-[#163323] font-bold uppercase tracking-wider"><PaintBucket className="w-4 h-4 text-emerald-700" /> Balde de pintura</div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-950 leading-relaxed">{message}</div>
          <div className="p-3 bg-[#FAF8F5] border border-[#E5DEC9] space-y-2">
            <div className="flex justify-between"><span className="text-[#637568]">Áreas probadas</span><strong className="font-mono text-[#163323]">{markedAreas}</strong></div>
            <div className="flex justify-between"><span className="text-[#637568]">Estado</span><strong className="text-amber-800">Sin guardar</strong></div>
          </div>
          <div className="border-t border-[#E8E2D2] pt-3 text-[#637568] leading-relaxed flex gap-2">
            <MousePointer2 className="w-4 h-4 shrink-0 text-[#BFA270]" />
            Cuando confirmemos que el pintado identifica cada lote, el siguiente paso será pedir padrón, fecha, hectáreas e ingreso al tocarlo.
          </div>
        </aside>
      </section>
    </div>
  );
};
