import React from 'react';
import './Card.css';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: string;
  className?: string;
  noBorder?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  headerAction,
  footer,
  padding,
  className = '',
  noBorder = false
}) => {
  return (
    <div className={`ds-card ${noBorder ? 'no-border' : ''} ${className}`}>
      {(title || headerAction) && (
        <div className="ds-card__header">
          <div className="ds-card__title-group">
            {title && <h3 className="ds-section">{title}</h3>}
            {subtitle && <p className="ds-caption">{subtitle}</p>}
          </div>
          {headerAction && <div className="ds-card__action">{headerAction}</div>}
        </div>
      )}
      <div className="ds-card__body" style={padding ? { padding } : undefined}>
        {children}
      </div>
      {footer && <div className="ds-card__footer">{footer}</div>}
    </div>
  );
};
