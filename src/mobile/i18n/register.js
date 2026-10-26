import i18n from "../../i18n";
import { MOBILE_MESSAGES, MOBILE_NAMESPACE } from "./messages.js";

/*
 * Adds the Mobile strings to the app's i18next instance. Importing this
 * module is the registration; it runs once, when the Mobile chunk loads, and
 * is a no-op if repeated (the bundles are merged).
 */
for (const [language, messages] of Object.entries(MOBILE_MESSAGES)) {
  i18n.addResourceBundle(language, MOBILE_NAMESPACE, messages, true, true);
}
