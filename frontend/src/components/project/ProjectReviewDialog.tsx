import { type ReactNode } from "react";
import BaseModal from "../ui/BaseModal";
import { Button } from "../ui";

interface ProjectReviewDialogProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  score?: ReactNode;
  closeLabel: string;
}

export default function ProjectReviewDialog({
  title,
  onClose,
  children,
  wide = false,
  score,
  closeLabel,
}: ProjectReviewDialogProps) {
  return (
    <BaseModal
      open={true}
      onClose={onClose}
      title={typeof title === "string" ? title : "Review Details"}
      subtitle={score ? (typeof score === "string" ? score : undefined) : undefined}
      size={wide ? "lg" : "md"}
      footer={
        <Button variant="primary" onClick={onClose}>
          {closeLabel}
        </Button>
      }
    >
      <div className="detail-summary-content">
        {!score && typeof title !== "string" && (
          <div style={{ marginBottom: '16px' }}>{title}</div>
        )}
        {children}
      </div>
    </BaseModal>
  );
}
