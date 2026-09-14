import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** iOS's home-screen icon: same mark, no transparency (iOS ignores alpha and
 * would otherwise render a black square where it's transparent). */
export default function AppleIcon() {
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
        <span style={{ fontSize: 98, fontWeight: 700, color: '#F5C542' }}>L</span>
      </div>
    ),
    { ...size },
  );
}
