export type IconName =
  | 'up' | 'flat' | 'down' | 'clock' | 'rest' | 'shift' | 'moved' | 'shorter' | 'dropped'
  | 'kept' | 'start' | 'send' | 'boot' | 'bed' | 'film' | 'anchor' | 'weight' | 'book';

/** One glyph from the shared sprite (Task 1). `size` matches dept.css's two
 * sizes: "lg" is the 1em icon used everywhere in this system; "medal" is the
 * larger stroke used inside a badge medallion disc (DESIGN.md "Badge Medallions"). */
export function Icon({ name, size = 'lg' }: { name: IconName; size?: 'lg' | 'medal' }) {
  return (
    <svg className={`icon icon-${size}`} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
