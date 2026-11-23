const api = globalThis.CampusApi.createApi({
  engine: globalThis.CampusEngine,
  corpus: SITE_DATA.corpus,
  prompts: SITE_DATA.prompts,
  runtime: 'hosted',
});

const pagePaths = new Set(['/', '/index.html', '/CampusCompass.html']);
const pageHeaders = {
  'Cache-Control': 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export default {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/')) return api(request);
    const head = request.method === 'HEAD';
    const canRead = head || request.method === 'GET';
    const legacy = LEGACY_ASSETS[pathname === '/submission' ? '/submission/' : pathname];

    if (pagePaths.has(pathname) || legacy) {
      if (!canRead) return new Response(null, { status: 405, headers: { ...pageHeaders, Allow: 'GET, HEAD' } });
      return new Response(head ? null : legacy ? Uint8Array.from(atob(legacy.data), c => c.charCodeAt(0)) : SITE_HTML, {
        headers: { ...pageHeaders, 'Content-Type': legacy?.type || 'text/html; charset=utf-8' },
      });
    }
    return new Response(head ? null : 'Page not found.', {
      status: 404, headers: { ...pageHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
};
