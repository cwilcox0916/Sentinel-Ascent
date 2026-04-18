import { TopBar } from "./ui/TopBar.tsx";
import { Rail } from "./ui/Rail.tsx";
import { Stage } from "./ui/Stage.tsx";
import { BottomDock } from "./ui/BottomDock.tsx";
import { RightPanel } from "./ui/RightPanel.tsx";
import { Toasts } from "./ui/Toasts.tsx";
import { MainMenu } from "./ui/screens/MainMenu.tsx";
import { SaveSlots } from "./ui/screens/SaveSlots.tsx";
import { Hangar } from "./ui/screens/Hangar.tsx";
import { Defeat } from "./ui/screens/Defeat.tsx";
import { LoadoutHost } from "./ui/screens/Loadout.tsx";
import { BoonChoiceHost } from "./ui/screens/BoonChoice.tsx";
import { PwaUpdateBanner } from "./ui/PwaUpdateBanner.tsx";
import { ResearchBayHost } from "./ui/ResearchBayHost.tsx";
import { useAppStore } from "./store/appStore.ts";

export function App() {
  const route = useAppStore((s) => s.route);
  const runEpoch = useAppStore((s) => s.runEpoch);

  if (route === "main-menu") return (
    <>
      <MainMenu />
      <PwaUpdateBanner />
    </>
  );
  if (route === "title") return (
    <>
      <SaveSlots />
      <PwaUpdateBanner />
    </>
  );
  if (route === "hangar") return (
    <>
      <Hangar />
      <PwaUpdateBanner />
    </>
  );

  return (
    <>
      <div className="shell">
        <TopBar />
        <Rail />
        <Stage key={runEpoch} />
        <BottomDock />
        <RightPanel />
      </div>
      <ResearchBayHost />
      <LoadoutHost />
      <Toasts />
      <BoonChoiceHost />
      <Defeat />
      <PwaUpdateBanner />
    </>
  );
}
