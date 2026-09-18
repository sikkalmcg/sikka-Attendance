import './globals.css';
import ClientAuthSync from '@/components/auth/ClientAuthSync';

export const metadata = {
  title: 'Attendance Management Portal',
  description: 'Enterprise Geofenced Employee Attendance & Shift Tracking System',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#1e293b" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-blue-500 selection:text-white">
        <ClientAuthSync />
        {children}
      </body>
    </html>
  );
}

