/*
 * Inline SVG icons shared by the auth pages.
 * Stroke icons use currentColor; consumers size them with CSS.
 */

export function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m5 7 7 5.2L19 7" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12.25a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z" />
      <path d="M6.5 19.1v-1.25c0-2.15 2.1-3.9 4.7-3.9h1.6c2.6 0 4.7 1.75 4.7 3.9v1.25" />
    </svg>
  );
}

export function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.5 20.5V5.6a1.6 1.6 0 0 1 1.6-1.6h6.3a1.6 1.6 0 0 1 1.6 1.6v14.9" />
      <path d="M15 9.5h2.9a1.6 1.6 0 0 1 1.6 1.6v9.4" />
      <path d="M3.5 20.5h17M8.75 8h3M8.75 11.5h3M8.75 15h3" />
    </svg>
  );
}

export function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7M12 14.6v2" />
    </svg>
  );
}

export function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="15" r="4" />
      <path d="m10.85 12.15 8.65-8.65M16.5 6.5l2.5 2.5M13.9 9.1l2 2" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.7 19 6.4v5.35c0 4.6-2.95 7.7-7 8.9-4.05-1.2-7-4.3-7-8.9V6.4l7-2.7Z" />
    </svg>
  );
}

export function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.7 19 6.4v5.35c0 4.6-2.95 7.7-7 8.9-4.05-1.2-7-4.3-7-8.9V6.4l7-2.7Z" />
      <path d="m9 12.1 2.1 2.1 3.9-4" />
    </svg>
  );
}

export function SparklesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 1.15 4.1a5.2 5.2 0 0 0 3.65 3.65L21 12l-4.2 1.2a5.2 5.2 0 0 0-3.6 3.6L12 21l-1.2-4.2a5.2 5.2 0 0 0-3.6-3.6L3 12l4.2-1.25a5.2 5.2 0 0 0 3.55-3.55L12 3Z" />
      <path d="m18.3 3.4.45 1.55a2 2 0 0 0 1.35 1.35l1.5.45-1.5.45a2 2 0 0 0-1.35 1.35l-.45 1.55-.45-1.55A2 2 0 0 0 16.5 7.2L15 6.75l1.5-.45a2 2 0 0 0 1.35-1.35l.45-1.55Z" />
    </svg>
  );
}

export function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5.3" width="18" height="13.4" rx="2.2" />
      <path d="M3 9.2h18" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6.7 12.2 3.2 3.2 7.4-7.4" />
    </svg>
  );
}

/* Points toward inline-start in LTR; flipped with CSS under [dir="rtl"] */
export function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </svg>
  );
}

export function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m3.5 3.5 17 17" />
      <path d="M10.6 5.6A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-3.1 3.9M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5a9.3 9.3 0 0 0 4.6-1.2" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z"
      />
    </svg>
  );
}
