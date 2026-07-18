import React from "react";

export function ClockIcon({ className = "metaIcon" }) {
  return (
    <svg className={className} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle cx="8" cy="8.5" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M8 5.5V8.5L10 9.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.25 2.5H9.75" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}
