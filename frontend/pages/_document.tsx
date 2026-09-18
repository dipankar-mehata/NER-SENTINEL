import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme — brand red */}
        <meta name="theme-color" content="#DC2626" />
        <meta name="background-color" content="#FFFFFF" />

        {/* PWA iOS */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="NER-SENTINEL" />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />

        {/* Satoshi font — Fontshare CDN */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,400&display=swap"
        />

        {/* Preconnect for map tiles */}
        <link rel="preconnect" href="https://a.tile.openstreetmap.org" />
        <link rel="preconnect" href="https://b.tile.openstreetmap.org" />
        <link rel="preconnect" href="https://c.tile.openstreetmap.org" />
        <link rel="preconnect" href="https://a.tile.opentopomap.org" />

        {/* Leaflet CSS */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />

        {/* Mappls SDK (optional, if key present) */}
        {process.env.NEXT_PUBLIC_MAPPLS_KEY && (
          <script
            src={`https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${process.env.NEXT_PUBLIC_MAPPLS_KEY}`}
          />
        )}

        {/* Service Worker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('[NER-SENTINEL] SW registered:', reg.scope))
                    .catch(err => console.warn('[NER-SENTINEL] SW failed:', err));
                });
              }
            `,
          }}
        />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
