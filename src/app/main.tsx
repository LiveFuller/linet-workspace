import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@/app/styles/tokens.css";
import "@/app/styles/base.css";
import { AppProvider } from "@/app/AppProvider";
import { ToastProvider } from "@/components/Toaster";
import { AppRoutes } from "@/app/routes";

// BASE_URL is "/" in dev, "/linetapp/" in production build (vite.config.ts).
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <BrowserRouter basename={basename}>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </BrowserRouter>
    </ToastProvider>
  </StrictMode>
);

// Register service worker (production only, scope derived from basename)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${basename}/sw.js`, { scope: `${basename}/` }).catch(() => {
      /* best-effort — offline is optional */
    });
  });
}
