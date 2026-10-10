import React from "react";
import "./Brand.css";

export default function Brand({ light = false }) {
  return (
    <a
      className={`brand${light ? " brand-light" : ""}`}
      href="/"
      aria-label="Paperwork home"
    >
      <span className="brand-wordmark">PAPERWORK</span>
    </a>
  );
}