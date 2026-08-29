"use client";

/**
 * PushSubscriptionSync & PushSubscriptionBootstrap
 *
 * These components silently re-establish the Web-Push (VAPID) subscription
 * and sync it to the backend every time the app loads — WITHOUT prompting
 * the user.
 *
 * This is the critical missing link: without this, the server has no stored
 * push endpoint to send notifications to when the app is closed.
 *
 * PushSubscriptionSync  — use inside authenticated pages (receives user prop)
 * PushSubscriptionBootstrap — use in root layout (reads user from localStorage)
 */

import { useEffect } from "react";
import { syncDeviceWithBackend } from "@/lib/notification-client";

interface PushSubscriptionSyncProps {
  user: any;
}

/**
 * Place this inside authenticated Dashboard layouts where `user` is available.
 * Also listens for Service Worker push messages to trigger in-app badge updates.
 */
export function PushSubscriptionSync({ user }: PushSubscriptionSyncProps) {
  useEffect(() => {
    if (typeof window === "undefined" || !user) return;

    // If permission already granted, silently refresh the VAPID push
    // subscription in MongoDB — handles token rotation & re-registration.
    const autoSync = async () => {
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          await syncDeviceWithBackend(user);
        }
      } catch (e) {
        console.warn("[PushSync] Auto-sync skipped:", e);
      }
    };

    const t = setTimeout(autoSync, 2500);
    return () => clearTimeout(t);
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Listen for Service Worker push messages.
    // SW sends PUSH_NOTIFICATION_RECEIVED when a push arrives in foreground.
    // Dispatch a custom DOM event for badge hooks to pick up.
    const handleSwMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (event.data.type === "PUSH_NOTIFICATION_RECEIVED") {
        window.dispatchEvent(
          new CustomEvent("sikka:push-received", {
            detail: event.data.payload,
          })
        );
      }
    };

    navigator.serviceWorker.addEventListener("message", handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleSwMessage);
    };
  }, []);

  return null;
}

/**
 * Root-layout version — reads user session from localStorage/cookie
 * without needing any React context. Safe to include in the global layout.
 */
export function PushSubscriptionBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncIfGranted = async () => {
      try {
        if (!("Notification" in window) || Notification.permission !== "granted") return;

        // Read current user from localStorage (set during login)
        let user: any = null;
        try {
          const raw = localStorage.getItem("user");
          if (raw) user = JSON.parse(raw);
        } catch {
          // Try cookie as fallback
          const cookie = document.cookie
            .split("; ")
            .find((row) => row.startsWith("sikka_session="));
          if (cookie) {
            try {
              user = JSON.parse(decodeURIComponent(cookie.split("=")[1]));
            } catch {}
          }
        }

        if (!user) return;

        await syncDeviceWithBackend(user);
      } catch (e) {
        console.warn("[PushBootstrap] Sync skipped:", e);
      }
    };

    // Wait 3s after page load to avoid blocking initial render
    const t = setTimeout(syncIfGranted, 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Relay SW push messages to DOM custom events
    const handleSwMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (event.data.type === "PUSH_NOTIFICATION_RECEIVED") {
        window.dispatchEvent(
          new CustomEvent("sikka:push-received", {
            detail: event.data.payload,
          })
        );
      }
    };

    navigator.serviceWorker.addEventListener("message", handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleSwMessage);
    };
  }, []);

  return null;
}

