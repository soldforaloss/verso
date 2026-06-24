/** The Verso mark — a rounded indigo tile with a white "V" (matches the app icon). */
export function VersoLogo({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 256 256" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="verso-logo-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <rect x="10" y="10" width="236" height="236" rx="52" fill="url(#verso-logo-gradient)" />
      <path
        d="M77 77 L128 184 L179 77"
        fill="none"
        stroke="#ffffff"
        strokeWidth="34"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
