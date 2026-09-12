import type { ReactNode } from 'react';

export const metadata = {
  title: "CT's Life Changer",
  description: 'Daily Loop — single-user companion app.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
