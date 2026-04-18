import { useAppStore } from "../store/appStore.ts";

/**
 * Left rail — locked structure per docs/my_game/10-design-system.md §4 (Left rail 72px).
 * Six primary nav buttons + divider + 2 (Order, Weekly Trials).
 *
 * Phase 6: Research Bay button toggles the overlay; completion glow fires when
 * a project finishes while the overlay is closed.
 */

const railButtons = [
  { id: "forge", title: "Forge (in-run)", glyph: "forge" },
  { id: "research", title: "Research Bay", glyph: "research" },
  { id: "protocols", title: "Protocols", glyph: "protocols" },
  { id: "augments", title: "Augments", glyph: "augments" },
  { id: "arsenals", title: "Arsenals", glyph: "arsenals" },
  { id: "archive", title: "Archive", glyph: "archive" },
] as const;

const secondaryButtons = [
  { id: "order", title: "Order (Seasonal)", glyph: "order" },
  { id: "trials", title: "Weekly Trials", glyph: "trials" },
] as const;

export function Rail() {
  const overlay = useAppStore((s) => s.overlay);
  const setOverlay = useAppStore((s) => s.setOverlay);
  const railGlow = useAppStore((s) => s.railGlow);
  const setRailGlow = useAppStore((s) => s.setRailGlow);

  const onClick = (id: string): void => {
    if (id === "forge") setOverlay("none");
    if (id === "research") {
      if (overlay === "research") {
        setOverlay("none");
      } else {
        setOverlay("research");
        if (railGlow) setRailGlow(false);
      }
    }
  };

  return (
    <aside className="rail">
      <div className="rail-head">NAV</div>
      {railButtons.map((b) => {
        const isActive = (b.id === "forge" && overlay === "none") || (b.id === "research" && overlay === "research");
        const pulsing = b.id === "research" && railGlow && overlay !== "research";
        return (
          <button
            key={b.id}
            className={`rail-btn${isActive ? " active" : ""}${pulsing ? " complete-pulse" : ""}`}
            title={b.title}
            onClick={() => onClick(b.id)}
          >
            <span className="rb-dot" />
            <Glyph kind={b.glyph} />
          </button>
        );
      })}
      <div className="rail-divider" />
      {secondaryButtons.map((b) => (
        <button key={b.id} className="rail-btn" title={b.title}>
          <Glyph kind={b.glyph} />
        </button>
      ))}
    </aside>
  );
}

function Glyph({ kind }: { kind: string }) {
  switch (kind) {
    case "forge":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 2 L22 8 L22 16 L12 22 L2 16 L2 8 Z" />
          <path d="M12 8 L16 10.5 L16 14.5 L12 17 L8 14.5 L8 10.5 Z" opacity="0.5" />
        </svg>
      );
    case "research":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="7" opacity="0.4" />
          <path d="M12 2 L12 5 M12 19 L12 22 M2 12 L5 12 M19 12 L22 12" />
        </svg>
      );
    case "protocols":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="4" y="5" width="7" height="14" rx="1" />
          <rect x="13" y="5" width="7" height="9" rx="1" />
        </svg>
      );
    case "augments":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 3 L20 7 L20 17 L12 21 L4 17 L4 7 Z" />
          <path d="M12 3 L12 21 M4 7 L20 17 M20 7 L4 17" opacity="0.4" />
        </svg>
      );
    case "arsenals":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4 L12 12 L18 14" />
        </svg>
      );
    case "archive":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="3" />
          <circle cx="5" cy="6" r="1.5" />
          <circle cx="19" cy="6" r="1.5" />
          <circle cx="5" cy="18" r="1.5" />
          <circle cx="19" cy="18" r="1.5" />
          <path d="M6 7 L10 11 M18 7 L14 11 M6 17 L10 13 M18 17 L14 13" />
        </svg>
      );
    case "order":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 2 L14 9 L22 9 L16 14 L18 22 L12 17 L6 22 L8 14 L2 9 L10 9 Z" />
        </svg>
      );
    case "trials":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="5" width="18" height="15" rx="2" />
          <path d="M3 10 L21 10 M8 3 L8 7 M16 3 L16 7" />
        </svg>
      );
    default:
      return null;
  }
}
