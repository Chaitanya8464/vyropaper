import React from "react";
import SiteFooter from "../components/layout/SiteFooter.jsx";
import SiteHeader from "../components/layout/SiteHeader.jsx";
import Arrow from "../components/ui/Arrow.jsx";
import ToolIcon from "../components/ui/ToolIcon.jsx";
import { toolGroups, toolRouteIds } from "../features/pdf-tools/toolCatalog.js";

function ProductPreview() {
  return (
    <div className="preview-card" aria-label="Illustration of the Paperwork PDF workspace">
      <div className="preview-window">
        <div className="preview-sidebar">
          <div className="sidebar-brand"><span className="mini-mark" /><span>paperwork</span></div>
          <div className="sidebar-label">WORKSPACE</div>
          <div className="sidebar-item sidebar-item-active"><span className="sidebar-square" /> All documents</div>
          <div className="sidebar-item"><span className="sidebar-square sidebar-square-outline" /> Recent</div>
          <div className="sidebar-item"><span className="sidebar-square sidebar-square-outline" /> Shared</div>
          <div className="sidebar-bottom">
            <div className="avatar">M</div>
            <div><strong>My workspace</strong><span>Personal</span></div>
            <span className="sidebar-dots">···</span>
          </div>
        </div>
        <div className="preview-main">
          <div className="preview-topbar">
            <span>Workspace concept <span className="crumb-divider">/</span> Sample.pdf</span>
            <span className="save-status"><i /> Product preview</span>
          </div>
          <div className="document-stage">
            <div className="document-toolbar">
              <span className="toolbar-active">↖</span><span>T</span><span>✎</span>
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
          <div className="preview-footer"><span>Sample document</span><span>100%</span></div>
        </div>
      </div>
      <div className="preview-caption"><span className="caption-dot" />Workspace concept, not a working editor</div>
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
              Make the everyday document tasks less of a chore. Paperwork brings
              useful PDF tools together in a workspace that stays out of your way.
            </p>
            <div className="hero-actions">
              <a className="button button-dark" href="/tools/edit-pdf">Edit PDF <Arrow /></a>
              <a className="text-link" href="#tools">Explore all tools <span aria-hidden="true">↓</span></a>
            </div>
            <p className="preview-notice"><span className="notice-dot" />Browser-based tools. Your files stay on this device.</p>
          </div>
          <div className="hero-visual">
            <div className="visual-grid" aria-hidden="true" />
            <ProductPreview />
            <div className="side-note" aria-hidden="true"><span>01</span><span className="side-note-rule" /><span>THE WORKSPACE</span></div>
          </div>
        </section>
        <section className="trust-strip" aria-label="Product principles">
          <div className="trust-inner">
            <span className="strip-label">BUILT AROUND THE WORK</span>
            <span><i className="strip-mark" /> Straightforward tools</span>
            <span><i className="strip-mark" /> No account required to explore</span>
            <span><i className="strip-mark" /> Privacy, explained plainly</span>
          </div>
        </section>
        <section className="tools-section section-wrap" id="tools">
          <div className="section-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> THE TOOLKIT</div><h2>PDF tasks, <em>all together.</em></h2></div>
            <p>Choose a tool to upload a file and get started. Files are processed on your device; no upload to a server is required.</p>
          </div>
          <div className="tool-grid">
            {toolGroups.map((group) => (
              <article className="tool-card" key={group.title}>
                <div className="tool-card-top"><ToolIcon name={group.icon} /><span className="tool-number">PLANNED</span></div>
                <h3>{group.title}</h3><p>{group.description}</p>
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
            <a href="#tools" className="button button-outline">See what’s in the works <Arrow /></a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
