import React from "react";
import Field from "./Field.jsx";

export default function NumberControl({ label, value, onChange, min = 0, max, step = 1, hint }) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
