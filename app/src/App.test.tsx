import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TopBar } from "./ui/TopBar.tsx";
import { Rail } from "./ui/Rail.tsx";
import { BottomDock } from "./ui/BottomDock.tsx";
import { RightPanel } from "./ui/RightPanel.tsx";
import { SaveSlots } from "./ui/screens/SaveSlots.tsx";

/**
 * App.tsx selects between <SaveSlots> and the in-game shell based on the appStore
 * route. Zustand's SSR snapshot doesn't observe post-creation setState, so we test
 * the two outputs directly by rendering the routed-to components.
 */
describe("App routes", () => {
  it("title route renders the SaveSlots title screen", () => {
    const html = renderToStaticMarkup(<SaveSlots />);
    expect(html).toContain('class="title-screen"');
    expect(html).toContain("Sentinel Ascent");
    expect(html).toContain('class="slots-list"');
    // All 5 slots present
    for (let i = 1; i <= 5; i++) {
      expect(html).toContain(`>${String(i).padStart(2, "0")}<`);
    }
  });

  it("in-game route renders the locked shell regions", () => {
    const html = renderToStaticMarkup(
      <div className="shell">
        <TopBar />
        <Rail />
        <main className="stage" />
        <BottomDock />
        <RightPanel />
      </div>,
    );
    expect(html).toContain('class="shell"');
    expect(html).toContain('class="topbar"');
    expect(html).toContain('class="rail"');
    expect(html).toContain('class="stage"');
    expect(html).toContain('class="bottom-dock"');
    expect(html).toContain('class="panel"');
  });
});
