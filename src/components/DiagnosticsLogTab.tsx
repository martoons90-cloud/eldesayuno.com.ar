import React, { useState, useEffect } from 'react';
import { loggerService, LogEntry } from '../services/loggerService';
import { Activity, Trash2, Copy, CheckCheck, Filter, Search, Terminal, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export const DiagnosticsLogTab: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = loggerService.subscribe((updatedLogs) => {
      setLogs([...updatedLogs]);
    });
    return unsubscribe;
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        log.message.toLowerCase().includes(term) ||
        log.category.toLowerCase().includes(term) ||
        log.timestamp.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.category}]: ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelBadge = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-red-100 text-red-800 border border-red-300 rounded">Error</span>;
      case 'warn':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300 rounded">Advertencia</span>;
      case 'success':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 rounded">Éxito</span>;
      case 'fetch':
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-300 rounded">API</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-gray-100 text-gray-800 border border-gray-300 rounded">Info</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-white border border-[#E3DFC8] shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EFEAE0] pb-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-[#1B3B2B] text-[#BFA270] shadow-2xs">
              <Activity className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-[#163323] tracking-wide flex items-center gap-2">
                <span>Registro de Diagnóstico y Auditoría en Vivo</span>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold bg-[#FAF8F5] text-[#163323] border border-[#DDD5BF]">
                  {logs.length} Eventos Capturados
                </span>
              </h3>
              <p className="text-xs text-[#637568]">
                Inspecciona en tiempo real todas las solicitudes de red, errores de consola, sincronizaciones de base de datos y reversiones.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLogs}
              className="px-3 py-2 bg-white hover:bg-[#FAF8F5] border border-[#DDD5BF] text-[#163323] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5 text-[#BFA270]" />}
              <span>{copied ? 'Copiado' : 'Copiar Logs'}</span>
            </button>

            <button
              onClick={() => loggerService.clearLogs()}
              className="px-3 py-2 bg-white hover:bg-red-50 border border-red-200 text-red-700 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>Limpiar</span>
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
          <div className="md:col-span-8 relative">
            <Search className="w-4 h-4 text-[#637568] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por mensaje, categoría o código..."
              className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] border border-[#E3DFC8] text-[#163323] focus:outline-none focus:border-[#1B3B2B] rounded text-xs"
            />
          </div>

          <div className="md:col-span-4 flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#637568] shrink-0" />
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="w-full py-2 px-3 bg-[#FAF8F5] border border-[#E3DFC8] text-[#163323] font-medium focus:outline-none focus:border-[#1B3B2B] rounded text-xs"
            >
              <option value="all">Todos los niveles</option>
              <option value="error">Solo Errores (Error)</option>
              <option value="warn">Advertencias (Warn)</option>
              <option value="success">Éxito (Success)</option>
              <option value="fetch">Peticiones API (Fetch)</option>
              <option value="info">Información (Info)</option>
            </select>
          </div>
        </div>

        {/* Logs Terminal Box */}
        <div className="bg-[#121A16] border border-[#23352B] p-4 font-mono text-[11px] text-[#D4CBB5] h-[500px] overflow-y-auto space-y-2 rounded shadow-inner">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#8A9A8F] space-y-2">
              <Terminal className="w-8 h-8 opacity-40" />
              <p>No se encontraron registros que coincidan con el filtro actual.</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-2 bg-black/40 border border-white/5 flex flex-col gap-1 hover:border-white/15 transition-colors">
                <div className="flex items-center justify-between gap-2 text-[10px] text-emerald-400/80 border-b border-white/5 pb-1">
                  <div className="flex items-center gap-2">
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    {getLevelBadge(log.level)}
                    <span className="text-[#C5BA9E] font-bold">[{log.category}]</span>
                  </div>
                </div>
                <div className="text-white/90 break-all whitespace-pre-wrap">
                  {log.message}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
