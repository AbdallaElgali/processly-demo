// hooks/url-polyfill.ts

// This polyfill applies to both the Browser (window) and the Next.js Server (Node.js)
if (typeof URL !== 'undefined' && typeof (URL as any).parse !== 'function') {
  (URL as any).parse = function (url: string, base?: string | URL) {
    try {
      return new URL(url, base);
    } catch (error) {
      return null;
    }
  };
}