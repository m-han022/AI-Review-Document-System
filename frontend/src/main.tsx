import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/design-system.css";
import "./styles/globals.css";
// Force bundle core component styles to guarantee initial layout integrity on production Vercel builds
import "./components/reviews/ReviewListOverview.css";
import "./components/dashboard/DashboardOverview.css";
import "./components/project/ProjectCard.css";
import "./components/workspace/AuditDashboard.css";
import "./components/workspace/VersionDiffDashboard.css";
import "./components/FileUpload.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
