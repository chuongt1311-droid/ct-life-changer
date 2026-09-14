const TABLES = [
  'settings', 'templates', 'plans', 'blocks', 'checkins', 'rest_sessions', 'unplanned_indulgence',
  'mentor_messages', 'digests', 'weekly_letters', 'profile_versions', 'push_subscriptions', 'nudges_sent', 'usage',
];

export function ExportLinks() {
  return (
    <>
      <p className="note">
        <a className="btn btn-quiet" href="/api/export?format=json">
          Download everything as JSON
        </a>
      </p>
      <ul className="sessions">
        {TABLES.map((t) => (
          <li key={t} data-rank="next">
            <span className="what">{t}</span>
            <a className="btn btn-quiet" href={`/api/export?format=csv&table=${t}`}>
              CSV
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
