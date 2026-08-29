/**
 * useNotificationBadge
 *
 * Reactive hook that tracks the unread notification count.
 *
 * Sources of truth (in order of priority):
 * 1. Live fetch from /api/notifications/unread-count
 * 2. sikka:push-received custom DOM event (dispatched by PushSubscriptionSync)
 * 3. Visibility change / focus (refresh when app comes back to foreground)
 */

import { useState, useEffect, useCallback } from "react";

export function useNotificationBadge(employeeId?: string) {
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fetchCount = useCallback(async () => {
    if (!employeeId) return;
    try {
      const res = await fetch(
        `/api/notifications/unread-count?employeeId=${encodeURIComponent(employeeId)}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        const count = typeof data?.count === "number" ? data.count : 0;
        setUnreadCount(count);
        // Also update PWA app badge
        if (typeof navigator !== "undefined" && "setAppBadge" in navigator) {
          if (count > 0) {
            (navigator as any).setAppBadge(count).catch(() => {});
          } else {
            (navigator as any).clearAppBadge().catch(() => {});
          }
        }
      }
    } catch {
      // Silent — don't break UI on badge fetch errors
    }
  }, [employeeId]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Refresh badge when a push is received in foreground
    const onPush = () => fetchCount();
    window.addEventListener("sikka:push-received", onPush);

    // Refresh when app regains focus / becomes visible
    const onFocus = () => fetchCount();
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchCount();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("sikka:push-received", onPush);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchCount]);

  const markRead = useCallback(() => {
    setUnreadCount(0);
    if (typeof navigator !== "undefined" && "clearAppBadge" in navigator) {
      (navigator as any).clearAppBadge().catch(() => {});
    }
  }, []);

  return { unreadCount, refresh: fetchCount, markRead };
}
