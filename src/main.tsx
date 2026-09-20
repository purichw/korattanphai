import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { startOperationalTelemetry } from "./operationalTelemetry";
import "./styles.css";
import "./drought-workspace.css";
import "./home-overview.css";
import "./operational-workspace.css";

const stopTelemetry = startOperationalTelemetry();
if (import.meta.hot) import.meta.hot.dispose(stopTelemetry);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
