import type { ReactNode } from 'react';

/** DESIGN.md: "a placard heading with a rule trailing off to the right
 * edge" — never a bordered card. */
export function Placard({ children }: { children: ReactNode }) {
  return <h2 className="placard placard-rule">{children}</h2>;
}
