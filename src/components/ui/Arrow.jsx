import React from "react";

export default function Arrow({ diagonal = false }) {
  return (
    <svg
      aria-hidden="true"
      className={diagonal ? "arrow-icon arrow-diagonal" : "arrow-icon"}
      viewBox="0 0 20 20"
      fill="none"
    >
      <path d="M4 10h11M10 5l5 5-5 5" />
    </svg>
  );
}
