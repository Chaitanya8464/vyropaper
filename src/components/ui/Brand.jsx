import React from "react";

export default function Brand({ light = false }) {
  return (
    <a
      className={`brand${light ? " brand-light" : ""}`}
      href="/"
      aria-label="Paperwork home"
    >
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 28 30" fill="none">
          <path d="M5 2.5h12l6 6V27H5V2.5Z" />
          <path d="M17 2.5v6h6M9 14h10M9 18h10M9 22h6" />
        </svg>
      </span>
      <span>paperwork</span>
    </a>
  );
}
