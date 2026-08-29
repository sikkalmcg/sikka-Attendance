/**
 * Dedicated Sound & Vibration Manager for Sikka ERP Notifications
 * Handles:
 * - High-clarity Web Audio API chime synthesis (instant, zero-latency, no network dependency)
 * - Safe device vibration patterns: [0, 300, 200, 300] ms (0ms delay -> 300ms vibrate -> 200ms pause -> 300ms vibrate)
 * - Seamless integration across Android Chrome, WebViews, and desktop browsers
 */

// Vibration pattern: 0ms delay -> 300ms vibrate -> 200ms pause -> 300ms vibrate
export const SIKKA_VIBRATION_PATTERN = [0, 300, 200, 300];

let audioCtxInstance: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtxInstance || audioCtxInstance.state === 'closed') {
      audioCtxInstance = new AudioContextClass();
    }
    if (audioCtxInstance.state === 'suspended') {
      audioCtxInstance.resume().catch(() => {});
    }
    return audioCtxInstance;
  } catch (e) {
    console.warn('AudioContext initialization deferred:', e);
    return null;
  }
}

/**
 * Plays a clean, professional dual-tone notification chime (D5 -> A5 harmonized)
 * using Web Audio API synthesis.
 */
export function playNotificationSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Master Gain node for clean volume envelope
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(0.35, now + 0.03);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    masterGain.connect(ctx.destination);

    // Tone 1: 587.33 Hz (D5) for first 150ms
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // Ramp up to A5
    osc1.connect(masterGain);

    // Tone 2: Harmonic overtone for rich metallic bell chime
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880.00, now);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.20); // D6
    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.15, now);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc2.connect(overtoneGain);
    overtoneGain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.7);

    osc2.start(now);
    osc2.stop(now + 0.55);
  } catch (err) {
    console.warn('Notification sound playback skipped:', err);
  }
}

/**
 * Triggers hardware vibration using standard Android notification pattern [0, 300, 200, 300].
 */
export function triggerDeviceVibration(pattern: number[] = SIKKA_VIBRATION_PATTERN): boolean {
  try {
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      return navigator.vibrate(pattern);
    }
  } catch (err) {
    console.warn('Device vibration not supported or disabled by user settings:', err);
  }
  return false;
}

/**
 * Unified trigger for both Notification Sound and Vibration simultaneously.
 * Respects silent mode & DND settings without throwing errors.
 */
export function playNotificationSoundAndVibrate(): void {
  // 1. Play synthesized notification chime
  playNotificationSound();

  // 2. Trigger device vibration (0ms -> 300ms -> 200ms -> 300ms)
  triggerDeviceVibration(SIKKA_VIBRATION_PATTERN);
}
