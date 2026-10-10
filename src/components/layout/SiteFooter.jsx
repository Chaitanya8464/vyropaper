import React from "react";
import Brand from "../ui/Brand.jsx";

export default function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="Footer">
      <div className="footer-inner">
        <div className="footer-main">
          <div className="footer-brand-block">
            <Brand light />

            <p className="footer-tagline">
              PDF tools for the work <br />
              you actually need to do.
            </p>

            <div className="footer-attribution">
              <span>A product of </span>
              <a
                href="https://www.vayro.global/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Vayro Global
              </a>
            </div>
          </div>

          <div className="footer-links">
            <span className="footer-label">EXPLORE</span>
            <a href="/#tools">Tools</a>
            <a href="/#how-it-works">How it works</a>
            <a href="/tools/edit-pdf">Edit PDF</a>
          </div>

          <div className="footer-links">
            <span className="footer-label">LEGAL</span>
            <a href="/privacy">Privacy policy</a>
            <a href="/terms">Terms of use</a>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-copyright">
            <span>© 2026 Paperwork</span>

            <span
              className="footer-separator"
              aria-hidden="true"
            >
              ·
            </span>

            <a
              href="https://www.vayro.global/"
              target="_blank"
              rel="noopener noreferrer"
            >
              A product of Vayro Global
            </a>
          </div>

          <div className="footer-tagline-bottom">
            Made for documents, not distractions.
          </div>
        </div>
      </div>
    </footer>
  );
}
