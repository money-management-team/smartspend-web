const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_CLIENT_ID = (import.meta.env?.VITE_GOOGLE_CLIENT_ID ?? "").trim();

let loadPromise = null;
let credentialHandler = null;
let warnedMissingClientId = false;

export const isGoogleConfigured = Boolean(GOOGLE_CLIENT_ID);

function initializeGoogleIdentity(googleId) {
  googleId.initialize({
    client_id: GOOGLE_CLIENT_ID,
    // `credential` is the Google ID token (JWT) the backend verifies.
    callback: ({ credential }) => {
      if (credential) credentialHandler?.(credential);
    },
    ux_mode: "popup",
    auto_select: false,
  });

  return googleId;
}

/*
 * Loads Google Identity Services once and initializes it once with a single
 * credential callback (GIS supports one `initialize()` per page). The mounted
 * AuthSocial receives ID tokens through `setGoogleCredentialHandler`.
 *
 * Resolves with `google.accounts.id`. Rejects when VITE_GOOGLE_CLIENT_ID is
 * missing or the script can't load; a later call retries.
 */
export function loadGoogleIdentity() {
  if (!isGoogleConfigured) {
    if (import.meta.env?.DEV && !warnedMissingClientId) {
      warnedMissingClientId = true;
      console.warn(
        "[Smart Spend] VITE_GOOGLE_CLIENT_ID is not set, so Google sign-in is disabled. " +
          "Add your Google OAuth Web client ID to .env and restart Vite.",
      );
    }

    return Promise.reject(new Error("VITE_GOOGLE_CLIENT_ID is not set."));
  }

  loadPromise ??= new Promise((resolve, reject) => {
    // Already on the page (e.g. after a hot reload of this module).
    if (globalThis.google?.accounts?.id) {
      resolve(initializeGoogleIdentity(globalThis.google.accounts.id));
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;

    script.onload = () => {
      const googleId = globalThis.google?.accounts?.id;

      if (googleId) {
        resolve(initializeGoogleIdentity(googleId));
      } else {
        reject(new Error("Google Identity Services is unavailable."));
      }
    };

    script.onerror = () => {
      script.remove();
      reject(new Error("Google Identity Services failed to load."));
    };

    document.head.append(script);
  }).catch((error) => {
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}

export function setGoogleCredentialHandler(handler) {
  credentialHandler = handler;

  return () => {
    if (credentialHandler === handler) credentialHandler = null;
  };
}
