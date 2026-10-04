import React from "react";
import SiteFooter from "../components/layout/SiteFooter.jsx";
import SiteHeader from "../components/layout/SiteHeader.jsx";
import PdfWorkbench from "../features/pdf-tools/PdfWorkbench.jsx";

export default function ToolPage({ toolId, toolLabel }) {
  return (
    <>
      <SiteHeader activePage="tool" />
      <PdfWorkbench toolId={toolId} toolLabel={toolLabel} />
      <SiteFooter />
    </>
  );
}
