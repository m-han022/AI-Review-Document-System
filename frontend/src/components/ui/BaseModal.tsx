import React, { useEffect, useRef } from "react";
import { Button } from "./index";
import { CloseIcon } from "./Icon";
import "./BaseModal.css";

interface BaseModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
  closeOnOutsideClick?: boolean;
  className?: string;
}

export default function BaseModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
  showCloseButton = true,
  closeOnOutsideClick = true,
  className = "",
}: BaseModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOutsideClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="ds-modal-overlay" onClick={handleOverlayClick} aria-modal="true" role="dialog">
      <div className={`ds-modal ds-modal--${size} ${className}`} ref={modalRef}>
        <header className="ds-modal__header">
          <div className="ds-modal__title-group">
            <h3 className="ds-modal__title">{title}</h3>
            {subtitle && <p className="ds-modal__subtitle">{subtitle}</p>}
          </div>
          {showCloseButton && (
            <button className="ds-modal__close-btn" onClick={onClose} aria-label="Close modal">
              <CloseIcon size="sm" />
            </button>
          )}
        </header>

        <main className="ds-modal__body">
          {children}
        </main>

        {footer && (
          <footer className="ds-modal__footer">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
