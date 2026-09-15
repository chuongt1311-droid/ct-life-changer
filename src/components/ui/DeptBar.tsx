'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Every top-level destination, one tap away, on every screen.
 *
 * Installed to the Home Screen there is no browser back button, so a screen
 * without navigation is a dead end — the old bottom-of-page link list only
 * rendered on three of fifteen routes, and Weekly and Templates were in no
 * list at all.
 *
 * Drawn as the department's index rather than app chrome (DESIGN.md: "department
 * paperwork, not app tiles"): a hairline rule, condensed uppercase small print,
 * and rank carried by brightness — the current screen is full ink and stamped
 * with a rule above it, the rest step back to --ink-3. No tiles, no glow, and
 * no gold: gold stays spent on each screen's single main action.
 *
 * Weekly hangs off History and Templates off Settings, so those two stay
 * reachable without a seventh column. */
const TABS = [
  { href: '/', label: 'Today', owns: (p: string) => p === '/' },
  { href: '/checkin', label: 'Check-in', owns: (p: string) => p.startsWith('/checkin') },
  { href: '/mentor', label: 'Mentor', owns: (p: string) => p.startsWith('/mentor') },
  { href: '/card', label: 'Card', owns: (p: string) => p.startsWith('/card') },
  { href: '/history', label: 'History', owns: (p: string) => p.startsWith('/history') || p.startsWith('/weekly') },
  { href: '/settings', label: 'Settings', owns: (p: string) => p.startsWith('/settings') || p.startsWith('/templates') },
] as const;

/** Routes with no signed-in context to navigate around. */
const BARE = ['/login', '/onboarding', '/offline'];

export function DeptBar() {
  const pathname = usePathname();
  if (BARE.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <nav className="deptbar" aria-label="Screens">
      <div className="deptbar-inner">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} aria-current={t.owns(pathname) ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
