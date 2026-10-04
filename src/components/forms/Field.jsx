import React from "react";

export default function Field({ label, hint, children }) {
  return (
    <label className="pdfw-field">
      <span className="pdfw-field-label">{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
