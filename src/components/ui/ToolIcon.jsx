import React from "react";

const ICON_PATHS = {
  edit: (
    <>
      <path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5Z" />
      <path d="m13.8 6.8 3.5 3.5M4 21h16" />
    </>
  ),
  convert: (
    <>
      <path d="M5 5h10l4 4v10H5V5Z" />
      <path d="M15 5v4h4M8 13h8M8 16h5M3 8V3h5M17 21h5v-5" />
    </>
  ),
  pages: (
    <>
      <path d="M7 4h12v15H7zM4 7v14h12M10 8h6M10 11h6" />
    </>
  ),
  secure: (
    <>
      <path d="M12 3 5 6v5c0 4.7 2.9 8 7 10 4.1-2 7-5.3 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
};

export default function ToolIcon({ name }) {
  return (
    <svg className="tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {ICON_PATHS[name]}
    </svg>
  );
}
