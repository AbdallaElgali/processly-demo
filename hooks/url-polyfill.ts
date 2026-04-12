// hooks/url-polyfill.ts

// This polyfill applies to both the Browser (window) and the Next.js Server (Node.js)
type URLConstructor = typeof URL & { parse?: (url: string, base?: string | URL) => URL | null };

if (typeof URL !== 'undefined' && typeof (URL as URLConstructor).parse !== 'function') {
  (URL as URLConstructor).parse = function (url: string, base?: string | URL) {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}
