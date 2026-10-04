import React from "react";
import SiteFooter from "../components/layout/SiteFooter.jsx";
import SiteHeader from "../components/layout/SiteHeader.jsx";
import Arrow from "../components/ui/Arrow.jsx";
import ToolIcon from "../components/ui/ToolIcon.jsx";
import { toolGroups, toolRouteIds } from "../features/pdf-tools/toolCatalog.js";

function ProductPreview() {
  return (
    <div className="preview-card" role="img" aria-label="Illustration of the Paperwork PDF editing workspace">
      <div className="preview-window">
        <div className="preview-sidebar">
          <div className="sidebar-brand"><span className="mini-mark" /><span>paperwork</span></div>
          <div className="sidebar-label">PDF TOOLS</div>
          <div className="sidebar-item sidebar-item-active"><span className="sidebar-square" /> Edit PDF</div>
          <div className="sidebar-item"><span className="sidebar-square sidebar-square-outline" /> Organize</div>
          <div className="sidebar-item"><span className="sidebar-square sidebar-square-outline" /> Convert</div>
          <div className="sidebar-bottom">
            <div className="avatar">↗</div>
            <div><strong>Private by design</strong><span>Files stay on this device</span></div>
          </div>
        </div>
        <div className="preview-main">
          <div className="preview-topbar">
            <span>EDIT PDF <span className="crumb-divider">/</span> proposal.pdf</span>
            <span className="save-status"><i /> On this device</span>
          </div>
          <div className="document-stage">
            <div className="document-toolbar">
              <span className="toolbar-active">Select</span><span>T</span><span>Highlight</span>
              <span className="toolbar-divider" /><span>−</span><span>100%</span><span>+</span>
            </div>
            <div className="paper-sheet">
              <div className="paper-kicker">NORTH &amp; FIELD / 2025</div>
              <div className="paper-heading">Project<br />proposal</div>
              <div className="paper-rule" />
              <div className="paper-section">OVERVIEW</div>
              <div className="paper-line paper-line-long" />
              <div className="paper-line" />
              <div className="paper-line paper-line-mid" />
              <div className="paper-section paper-section-lower">SCOPE OF WORK</div>
              <div className="paper-line paper-line-long" />
              <div className="paper-line" />
              <div className="paper-line paper-line-mid" />
              <div className="paper-note">Draft for review</div>
            </div>
          </div>
          <div className="preview-footer"><span>Page 1 of 4</span><span>100%</span></div>
        </div>
      </div>
      <div className="preview-caption"><span className="caption-dot" />A focused workspace for everyday PDF edits</div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero section-wrap">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> PDF work, made clearer</div>
            <h1>Edit, convert, and organize PDF files <em>in one place.</em></h1>
            <p className="hero-description">
              Add notes, rearrange pages, or convert a file without handing your
              documents to a server. The tools run right here in your browser.
            </p>
            <div className="hero-actions">
              <a className="button button-dark" href="/tools/edit-pdf">Open the PDF editor <Arrow /></a>
              <a className="text-link" href="#tools">Explore all tools <span aria-hidden="true">↓</span></a>
            </div>
            <p className="preview-notice"><span className="notice-dot" />No account. No upload. Your file stays on this device.</p>
          </div>
          <div className="hero-visual">
            <div className="visual-grid" aria-hidden="true" />
            <ProductPreview />
            <div className="side-note" aria-hidden="true"><span>01</span><span className="side-note-rule" /><span>THE WORKSPACE</span></div>
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
