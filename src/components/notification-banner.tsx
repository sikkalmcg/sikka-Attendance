"use client";

import { useState, useEffect } from "react";
import { Bell, BellRing, CheckCircle2, X, Smartphone, Send, AlertTriangle, Volume2, ShieldCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  getNotificationPermissionStatus,
  requestAndEnableNotifications,
  sendTestNotification,
  syncDeviceWithBackend,
} from "@/lib/notification-client";

interface NotificationBannerProps {
  user: any;
}

/**
 * Top Global Notification Banner (shown under header)
 * Only shown when notifications are NOT yet enabled.
 * Automatically disappears once enabled (permission === 'granted').
 */
export function NotificationBanner({ user }: NotificationBannerProps) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | "loading">("loading");
  const [isDismissed, setIsDismissed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const status = getNotificationPermissionStatus();
    setPermission(status);

    const dismissed = localStorage.getItem("sikka_notif_prompt_dismissed") === "true";
    setIsDismissed(dismissed);

    // If permission is already granted, ensure device is registered silently with VAPID
    if (status === "granted" && user) {
      syncDeviceWithBackend(user);
    }
  }, [user]);

  const handleEnableNotifications = async () => {
    setIsProcessing(true);
    try {
      const res = await requestAndEnableNotifications(user);
      setPermission(res.status);

      if (res.granted) {
        setIsDismissed(true);
        localStorage.setItem("sikka_notif_prompt_dismissed", "true");
        toast({
          title: "🔔 Notifications Enabled!",
          description: "Mobile notifications with sound & vibration are now active.",
        });
      } else if (res.status === "denied") {
        toast({
          variant: "destructive",
          title: "Permission Denied",
          description: "Please allow notifications in your browser or app site settings.",
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err?.message || "Failed to enable notifications.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("sikka_notif_prompt_dismissed", "true");
  };

  // Automatically remove / hide banner if already granted, dismissed, or unsupported
  if (permission === "granted" || permission === "unsupported" || permission === "loading" || isDismissed) {
    return null;
  }

  return (
    <div className="w-full bg-gradient-to-r from-amber-500/15 via-primary/10 to-blue-500/15 border-b border-primary/20 px-4 py-3 sm:py-3.5 transition-all animate-in fade-in duration-300">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="relative p-2 rounded-xl bg-primary text-white shadow-md shadow-primary/20 shrink-0">
            <BellRing className="w-5 h-5 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                Enable Mobile Notifications <span className="hidden sm:inline text-xs font-bold text-slate-500">• मोबाइल नोटिफिकेशन्स चालू करें</span>
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                Sound & Vibration
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-600 mt-0.5 leading-relaxed">
              Get real-time Mark IN / Mark OUT shift reminders and company announcements with sound and vibration.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-1 sm:pt-0">
          <Button
            size="sm"
            onClick={handleEnableNotifications}
            disabled={isProcessing}
            className="bg-primary hover:bg-primary/90 text-white font-black text-xs h-9 px-5 rounded-xl shadow-lg shadow-primary/25 flex items-center gap-2 active:scale-95 transition-transform w-full sm:w-auto justify-center"
          >
            <Bell className="w-4 h-4" />
            {isProcessing ? "Enabling..." : "Allow Notifications"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 font-bold text-xs h-9 px-3 rounded-xl shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact Notification Controller for Popovers and Settings
 */
export function NotificationStatusControl({ user }: { user: any }) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setPermission(getNotificationPermissionStatus());
  }, []);

  const handleTestNotification = async () => {
    setIsSendingTest(true);
    try {
      const ok = await sendTestNotification(user);
      if (ok) {
        toast({
          title: "🔔 Test Notification Dispatched",
          description: "Check your phone's notification bar to verify sound & vibration.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Test Failed",
          description: "Please make sure notifications are allowed in your browser/device.",
        });
      }
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleEnable = async () => {
    const res = await requestAndEnableNotifications(user);
    setPermission(res.status);
    if (res.granted) {
      toast({
        title: "🔔 Notifications Enabled",
        description: "Mobile notifications with sound & vibration are active.",
      });
    }
  };

  const isGranted = permission === "granted";

  return (
    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-slate-800">Phone Notifications</span>
        </div>
        <span
          className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase ${
            isGranted
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }`}
        >
          {isGranted ? "Sound & Vibration ON" : "Disabled"}
        </span>
      </div>

      <div className="flex items-center gap-2 pt-1">
        {!isGranted ? (
          <Button
            size="sm"
            onClick={handleEnable}
            className="w-full h-8 text-xs font-bold bg-primary text-white rounded-lg shadow-sm"
          >
            <Bell className="w-3.5 h-3.5 mr-1.5" /> Enable Mobile Alerts
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestNotification}
            disabled={isSendingTest}
            className="w-full h-8 text-xs font-bold text-slate-700 hover:text-primary hover:bg-primary/5 rounded-lg border-slate-200 flex items-center justify-center gap-1.5"
          >
            <Send className="w-3 h-3 text-primary" /> {isSendingTest ? "Sending..." : "Test Notification Alert"}
          </Button>
        )}
      </div>
    </div>
  );
}
