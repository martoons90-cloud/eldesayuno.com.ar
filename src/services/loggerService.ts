export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'fetch';
  category: string;
  message: string;
  details?: any;
}

class LoggerService {
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];
  private maxLogs = 500;
  private isInitialized = false;

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Intercept console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args: any[]) => {
      originalLog(...args);
      this.addLog('info', 'Console', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    };

    console.error = (...args: any[]) => {
      originalError(...args);
      this.addLog('error', 'ConsoleError', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      this.addLog('warn', 'ConsoleWarn', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    };

    // Intercept fetch requests safely
    try {
      const originalFetch = window.fetch;
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const method = init?.method || 'GET';
        const startTime = performance.now();
        try {
          const response = await originalFetch(input, init);
          const duration = Math.round(performance.now() - startTime);
          if (!response.ok) {
            this.addLog('error', 'API_ERROR', `${method} ${url} -> Status ${response.status} (${duration}ms)`);
          } else {
            this.addLog('fetch', 'API_SUCCESS', `${method} ${url} -> Status ${response.status} (${duration}ms)`);
          }
          return response;
        } catch (err: any) {
          const duration = Math.round(performance.now() - startTime);
          this.addLog('error', 'API_EXCEPTION', `${method} ${url} -> ${err?.message || err} (${duration}ms)`);
          throw err;
        }
      };
    } catch (e) {
      console.warn('Could not override window.fetch:', e);
    }

    this.addLog('success', 'System', 'Logger initialized successfully. Tracking console logs and system events.');
  }

  public addLog(level: LogEntry['level'], category: string, message: string, details?: any) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details,
    };
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    this.notifyListeners();
  }

  public getLogs(): LogEntry[] {
    return this.logs;
  }

  public clearLogs() {
    this.logs = [];
    this.addLog('info', 'System', 'Logs cleared by user.');
  }

  public subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.push(listener);
    listener(this.logs);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    for (const l of this.listeners) {
      try {
        l(this.logs);
      } catch {}
    }
  }
}

export const loggerService = new LoggerService();
if (typeof window !== 'undefined') {
  loggerService.init();
}
