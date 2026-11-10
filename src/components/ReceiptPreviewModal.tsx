import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  DollarSign,
  Building,
  Calendar,
} from 'lucide-react';

import { R2_PUBLIC_URL } from '../config';
import { formatDateDisplay } from '../utils/date';

export interface ReceiptPreviewData {
  url: string;
  title: string;
  subtitle?: string;
  provider?: string;
  amount?: number;
  date?: string;
  notes?: string;
}

interface ReceiptPreviewModalProps {
  receipt: ReceiptPreviewData | null;
  onClose: () => void;
}

/**
 * Transforma cualquier URL relativa, endpoint de API o ruta de archivo
 * a la URL pública correspondiente en Cloudflare R2
 */
export function getPublicR2Url(rawUrl: string): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.includes('/api/r2/file?key=')) {
    const key = trimmed.split('/api/r2/file?key=')[1];
    return `${R2_PUBLIC_URL}/${decodeURIComponent(key)}`;
  }
  const cleanPath = trimmed.replace(/^\/?(uploads\/)?/, '');
  return `${R2_PUBLIC_URL}/${cleanPath}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(';base64,');
  if (parts.length < 2) {
    return new Blob([dataUrl], { type: 'text/plain' });
  }
  const contentType = parts[0].split(':')[1] || 'application/octet-stream';
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({ receipt, onClose }) => {
  const [scale, setScale] = useState(1);
  const viewerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

  // Reset zoom & rotation when a new receipt is opened
  useEffect(() => {
    setScale(1);
    dragStartRef.current = null;
  }, [receipt?.url]);

  // Handle ESC key to close
  useEffect(() => {
    if (!receipt) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [receipt, onClose]);

  const { isPdf, safeBlobUrl, extension } = useMemo(() => {
    if (!receipt?.url) {
      return { isPdf: false, safeBlobUrl: '', extension: 'jpg' };
    }
    const url = receipt.url;
    if (url.startsWith('data:')) {
      const blob = dataUrlToBlob(url);
      const blobUrl = URL.createObjectURL(blob);
      const isPdfFile = blob.type.includes('pdf');
      let ext = 'jpg';
      if (isPdfFile) ext = 'pdf';
      else if (blob.type.includes('png')) ext = 'png';
      else if (blob.type.includes('webp')) ext = 'webp';
      return { isPdf: isPdfFile, safeBlobUrl: blobUrl, extension: ext };
    }
    const publicR2Url = getPublicR2Url(url);
    const cleanUrl = publicR2Url.split('?')[0].toLowerCase();
    const isPdfFile = cleanUrl.endsWith('.pdf');
    let ext = 'jpg';
    if (isPdfFile) ext = 'pdf';
    else if (cleanUrl.endsWith('.png')) ext = 'png';
    else if (cleanUrl.endsWith('.webp')) ext = 'webp';
    return { isPdf: isPdfFile, safeBlobUrl: publicR2Url, extension: ext };
  }, [receipt?.url]);

  // Clean up object URL when unmounting or changing receipt
  useEffect(() => {
    return () => {
      if (safeBlobUrl && safeBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(safeBlobUrl);
      }
    };
  }, [safeBlobUrl]);

  if (!receipt) return null;

  const resetZoom = () => {
    setScale(1);
    requestAnimationFrame(() => {
      if (viewerRef.current) {
        viewerRef.current.scrollLeft = 0;
        viewerRef.current.scrollTop = 0;
      }
    });
  };

  const handleImageDoubleClick = (event: React.MouseEvent<HTMLImageElement>) => {
    if (scale === 2) {
      resetZoom();
      return;
    }
    const imageBounds = event.currentTarget.getBoundingClientRect();
    const focusX = Math.min(1, Math.max(0, (event.clientX - imageBounds.left) / imageBounds.width));
    const focusY = Math.min(1, Math.max(0, (event.clientY - imageBounds.top) / imageBounds.height));
    setScale(2);
    // Después de duplicar el tamaño, ubica bajo el cursor el sector tocado.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const viewer = viewerRef.current;
      const image = imageRef.current;
      if (!viewer || !image) return;
      viewer.scrollLeft = Math.max(0, image.clientWidth * focusX - viewer.clientWidth / 2);
      viewer.scrollTop = Math.max(0, image.clientHeight * focusY - viewer.clientHeight / 2);
    }));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (scale !== 2 || !viewerRef.current) return;
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: viewerRef.current.scrollLeft,
      scrollTop: viewerRef.current.scrollTop,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;
    if (!dragStart || !viewerRef.current) return;
    viewerRef.current.scrollLeft = dragStart.scrollLeft - (event.clientX - dragStart.x);
    viewerRef.current.scrollTop = dragStart.scrollTop - (event.clientY - dragStart.y);
  };

  const handlePointerEnd = () => {
    dragStartRef.current = null;
  };

  const handleDownload = () => {
    const cleanTitle = (receipt.title || 'comprobante')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 40);
    const filename = `${cleanTitle}.${extension}`;

    const link = document.createElement('a');
    link.href = safeBlobUrl || getPublicR2Url(receipt.url);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    const targetUrl = safeBlobUrl || getPublicR2Url(receipt.url);
    if (targetUrl) {
      window.open(targetUrl, '_blank');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#FAF8F5] border border-[#DDD5BF] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col rounded-lg overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#1B3B2B] px-4 py-3 sm:px-6 sm:py-3.5 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="p-1.5 bg-[#BFA270]/20 rounded text-[#D4AF37] shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-serif text-base sm:text-lg font-semibold tracking-wide truncate">
                {receipt.title || 'Comprobante / Factura'}
              </h3>
              {receipt.subtitle && (
                <p className="text-[11px] text-[#A3B899] truncate">{receipt.subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleOpenInNewTab}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
              title="Abrir en pestaña nueva"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
              title="Descargar comprobante"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer ml-1"
              title="Cerrar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Strip (Provider, Amount, Date, Notes) */}
        {(receipt.provider || receipt.amount !== undefined || receipt.date || receipt.notes) && (
          <div className="bg-[#F4EFE6] px-4 py-2 sm:px-6 border-b border-[#E3DFC8] flex flex-wrap items-center justify-between gap-2 text-xs text-[#163323] shrink-0">
            <div className="flex flex-wrap items-center gap-3">
              {receipt.provider && (
                <span className="flex items-center gap-1 font-medium">
                  <Building className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>{receipt.provider}</span>
                </span>
              )}
              {receipt.date && (
                <span className="flex items-center gap-1 text-[#637568]">
                  <Calendar className="w-3.5 h-3.5 text-[#BFA270]" />
                  <span>{formatDateDisplay(receipt.date)}</span>
                </span>
              )}
              {receipt.notes && (
                <span className="text-[#637568] italic max-w-xs truncate" title={receipt.notes}>
                  &ldquo;{receipt.notes}&rdquo;
                </span>
              )}
            </div>

            {receipt.amount !== undefined && (
              <div className="flex items-center gap-1 font-bold text-sm text-[#1B3B2B] bg-[#EAE3D2] px-2.5 py-0.5 rounded border border-[#DDD5BF]">
                <DollarSign className="w-3.5 h-3.5 text-[#BFA270]" />
                <span>${receipt.amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        )}

        {/* Modal Body / Viewer */}
        <div
          ref={viewerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          className={`flex-1 overflow-auto p-4 flex bg-neutral-900/10 min-h-[350px] max-h-[70vh] ${isPdf || scale === 1 ? 'items-center justify-center' : 'items-start justify-start cursor-grab active:cursor-grabbing touch-none'}`}
        >
          {isPdf ? (
            <iframe
              src={safeBlobUrl}
              className="w-full h-full min-h-[500px] border border-[#DDD5BF] rounded bg-white"
              title={receipt.title}
            />
          ) : (
            <div className="min-w-max min-h-max p-2">
              <img
                ref={imageRef}
                src={safeBlobUrl || getPublicR2Url(receipt.url)}
                alt={receipt.title}
                onDoubleClick={handleImageDoubleClick}
                style={{
                  width: scale === 2 ? '200%' : undefined,
                  maxWidth: scale === 2 ? 'none' : '100%',
                  maxHeight: scale === 2 ? 'none' : '62vh',
                }}
                className="object-contain rounded shadow-md border border-[#DDD5BF] select-none cursor-zoom-in"
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#FAF8F5] px-4 py-2.5 sm:px-6 border-t border-[#DDD5BF] flex items-center justify-between shrink-0">
          <p className="text-[11px] text-[#637568]">
            {isPdf ? 'Documento PDF' : scale === 2 ? '200% · Arrastrá para recorrer · Doble clic para volver' : 'Doble clic sobre una zona para acercar al 200%'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1.5 bg-white border border-[#DDD5BF] hover:border-[#1B3B2B] text-xs font-semibold text-[#163323] rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#BFA270]" />
              <span>Descargar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-bold uppercase tracking-wider rounded transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
