export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
  enabled: boolean;
  lastConnectedAt?: string;
}

const R2_CONFIG_KEY = 'el_desayuno_r2_config_v1';

export const DEFAULT_R2_CONFIG: R2Config = {
  accountId: 'b36aef318f314d0aaaef32a2155d9841',
  accessKeyId: '72d7f16fa1d308f11aa3912f0e942cbe',
  secretAccessKey: '86b4b4deb530203b17da24f057879c07f3741805e98cc10c0c30827bcb1ca98f',
  bucketName: 'el-desayuno',
  publicUrl: '',
  enabled: true,
};

class R2Service {
  private config: R2Config;

  constructor() {
    this.config = this.loadConfig();
    this.checkServerStatus();
  }

  private loadConfig(): R2Config {
    if (typeof window === 'undefined') return DEFAULT_R2_CONFIG;
    const raw = localStorage.getItem(R2_CONFIG_KEY);
    if (!raw) return DEFAULT_R2_CONFIG;
    try {
      return { ...DEFAULT_R2_CONFIG, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_R2_CONFIG;
    }
  }

  public getConfig(): R2Config {
    return { ...this.config };
  }

  public saveConfig(newConfig: Partial<R2Config>): R2Config {
    this.config = { ...this.config, ...newConfig, bucketName: newConfig.bucketName || 'el-desayuno' };
    if (typeof window !== 'undefined') {
      localStorage.setItem(R2_CONFIG_KEY, JSON.stringify(this.config));
    }
    return this.config;
  }

  public isConnected(): boolean {
    return this.config.enabled;
  }

  // Verify server-side or local R2 configuration
  public async checkServerStatus(): Promise<{
    configured: boolean;
    connected: boolean;
    bucketName?: string;
    message?: string;
  }> {
    try {
      const res = await fetch('/api/r2/status');
      const data = await res.json();
      if (data.configured) {
        this.saveConfig({
          enabled: data.connected,
          bucketName: data.bucketName || 'el-desayuno',
          lastConnectedAt: data.connected ? new Date().toISOString() : undefined,
        });
      }
      return data;
    } catch {
      return {
        configured: false,
        connected: false,
        bucketName: this.config.bucketName || 'el-desayuno',
        message: 'No se pudo verificar el estado de Cloudflare R2.',
      };
    }
  }

  // Upload an image / photo directly to Cloudflare R2 Bucket 'el-desayuno'
  public async uploadPhoto(
    base64Data: string,
    filename: string,
    folder: string = 'fotos'
  ): Promise<{ success: boolean; url?: string; key?: string; error?: string }> {
    try {
      const res = await fetch('/api/r2/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Data,
          filename,
          folder,
          config: this.config,
        }),
      });

      const data = await res.json();
      return data;
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Error subiendo imagen a Cloudflare R2',
      };
    }
  }

  // List all photos uploaded to Cloudflare R2
  public async listPhotos(folder: string = 'fotos'): Promise<{
    success: boolean;
    objects?: Array<{ key: string; url: string; size: number; lastModified: string }>;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/r2/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder,
          config: this.config,
        }),
      });

      const data = await res.json();
      return data;
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Error consultando bucket el-desayuno',
      };
    }
  }
}

export const r2Service = new R2Service();
