import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { isSunday, format, parseISO } from "date-fns"

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

export function getMonthYearKey() {
  const d = new Date();
  return `${d.getMonth() + 1}-${d.getFullYear()}`;
}

export function checkIfSunday(date: Date | string) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isSunday(d);
}

export function formatDate(date: Date | string) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, "PPP");
}
