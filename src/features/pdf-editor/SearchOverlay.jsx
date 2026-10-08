import React, { useEffect, useState } from "react";

export default function SearchOverlay({
  isOpen,
  onClose,
  pages,
  activePage,
  onNavigateToMatch,
  onReplaceCurrent,
  onReplaceAll,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [matches, setMatches] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [showReplace, setShowReplace] = useState(false);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setMatches([]);
      setCurrentIndex(-1);
      return;
    }

    const query = searchTerm.toLowerCase();
    const found = [];

    pages.forEach((page) => {
      page.textItems.forEach((item) => {
        if (item.text.toLowerCase().includes(query)) {
          found.push({
            pageNumber: page.pageNumber,
            item,
            page,
          });
        }
      });
    });

    setMatches(found);
    if (found.length > 0) {
      // Find first match on or after active page
      const firstOnPage = found.findIndex((m) => m.pageNumber >= activePage);
      const nextIdx = firstOnPage !== -1 ? firstOnPage : 0;
      setCurrentIndex(nextIdx);
      onNavigateToMatch(found[nextIdx]);
    } else {
      setCurrentIndex(-1);
    }
  }, [searchTerm, pages]);

  const goPrev = () => {
    if (matches.length === 0) return;
    const nextIdx = (currentIndex - 1 + matches.length) % matches.length;
    setCurrentIndex(nextIdx);
    onNavigateToMatch(matches[nextIdx]);
  };

  const goNext = () => {
    if (matches.length === 0) return;
    const nextIdx = (currentIndex + 1) % matches.length;
    setCurrentIndex(nextIdx);
    onNavigateToMatch(matches[nextIdx]);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) goPrev();
      else goNext();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  const currentMatch = currentIndex >= 0 ? matches[currentIndex] : null;

  return (
    <div className="pde-search-bar" role="search">
      <div className="pde-search-main">
        <input
          type="text"
          placeholder="Find text in document…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="pde-search-input"
        />
        <div className="pde-search-count">
          {matches.length > 0
            ? `${currentIndex + 1} of ${matches.length}`
            : searchTerm.trim()
            ? "No matches"
            : ""}
        </div>
        <button
          type="button"
          className="pde-search-nav"
          onClick={goPrev}
          disabled={matches.length <= 1}
          title="Previous match (Shift+Enter)"
          aria-label="Previous match"
        >
          ↑
        </button>
        <button
          type="button"
          className="pde-search-nav"
          onClick={goNext}
          disabled={matches.length <= 1}
          title="Next match (Enter)"
          aria-label="Next match"
        >
          ↓
        </button>
        <button
          type="button"
          className={`pde-search-toggle ${showReplace ? "is-active" : ""}`}
          onClick={() => setShowReplace(!showReplace)}
          title="Toggle Replace"
        >
          ⇄ Replace
        </button>
        <button
          type="button"
          className="pde-search-close"
          onClick={onClose}
          aria-label="Close search"
        >
          ✕
        </button>
      </div>

      {showReplace && (
        <div className="pde-replace-row">
          <input
            type="text"
            placeholder="Replace with…"
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            className="pde-search-input"
          />
          <button
            type="button"
            className="pde-btn-subtle"
            disabled={!currentMatch}
            onClick={() => {
              if (currentMatch) {
                onReplaceCurrent(currentMatch, replaceTerm);
                goNext();
              }
            }}
          >
            Replace
          </button>
          <button
            type="button"
            className="pde-btn-subtle"
            disabled={matches.length === 0}
            onClick={() => onReplaceAll(matches, replaceTerm)}
          >
            Replace All ({matches.length})
          </button>
        </div>
      )}
    </div>
  );
}
