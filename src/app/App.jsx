import React from "react";
import HomePage from "../pages/HomePage.jsx";
import PolicyPage from "../pages/PolicyPage.jsx";
import ToolPage from "../pages/ToolPage.jsx";
import { toolNamesById } from "../features/pdf-tools/toolCatalog.js";

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  if (path === "/privacy" || path === "/terms") {
    return <PolicyPage type={path.slice(1)} />;
  }

  if (path === "/edit-pdf") {
    return <ToolPage toolId="edit-pdf" toolLabel="Edit PDF" />;
  }

  if (path.startsWith("/tools/")) {
    const toolId = path.slice("/tools/".length);
    const toolLabel = toolNamesById[toolId];
    if (toolLabel) return <ToolPage toolId={toolId} toolLabel={toolLabel} />;
  }

  return <HomePage />;
}
