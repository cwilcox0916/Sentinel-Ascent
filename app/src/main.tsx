import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles/index.css";
import { installCrashHandlers } from "./platform/telemetry.ts";

installCrashHandlers();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");

// StrictMode intentionally disabled: it double-invokes useEffect in dev, which
// would create + destroy + create the PixiJS Application (and its WebGL context)
// on every mount, leading to a busy renderer thread. Re-enable in a later phase
// once Stage's lifecycle is fully StrictMode-safe.
createRoot(rootEl).render(<App />);
