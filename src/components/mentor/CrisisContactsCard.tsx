import type { CrisisContact } from '@/core/types';
import { Placard } from '@/components/ui/Placard';

/** Spec §11: shown whenever the local keyword check or a Claude route's
 * `crisis: true` fires. No judgment language, no dismissal without CT
 * seeing the contacts first. `contacts` is `settings.crisisContacts`,
 * configured in Settings during onboarding (Task 22). */
export function CrisisContactsCard({ contacts }: { contacts: CrisisContact[] }) {
  return (
    <div className="stepback" role="alert">
      <Placard>If things feel like too much right now</Placard>
      <p className="note">
        This isn&apos;t something to push through alone. Here&apos;s who to reach — the plan, nudges and guard keep running either way.
      </p>
      {contacts.length === 0 ? (
        <p className="hint">No crisis contacts are configured yet — add them in Settings.</p>
      ) : (
        <ul className="sessions">
          {contacts.map((c) => (
            <li key={c.label} data-rank="next">
              <span className="what">
                {c.label}
                {c.phone && <small>{c.phone}</small>}
              </span>
              {c.phone && (
                <a className="btn btn-quiet" href={`tel:${c.phone}`}>
                  Call
                </a>
              )}
              {c.url && (
                <a className="btn btn-quiet" href={c.url} target="_blank" rel="noreferrer">
                  Open
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
