import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "./lib/AuthContext.jsx";
import SiteGate from "./components/SiteGate.jsx";
import "./styles/global.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SiteGate>
      <AuthProvider>
        <App />
      </AuthProvider>
    </SiteGate>
  </React.StrictMode>
);
