import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import "./i18n";
import "./index.css";

import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary.jsx";
import AuthProvider from "./contexts/auth/authProvider.jsx";
import EmailVerificationProvider from "./contexts/emailVerification/emailVerificationProvider.jsx";
import LanguageProvider from "./contexts/language/languageProvider.jsx";
import ThemeProvider from "./contexts/theme/themeProvider.jsx";

// A data router (instead of <BrowserRouter>) is what makes `useBlocker`
// available, used to warn about unsaved form changes. The single splat route
// keeps the existing `useRoutes` tree in routes/Router.jsx as the real route
// table.
const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <ErrorBoundary variant="app">
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <EmailVerificationProvider>
                <App />
              </EmailVerificationProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </ErrorBoundary>
    ),
  },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
