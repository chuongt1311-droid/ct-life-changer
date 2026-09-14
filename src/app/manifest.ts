import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CT's Life Changer",
    short_name: 'Life Changer',
    description: 'Daily Loop — single-user ADHD companion app.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B1016',
    theme_color: '#0B1016',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
