// Test doubles for the browser globals apiClient reads. No real network.
export function installBrowserStubs({ token = "test-token", language = "en" } = {}) {
  const store = (initial) => {
    const map = new Map(Object.entries(initial));
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      dump: () => Object.fromEntries(map),
    };
  };
  globalThis.localStorage = store({ ACCESS_TOKEN: token, i18nextLng: language });
  globalThis.sessionStorage = store({});
  return { localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage };
}

export const envelope = (data, message = "ok") => ({ status: true, message, data });

/**
 * Replaces globalThis.fetch. `responder(url, init)` returns
 * { status, body, headers } or a Promise of it. Calls are recorded.
 */
export function mockFetch(responder) {
  const calls = [];
  globalThis.fetch = (url, init = {}) => {
    const call = {
      url: String(url),
      method: init.method ?? "GET",
      headers: init.headers ?? {},
      body: init.body === undefined ? undefined : JSON.parse(init.body),
      rawBody: init.body,
      signal: init.signal,
    };
    calls.push(call);
    return Promise.resolve(responder(call.url, init)).then((r) => {
      const text = typeof r.body === "string" ? r.body : r.body === undefined ? "" : JSON.stringify(r.body);
      return new Response(text, { status: r.status ?? 200, headers: r.headers ?? {} });
    });
  };
  return calls;
}
