'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SCREENS = [
  { href: '/', label: 'Today' },
  { href: '/card', label: 'Player card' },
  { href: '/checkin/morning', label: 'Check-in' },
  { href: '/mentor', label: 'Mentor' },
  { href: '/history', label: 'History' },
  { href: '/settings', label: 'Settings' },
] as const;

/** DESIGN.md "Navigation": flat uppercase links above the thumb bar, current
 * page underlined. Day changed and Re-entry are reached from Today's own
 * actions, not from this nav (they aren't destinations you browse to). */
export function DeptNav() {
  const pathname = usePathname();
  return (
    <nav className="dept-nav" aria-label="Screens">
      {SCREENS.map((s) => (
        <Link key={s.href} href={s.href} aria-current={pathname === s.href ? 'page' : undefined}>
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
