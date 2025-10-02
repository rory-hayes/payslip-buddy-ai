import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { EnvironmentGate } from "./components/EnvironmentGate";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <EnvironmentGate>
        <App />
      </EnvironmentGate>
    </ErrorBoundary>
  </StrictMode>,
);
