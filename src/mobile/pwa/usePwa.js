import { useEffect, useState } from "react";

import { activateWaiting, hasController, syncPwa, watchController } from "./worker.js";

/*
 * The PWA state the Mobile shell shows: whether the device is offline, whether an
 * update is waiting, and whether the browser offers to install. Registration (or,
 * in a build without the PWA, clean-up) runs once per Mobile session.
 *
 * An update never activates by itself: the person taps "Reload" (an open form is
 * never lost to a silent reload), the waiting worker takes over, and the page
 * reloads once.
 */
export function usePwa() {
  const [online, setOnline] = useState(() => globalThis.navigator?.onLine !== false);
  const [waiting, setWaiting] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    const offer = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    globalThis.addEventListener?.("online", on);
    globalThis.addEventListener?.("offline", off);
    globalThis.addEventListener?.("beforeinstallprompt", offer);
    return () => {
      globalThis.removeEventListener?.("online", on);
      globalThis.removeEventListener?.("offline", off);
      globalThis.removeEventListener?.("beforeinstallprompt", offer);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    let reloaded = false;
    let unwatch = () => {};
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      globalThis.location?.reload();
    };

    syncPwa().then((result) => {
      if (!alive || result.state !== "on") return;
      const registration = result.registration;
      const check = () => {
        if (registration.waiting && hasController()) setWaiting(registration);
      };
      check();
      registration.addEventListener?.("updatefound", () => {
        registration.installing?.addEventListener("statechange", check);
      });
      unwatch = watchController(onControllerChange);
    });

    return () => {
      alive = false;
      unwatch();
    };
  }, []);

  return {
    online,
    updateReady: Boolean(waiting),
    update: () => activateWaiting(waiting),
    canInstall: Boolean(installPrompt),
    install: async () => {
      if (!installPrompt) return;
      await installPrompt.prompt();
      setInstallPrompt(null);
    },
  };
}
