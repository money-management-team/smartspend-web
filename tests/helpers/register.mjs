// Loaded with `node --import`: lets tests import the app's JSX and CSS.
import { register } from "node:module";

register("./loader.mjs", import.meta.url);
