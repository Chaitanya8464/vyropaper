import React from "react";
import SiteFooter from "../components/layout/SiteFooter.jsx";
import SiteHeader from "../components/layout/SiteHeader.jsx";
import Arrow from "../components/ui/Arrow.jsx";
import ToolIcon from "../components/ui/ToolIcon.jsx";
import { toolGroups, toolRouteIds } from "../features/pdf-tools/toolCatalog.js";

const featuredTools = [
  { name: "Edit PDF", group: "edit", description: "Add text, notes, and signatures." },
  { name: "Merge PDFs", group: "pages", description: "Bring documents together in order." },
  { name: "PDF to Word", group: "convert", description: "Turn a PDF into an editable document." },
  { name: "Sign a PDF", group: "edit", description: "Add your signature to any page." },
  { name: "Compress a PDF", group: "secure", description: "Make a large file easier to share." },
  { name: "Split a PDF", group: "pages", description: "Separate the pages you need." },
  { name: "Images to PDF", group: "convert", description: "Combine images into one PDF." },
  { name: "Recognize text (OCR)", group: "secure", description: "Make scanned pages searchable." },
];

function ToolSlides({ duplicate = false }) {
  return (
    <div className="tool-slide-group" aria-hidden={duplicate || undefined}>
      {featuredTools.map((tool) => (
        <a
          className="tool-slide-card"
          href={`/tools/${toolRouteIds[tool.name]}`}
          key={tool.name}
          tabIndex={duplicate ? -1 : undefined}
        >
          <span className="tool-slide-icon"><ToolIcon name={tool.group} /></span>
          <span className="tool-slide-copy">
            <span className="tool-slide-label">PDF TOOL</span>
            <strong>{tool.name}</strong>
            <span>{tool.description}</span>
          </span>
          <Arrow />
        </a>
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> Your documents, your device</div>
            <h1>Make PDF work<br /><em>feel effortless.</em></h1>
            <p className="hero-description">
              Edit, convert, and organize documents with simple tools that work
              right in your browser. Your files stay yours.
            </p>
            <div className="hero-actions">
              <a className="button button-cream" href="/tools/edit-pdf">Get started <Arrow /></a>
              <a className="text-link" href="#tools">Explore all tools <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <div className="hero-tools" role="region" aria-label="Featured PDF tools">
            <div className="tool-slide-track">
              <ToolSlides />
              <ToolSlides duplicate />
            </div>
          </div>
        </section>
        <section className="trust-strip" aria-label="Product principles">
          <div className="trust-inner">
            <span className="strip-label">WHAT TO EXPECT</span>
            <span><i className="strip-mark" /> No account needed</span>
            <span><i className="strip-mark" /> Nothing is uploaded</span>
            <span><i className="strip-mark" /> Download when you’re ready</span>
          </div>
        </section>
        <section className="tools-section section-wrap" id="tools">
          <div className="section-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> THE TOOLKIT</div><h2>Everyday PDF work, <em>well organized.</em></h2></div>
            <p>Choose a tool to upload a file and get started. Files are processed on your device; no upload to a server is required.</p>
          </div>
          <div className="tool-grid">
            {toolGroups.map((group, index) => (
              <article className="tool-card" key={group.title}>
                <div className="tool-card-top">
                  <span className="tool-number">{String(index + 1).padStart(2, "0")}</span>
                  <ToolIcon name={group.icon} />
                </div>
                <div className="tool-card-info">
                  <h3>{group.title}</h3>
                  <p>{group.description}</p>
                </div>
                <ul className="tool-list">
                  {group.tools.map((tool) => (
                    <li className={tool === "Edit PDF" ? "tool-list-featured" : ""} key={tool}>
                      <a className="tool-edit-link" href={`/tools/${toolRouteIds[tool]}`}>{tool}<Arrow /></a>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
        <section className="how-section" id="how-it-works">
          <div className="how-inner section-wrap">
            <div className="how-intro">
              <div className="eyebrow eyebrow-light"><span className="eyebrow-line" /> A SIMPLE WORKFLOW</div>
              <h2>Less clicking around.<br /><em>More getting it done.</em></h2>
              <p>Find the task, make the change, and leave with a document that is ready for what comes next.</p>
            </div>
            <div className="steps">
              <article className="step"><span className="step-number">01</span><div><h3>Choose a tool</h3><p>Start with what you need to do: edit a page, combine files, or change a format.</p></div></article>
              <article className="step"><span className="step-number">02</span><div><h3>Make your changes</h3><p>Work through a focused set of controls, without hunting through menus.</p></div></article>
              <article className="step"><span className="step-number">03</span><div><h3>Save your document</h3><p>Check the result and save a finished copy when you are ready.</p></div></article>
            </div>
          </div>
        </section>
        <section className="closing section-wrap">
          <div className="closing-kicker">GOOD DOCUMENTS. LESS FUSS.</div>
          <div className="closing-row">
            <h2>PDF work should feel <em>straightforward.</em></h2>
            <a href="#tools" className="button button-outline">Browse the toolkit <Arrow /></a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
