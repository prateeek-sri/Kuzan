import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'BugPulse AI — Defect Intelligence & Automated Remediation',
  description:
    'Pinpoint software defects down to exact lines and automatically apply verified fixes across repositories.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-black text-[#ededed] antialiased flex flex-col selection:bg-neutral-800 selection:text-white">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-neutral-800/80 bg-black py-6 text-center text-xs text-neutral-500 print:hidden">
          <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono">
            <p>
              BugPulse AI &copy; 2026. Automated Defect Risk & Remediation Engine.
            </p>
            <p className="text-neutral-400">
              Vercel-Grade Precision &bull; Verified Line Calibration &bull; 1-Click Git Patches
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
