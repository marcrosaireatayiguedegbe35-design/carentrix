import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext";
import { ChargementLogo } from "./components/ChargementLogo";
import { initialiserNatifs } from "./lib/native";

void initialiserNatifs();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
      <ChargementLogo />
    </BrowserRouter>
  </StrictMode>
);
