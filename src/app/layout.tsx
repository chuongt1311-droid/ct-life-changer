import type { ReactNode } from 'react';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './tokens.css';
import './dept.css';
import { IconSprite } from '@/components/icons/IconSprite';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { DeptBar } from '@/components/ui/DeptBar';

export const metadata = {
  title: "CT's Life Changer",
  description: 'Daily Loop — single-user companion app.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <IconSprite />
        <ServiceWorkerRegister />
        {children}
        {/* In the layout, not per page: rendering it screen by screen is how
            twelve of fifteen routes ended up with no way out. */}
        <DeptBar />
      </body>
    </html>
  );
}
