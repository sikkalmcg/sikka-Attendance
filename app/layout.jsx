import './globals.css';
import ClientAuthSync from '@/components/auth/ClientAuthSync';
import PWARegister from '@/components/PWARegister';
import InstallPrompt from '@/components/InstallPrompt';

export const metadata = {
  title: 'Attendance Management Portal',
  description: 'Enterprise Geofenced Employee Attendance & Shift Tracking System',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Attendance',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#1e293b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#1e293b" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Attendance" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-blue-500 selection:text-white">
        <ClientAuthSync />
        <PWARegister />
        <InstallPrompt />
        {children}
      </body>
    </html>
  );
}

