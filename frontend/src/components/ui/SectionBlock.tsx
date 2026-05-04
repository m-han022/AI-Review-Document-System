import type { ReactNode } from "react";

interface SectionBlockRootProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

interface SectionBlockHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
}

interface SectionBlockBodyProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

function SectionBlockRoot({ children, className, style }: SectionBlockRootProps) {
  return <section className={`section-block ${className ?? ""}`.trim()} style={style}>{children}</section>;
}

function SectionBlockHeader({ title, subtitle, aside }: SectionBlockHeaderProps) {
  return (
    <header className="section-block__header">
      <div>
        <h2 className="section-block__title">{title}</h2>
        {subtitle ? <p className="section-block__subtitle">{subtitle}</p> : null}
      </div>
      {aside ? <div className="section-block__aside">{aside}</div> : null}
    </header>
  );
}

function SectionBlockBody({ children, className, style }: SectionBlockBodyProps) {
  return <div className={`section-block__body ${className ?? ""}`.trim()} style={style}>{children}</div>;
}

const SectionBlock = Object.assign(SectionBlockRoot, {
  Header: SectionBlockHeader,
  Body: SectionBlockBody,
});

export default SectionBlock;
