import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import { MotionConfig } from "motion/react";

import "./index.css";
import App from "./App.tsx";
import { SettingsProvider } from "./context/SettingsContext.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SettingsProvider>
      <MotionConfig reducedMotion="user">
        <App />
        <Toaster position="bottom-center" />
      </MotionConfig>
    </SettingsProvider>
  </StrictMode>,
);
