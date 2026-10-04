import React from "react";
import Brand from "../ui/Brand.jsx";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-main">
          <div className="footer-brand-block">
            <Brand light />
            <p>PDF tools for the work<br />you actually need to do.</p>
          </div>
          <div className="footer-links">
            <span className="footer-label">EXPLORE</span>
            <a href="/#tools">Tools</a>
            <a href="/#how-it-works">How it works</a>
          </div>
          <div className="footer-links">
            <span className="footer-label">THE DETAILS</span>
            <a href="/privacy">Privacy policy</a>
            <a href="/terms">Terms of use</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Paperwork</span>
          <span>Made for documents, not distractions.</span>
        </div>
      </div>
    </footer>
  );
}
