import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary.jsx";
import AuthProvider from "./contexts/auth/authProvider.jsx";
import EmailVerificationProvider from "./contexts/emailVerification/emailVerificationProvider.jsx";
import LanguageProvider from "./contexts/language/languageProvider.jsx";
import ThemeProvider from "./contexts/theme/themeProvider.jsx";

// Everything the app needs around its routes, inside the router.
export default function Root() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ErrorBoundary variant="app">
          <AuthProvider>
            <EmailVerificationProvider>
              <App />
            </EmailVerificationProvider>
          </AuthProvider>
        </ErrorBoundary>
      </LanguageProvider>
    </ThemeProvider>
  );
}
