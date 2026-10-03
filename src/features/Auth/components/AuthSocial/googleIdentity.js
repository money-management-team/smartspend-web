const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_CLIENT_ID = (import.meta.env?.VITE_GOOGLE_CLIENT_ID ?? "").trim();

// A factory keeps loading/lifecycle tests independent from browser globals.
export function createGoogleIdentityLoader({
  clientId,
  environment = globalThis,
  timeoutMs = 12000,
}) {
  let loadPromise = null;
  let initialized = null;
  let owner = null;
  let generation = 0;
  const configured = typeof clientId === "string" && clientId.trim() !== "";

  const initialize = (googleId) => {
    if (initialized === googleId) return googleId;
    googleId.initialize({
      client_id: clientId.trim(),
      ux_mode: "popup",
      auto_select: false,
      callback: (response) => {
        // Button state ties a late popup result to its original mounted screen.
        // This is UI routing; the backend still independently verifies the JWT.
        if (
          owner &&
          response?.state === owner.state &&
          typeof response?.credential === "string" &&
          response.credential
        ) {
          owner.handler(response.credential);
        }
      },
    });
    initialized = googleId;
    return googleId;
  };

  const load = () => {
    if (!configured)
      return Promise.reject(new Error("Google sign-in is not configured."));
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve, reject) => {
      const ready = environment.google?.accounts?.id;
      if (ready) {
        try {
          resolve(initialize(ready));
        } catch {
          reject(new Error("Google sign-in could not initialize."));
        }
        return;
      }
      const script = environment.document.createElement("script");
      script.src = GIS_SCRIPT_SRC;
      script.async = true;
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        environment.clearTimeout(timer);
        script.onload = script.onerror = null;
        if (error) {
          script.remove();
          reject(new Error("Google sign-in could not load."));
          return;
        }
        try {
          resolve(initialize(environment.google.accounts.id));
        } catch {
          script.remove();
          reject(new Error("Google sign-in could not initialize."));
        }
      };
      const timer = environment.setTimeout(() => finish(true), timeoutMs);
      script.onload = () => finish(!environment.google?.accounts?.id);
      script.onerror = () => finish(true);
      environment.document.head.append(script);
    }).catch((error) => {
      loadPromise = null;
      throw error;
    });
    return loadPromise;
  };

  const subscribe = (handler) => {
    const state =
      environment.crypto?.randomUUID?.() ?? `smartspend-google-${++generation}`;
    const subscription = { state, handler };
    owner = subscription;
    return {
      state,
      unsubscribe: () => {
        if (owner === subscription) owner = null;
      },
    };
  };
  return { load, subscribe, configured };
}

const loader = createGoogleIdentityLoader({ clientId: GOOGLE_CLIENT_ID });
export const isGoogleConfigured = loader.configured;
export const loadGoogleIdentity = loader.load;
export const setGoogleCredentialHandler = loader.subscribe;
