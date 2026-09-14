import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

// Garde-fou de dernier recours. Celui du formulaire public est plus précis — il
// sait que le brouillon existe — mais il ne couvre que cette route. Celui-ci
// rattrape tout le reste : sans lui, n'importe quelle exception de rendu laisse
// une page blanche sans message et sans trace.
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
