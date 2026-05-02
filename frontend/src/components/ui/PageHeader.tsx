import type { CSSProperties, ReactNode } from "react";
import { aiReviewAssets } from "../../assets/aiReviewAssets";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div
      className="dashboard-reference__hero dashboard-reference__hero--v3"
      style={{ "--ai-review-header-bg": `url(${aiReviewAssets.headerLightAi})` } as CSSProperties}
    >
      <div className="dashboard-reference__hero-copy">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="dashboard-reference__hero-visual dashboard-reference__hero-visual--v3" aria-hidden="true">
        <img className="dashboard-reference__hero-chip-image-v3" src={aiReviewAssets.heroObject} alt="" />
      </div>

      {children}
    </div>
  );
}
