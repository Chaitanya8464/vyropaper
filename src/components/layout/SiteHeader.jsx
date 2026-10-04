import React from "react";
import Arrow from "../ui/Arrow.jsx";
import Brand from "../ui/Brand.jsx";
import { useTheme } from "../../app/ThemeContext.jsx";

export default function SiteHeader({ activePage = "home" }) {
  const { theme, setTheme } = useTheme();
  const homePath = activePage === "home";
  const editorHref = activePage === "tool" ? "/" : "/tools/edit-pdf";

  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav className="main-nav" aria-label="Main navigation">
          <a href={homePath ? "#tools" : "/#tools"}>Tools</a>
          <a href={homePath ? "#how-it-works" : "/#how-it-works"}>How it works</a>
          <a href="/privacy" aria-current={activePage === "privacy" ? "page" : undefined}>Privacy</a>
          <a href="/terms" aria-current={activePage === "terms" ? "page" : undefined}>Terms</a>
        </nav>
        <div className="header-actions">
          <button
            className="theme-toggle"
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-pressed={theme === "dark"}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            <svg className="theme-toggle-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              {theme === "dark"
                ? <path d="M16.7 12.1A7.2 7.2 0 0 1 7.9 3.3 7.3 7.3 0 1 0 16.7 12Z" />
                : <><circle cx="10" cy="10" r="3.5" /><path d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2m14.5-6-1.4 1.4M5.4 14.6 4 16m12 0-1.4-1.4M5.4 5.4 4 4" /></>}
            </svg>
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
          <a className="header-link" href={editorHref}>
            {activePage === "home" ? <>Edit PDF <Arrow /></> : activePage === "tool" ? "Back home" : "Open editor"}
          </a>
        </div>
      </div>
    </header>
  );
}
