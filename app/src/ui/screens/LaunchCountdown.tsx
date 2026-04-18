import { useEffect, useState } from "react";

/**
 * Launch countdown — 3-2-1-GO overlay per docs/my_game/10-design-system.md §6.2.
 * Big mono numeral, cyan glow, expanding rings, auto-resolves into the run.
 */
export function LaunchCountdown({ onComplete }: { onComplete: () => void }) {
  const [n, setN] = useState(3);
  const [showGo, setShowGo] = useState(false);

  useEffect(() => {
    if (n > 0) {
      const t = window.setTimeout(() => setN((v) => v - 1), 900);
      return () => window.clearTimeout(t);
    }
    setShowGo(true);
    const t = window.setTimeout(() => onComplete(), 650);
    return () => window.clearTimeout(t);
  }, [n, onComplete]);

  return (
    <div className="launch-overlay active">
      <span className="lc-ring" />
      <span className="lc-ring" style={{ animationDelay: "0.3s" }} />
      <span className="lc-tag">Launch Sequence</span>
      <div className="lc-num mono">{showGo ? "GO" : n}</div>
      <span className="lc-name">Vigil-07 · Bulwark Class</span>
    </div>
  );
}
