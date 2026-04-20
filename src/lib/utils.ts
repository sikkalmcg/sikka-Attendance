import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { isSunday, format, parseISO, isValid } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Haversine formula to calculate distance between two coordinates in meters
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function numberToIndianWords(num: number): string {
  if (num === 0) return "Zero";
  
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const formatHundreds = (n: number) => {
    let str = '';
    if (n > 99) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    } else if (n > 0) {
      str += a[n];
    }
    return str.trim();
  };

  let result = '';
  let n = Math.floor(num);

  if (n >= 10000000) {
    result += formatHundreds(Math.floor(n / 10000000)) + ' Crore ';
    n %= 10000000;
  }
  if (n >= 100000) {
    result += formatHundreds(Math.floor(n / 100000)) + ' Lakh ';
    n %= 100000;
  }
  if (n >= 1000) {
    result += formatHundreds(Math.floor(n / 1000)) + ' Thousand ';
    n %= 1000;
  }
  if (n > 0) {
    result += formatHundreds(n);
  }

  return result.trim() + " Rupees Only";
}

export function getMonthYearKey() {
  const d = new Date();
  return `${d.getMonth() + 1}-${d.getFullYear()}`;
}

export function checkIfSunday(date: Date | string) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isSunday(d);
}

/**
 * Standard Date Format: MM/dd/yyyy
 */
export function formatDate(date: Date | string) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return "---";
  return format(d, "MM/dd/yyyy");
}

/**
 * Corporate Display Date Format: dd-MMM-yyyy (e.g. 21-Mar-2026)
 */
export function formatDisplayDate(date: Date | string) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return "---";
  return format(d, "dd-MMM-yyyy");
}

/**
 * Color logic for working hours
 */
export function getWorkingHoursColor(hours: number) {
  if (hours < 1.0) return "text-rose-600 bg-rose-50 border-rose-200";
  if (hours <= 6) return "text-orange-600 bg-orange-50 border-orange-200";
  return "text-emerald-600 bg-emerald-50 border-emerald-200";
}

export function formatMinutesToHHMM(minutes: number) {
  if (!minutes || minutes <= 0) return "00:00";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Formats decimal hours into HH:MM (e.g., 8.5 -> 08:30)
 */
export function formatHoursToHHMM(hours: number | null | undefined) {
  if (!hours || hours <= 0) return "00:00";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Generates or retrieves a persistent unique device identifier for this browser instance.
 */
export function getDeviceId() {
  if (typeof window === 'undefined') return null;
  let id = localStorage.getItem('sikka_device_id');
  if (!id) {
    // Generate a new UUID-like identifier
    id = window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('sikka_device_id', id);
  }
  return id;
}
