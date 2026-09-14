/** The Performance Department's icon set (DESIGN.md "Icons"). Render this
 * once, near the root layout — every <Icon name="…" /> resolves against it
 * via <use href="#i-…">. Ported verbatim from design/prototype/*.html. */
export function IconSprite() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0 }}>
      <symbol id="i-up" viewBox="0 0 24 24"><path d="M12 19V6M6 12l6-6 6 6" /></symbol>
      <symbol id="i-flat" viewBox="0 0 24 24"><path d="M5 12h14M14 7l5 5-5 5" /></symbol>
      <symbol id="i-down" viewBox="0 0 24 24"><path d="M12 5v13M6 12l6 6 6-6" /></symbol>
      <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></symbol>
      <symbol id="i-rest" viewBox="0 0 24 24"><path d="M19 14.5A8 8 0 0 1 9.5 5a8 8 0 1 0 9.5 9.5Z" /></symbol>
      <symbol id="i-shift" viewBox="0 0 24 24"><path d="M4 7h9l-2.5-2.5M20 17h-9l2.5 2.5M4 7l2.5 2.5M20 17l-2.5-2.5" /></symbol>
      <symbol id="i-moved" viewBox="0 0 24 24"><path d="M5 12h12M13 7l5 5-5 5" /></symbol>
      <symbol id="i-shorter" viewBox="0 0 24 24"><path d="M4 12h16M8 8v8M16 8v8" /></symbol>
      <symbol id="i-dropped" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></symbol>
      <symbol id="i-kept" viewBox="0 0 24 24"><path d="M4.5 12.5l5 5 10-11" /></symbol>
      <symbol id="i-start" viewBox="0 0 24 24"><path d="M8 5.5l10 6.5-10 6.5Z" /></symbol>
      <symbol id="i-send" viewBox="0 0 24 24"><path d="M4.5 12l15-7-4.5 15-3.5-6.5Z" /></symbol>
      <symbol id="i-boot" viewBox="0 0 24 24"><path d="M6 4h4v8l7 3.5V20H6Z" /><path d="M10 12h3" /></symbol>
      <symbol id="i-bed" viewBox="0 0 24 24"><path d="M3 18v-9M3 13h18v5M21 18v-5a3 3 0 0 0-3-3h-6" /><circle cx="7.5" cy="10.5" r="2" /></symbol>
      <symbol id="i-film" viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="1.5" /><path d="M8 5.5v13M16 5.5v13M3.5 12h17" /></symbol>
      <symbol id="i-anchor" viewBox="0 0 24 24"><circle cx="12" cy="5.5" r="2" /><path d="M12 7.5V20M5 13a7 7 0 0 0 14 0M7.5 11H5M19 11h-2.5" /></symbol>
      <symbol id="i-weight" viewBox="0 0 24 24"><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" /></symbol>
      <symbol id="i-book" viewBox="0 0 24 24"><path d="M12 6.5S10 4.5 4 5v13c6-.5 8 1.5 8 1.5s2-2 8-1.5V5c-6-.5-8 1.5-8 1.5Z" /><path d="M12 6.5v13" /></symbol>
    </svg>
  );
}
