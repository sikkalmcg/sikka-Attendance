type RealtimeEventType =
  | 'attendance_updated'
  | 'leave_updated'
  | 'facility_exit_updated'
  | 'notification_created'
  | 'device_registered'
  | 'data_mutation';

export interface RealtimeEventPayload {
  type: RealtimeEventType;
  collection?: string;
  action?: string;
  data?: any;
  timestamp: string;
}

type EventListener = (event: RealtimeEventPayload) => void;

// In-memory subscriber registry for SSE clients within this Node instance
class RealtimeBroadcaster {
  private listeners: Set<EventListener> = new Set();

  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public broadcast(type: RealtimeEventType, payload?: { collection?: string; action?: string; data?: any }) {
    const event: RealtimeEventPayload = {
      type,
      collection: payload?.collection,
      action: payload?.action,
      data: payload?.data,
      timestamp: new Date().toISOString(),
    };

    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.warn('Realtime event listener notification skipped:', err);
      }
    });
  }
}

// Global singleton instance across module reloads in Next.js
declare global {
  var __realtimeBroadcasterInstance: RealtimeBroadcaster | undefined;
}

export const realtimeBroadcaster: RealtimeBroadcaster =
  global.__realtimeBroadcasterInstance ||
  (global.__realtimeBroadcasterInstance = new RealtimeBroadcaster());
