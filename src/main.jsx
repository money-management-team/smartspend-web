import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";

import "./i18n";
import "./index.css";

import Root from "./Root.jsx";


// A data router, so pages can block navigation while a form has unsaved edits
// (useBlocker). One splat route hands every URL to <Router />, which keeps
// owning the route table, so the routes themselves are unchanged.
const router = createBrowserRouter([{ path: "*", element: <Root /> }]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
