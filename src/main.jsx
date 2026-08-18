import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./i18n";
import "./index.css";

import App from "./App.jsx";
import LanguageProvider from "./contexts/language/languageProvider.jsx";
import { BrowserRouter } from "react-router-dom";
import ThemeProvider from "./contexts/theme/themeProvider.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
