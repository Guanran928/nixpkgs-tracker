import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import { domAnimation, LazyMotion, MotionConfig } from "motion/react";

import "./index.css";
import App from "./App.tsx";
import { SettingsProvider } from "@/context/SettingsContext.tsx";
import { TooltipProvider } from "./components/ui/tooltip.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SettingsProvider>
      <LazyMotion features={domAnimation}>
        <MotionConfig reducedMotion="user">
          <TooltipProvider>
            <App />
            <Toaster position="bottom-center" />
          </TooltipProvider>
        </MotionConfig>
      </LazyMotion>
    </SettingsProvider>
  </StrictMode>,
);
