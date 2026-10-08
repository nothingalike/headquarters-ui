import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { SearchPalette } from "./components/SearchPalette.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { LiveProvider } from "./live.tsx";
import { BrowsePage } from "./pages/BrowsePage.tsx";
import { InboxPage } from "./pages/InboxPage.tsx";
import { PlatePage } from "./pages/PlatePage.tsx";
import { TreeProvider } from "./tree.tsx";
import "./styles.css";

function App() {
  const [searching, setSearching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearching(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!location.hash) document.querySelector(".main")?.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  return (
    <div className={`shell ${menuOpen ? "menu-open" : ""}`}>
      <Sidebar onNavigate={() => setMenuOpen(false)} />
      <div className="main-column">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu" aria-expanded={menuOpen}>
            <svg viewBox="0 0 20 20" aria-hidden>
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
          <button className="search-button" onClick={() => setSearching(true)}>
            <svg viewBox="0 0 20 20" aria-hidden>
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4.5 4.5" />
            </svg>
            <span>Search headquarters</span>
            <kbd>Ctrl K</kbd>
          </button>
        </header>
        <main className="main">
          <Routes>
            <Route path="/" element={<PlatePage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/f/*" element={<BrowsePage />} />
            <Route path="/f" element={<BrowsePage />} />
          </Routes>
        </main>
      </div>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
      {searching && <SearchPalette onClose={() => setSearching(false)} />}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <LiveProvider>
        <TreeProvider>
          <App />
        </TreeProvider>
      </LiveProvider>
    </BrowserRouter>
  </StrictMode>,
);
