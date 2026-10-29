import { dom } from "./domSetup.mjs";
import { act } from "react";
import { createRoot } from "react-dom/client";

/* The jsdom window installed by domSetup.mjs (import that first in a test file). */
export const installDom = () => dom;

export async function render(element) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(element); });
  return {
    container,
    rerender: (next) => act(async () => { root.render(next); }),
    unmount: async () => {
      await act(async () => { root.unmount(); });
      container.remove();
    },
  };
}

/** Lets pending promises and effects settle. */
export const flush = () => act(async () => { await new Promise((resolve) => setImmediate(resolve)); });

export async function click(element) {
  await act(async () => { element.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); });
}

export async function change(element, value) {
  const proto = element instanceof window.HTMLSelectElement
    ? window.HTMLSelectElement.prototype
    : element instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(element, value);
  await act(async () => { element.dispatchEvent(new window.Event(element.tagName === "SELECT" || element.type === "date" ? "change" : "input", { bubbles: true })); });
}

export async function submit(form) {
  await act(async () => { form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
}

export const byText = (root, text, selector = "button") =>
  [...root.querySelectorAll(selector)].find((node) => node.textContent.trim() === text);
