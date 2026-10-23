/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Receipt photos are compressed in the browser first; this leaves headroom.
    serverActions: { bodySizeLimit: '4mb' },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Ask search engines not to list any page. This is not protection on its own;
          // the password login is what keeps the data private.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default nextConfig;
