import type { MetadataRoute } from 'next';

// Lets iPhone/Android install Telaga to the home screen as a full-screen app.
// "standalone" is required for push alerts on iPhone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Telaga',
    short_name: 'Telaga',
    description: 'Private money tracker and journal',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0b1830',
    theme_color: '#0b1830',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
