import { JSDOM } from "jsdom";

/*
 * Installs a jsdom window as the globals React DOM expects. It must run
 * BEFORE react-dom is imported (React probes `document` once, at import time,
 * to decide how to wire text-input change events), so DOM test files import
 * this module first.
 */
export const dom = globalThis.__testDom ?? new JSDOM("<!doctype html><html lang=\"en\" dir=\"ltr\"><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
globalThis.__testDom = dom;

const { window } = dom;
const define = (key, value) => Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
define("window", window);
define("document", window.document);
define("navigator", window.navigator);
for (const key of [
  "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "HTMLTextAreaElement", "Node", "Event", "MouseEvent",
  "KeyboardEvent", "MutationObserver", "getComputedStyle", "FormData",
]) {
  define(key, window[key]);
}
define("CSS", window.CSS);
define("getSelection", window.getSelection.bind(window));
define("IS_REACT_ACT_ENVIRONMENT", true);
