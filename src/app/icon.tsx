import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

/** The 512×512 PWA icon: the department's gold "L" mark on night-pitch navy
 * — DESIGN.md's two reserved colours, nothing else. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B1016',
          fontFamily: 'sans-serif',
        }}
      >
        <span style={{ fontSize: 280, fontWeight: 700, color: '#F5C542' }}>L</span>
      </div>
    ),
    { ...size },
  );
}
