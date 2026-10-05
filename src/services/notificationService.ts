import { NotificationPush } from '../types';
import { storageService } from './storageService';

// Audio chime generator using browser Web Audio API
function playChimeSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Pleasant dual chime
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.12); // A5
    gain2.gain.setValueAtTime(0.15, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.8);
  } catch {
    // AudioContext might be restricted until user gesture; ignore silently
  }
}

export class PushNotificationService {
  private static instance: PushNotificationService;

  public static getInstance(): PushNotificationService {
    if (!this.instance) {
      this.instance = new PushNotificationService();
    }
    return this.instance;
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch {
      return 'denied';
    }
  }

  public getPermissionStatus(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  public triggerPush(notification: {
    title: string;
    body: string;
    type?: NotificationPush['type'];
    bookingId?: string;
  }) {
    // 1. Play auditory chime
    playChimeSound();

    // 2. Browser native push notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(notification.title, {
          body: notification.body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
        });
      } catch (err) {
        console.warn('Native notification failed:', err);
      }
    }

    // 3. Dispatch in-app UI custom event
    if (typeof window !== 'undefined') {
      const customEvent = new CustomEvent('el-desayuno-push-toast', {
        detail: {
          id: 'toast-' + Date.now(),
          title: notification.title,
          body: notification.body,
          type: notification.type || 'system',
          timestamp: new Date().toISOString(),
        },
      });
      window.dispatchEvent(customEvent);
    }
  }
}

export const pushService = PushNotificationService.getInstance();
