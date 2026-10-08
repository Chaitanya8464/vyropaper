import React from "react";
import Brand from "../ui/Brand.jsx";
import { useTheme } from "../../app/ThemeContext.jsx";
import { AnimatedTopDock } from "../../shaders/animated-top-dock/AnimatedTopDock.tsx";

export default function SiteHeader({ activePage = "home" }) {
  const { theme, setTheme } = useTheme();
  const isHome = activePage === "home";
  const menuItems = [
    {
      id: "tools",
      label: "Tools",
      href: isHome ? "#tools" : "/#tools",
      icon: <><rect x="2.25" y="2.25" width="4.5" height="4.5" rx=".8" /><rect x="9.25" y="2.25" width="4.5" height="4.5" rx=".8" /><rect x="2.25" y="9.25" width="4.5" height="4.5" rx=".8" /><rect x="9.25" y="9.25" width="4.5" height="4.5" rx=".8" /></>,
    },
    {
      id: "how-it-works",
      label: "How it works",
      href: isHome ? "#how-it-works" : "/#how-it-works",
      icon: <><circle cx="3" cy="8" r="1.5" /><circle cx="12.5" cy="3.5" r="1.5" /><circle cx="12.5" cy="12.5" r="1.5" /><path d="M4.5 7.3 11 4.2M4.5 8.7l6.5 3.1" /></>,
    },
    {
      id: "privacy",
      label: "Privacy",
      href: "/privacy",
      current: activePage === "privacy",
      icon: <><path d="M8 1.8 13.5 4v4.2c0 3.1-2.3 5.2-5.5 6.8-3.2-1.6-5.5-3.7-5.5-6.8V4L8 1.8Z" /><path d="m5.5 8 1.6 1.6L10.8 6" /></>,
    },
    {
      id: "terms",
      label: "Terms",
      href: "/terms",
      current: activePage === "terms",
      icon: <><path d="M4 2.25h5.4L12 4.85v8.9H4z" /><path d="M9.25 2.25V5h2.7M6 8h4M6 10.5h4" /></>,
    },
    {
      id: "theme",
      label: theme === "dark" ? "Light" : "Dark",
      ariaLabel: `Switch to ${theme === "dark" ? "light" : "dark"} mode`,
      pressed: theme === "dark",
      onClick: () => setTheme(theme === "dark" ? "light" : "dark"),
      icon: theme === "dark"
        ? <path d="M12.7 9.7A5.5 5.5 0 0 1 6.3 3.3 5.8 5.8 0 1 0 12.7 9.7Z" />
        : <><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.4M8 13.1v1.4M14.5 8h-1.4M2.9 8H1.5m11.1-4.6-1 1M4.4 11.6l-1 1m9.2 0-1-1m-7.2-7.2-1-1" /></>,
    },
    {
      id: "editor",
      label: "Edit PDF",
      href: "/tools/edit-pdf",
      current: activePage === "tool",
      icon: <><path d="M3 2.5h6l4 4v7H3z" /><path d="M9 2.5v4h4M5.5 9h4M5.5 11h3" /></>,
    },
  ];

  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <AnimatedTopDock
          className="paperwork-dock"
          variant="sable"
          proximity={122}
          spring={0.19}
          damping={0.70}
          widthGrowth={17}
          heightGrowth={16}
          drop={3.5}
          homeCurrent={isHome}
          menuItems={menuItems}
        />
      </div>
    </header>
  );
}
