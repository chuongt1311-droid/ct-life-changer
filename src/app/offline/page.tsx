export default function OfflinePage() {
  return (
    <main className="shell" data-phase="night">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Offline
        </p>
      </header>
      <section className="next">
        <h1 className="next-name">No connection</h1>
        <p className="next-note">
          Anything you log now is queued and sent the moment you&apos;re back online — nothing is lost.
        </p>
      </section>
    </main>
  );
}
