interface TableFooterProps {
  totalCount: number;
  resultSummary: string;
  currentPage: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  variant?: "default" | "reference";
}

export default function TableFooter({
  totalCount,
  resultSummary,
  currentPage,
  canGoPrevious,
  canGoNext,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
  variant = "default",
}: TableFooterProps) {
  if (totalCount === 0) return null;

  const isReferenceVariant = variant === "reference";

  if (!isReferenceVariant) {
    // Original footer logic if needed
  }

  return (
    <div className="review-footer-v3">
      <span className="review-footer__summary-v3">{resultSummary}</span>
      <div className="review-pagination-v3">
        <button
          type="button"
          className="review-pagination-btn-v3"
          onClick={onPrevious}
          disabled={!canGoPrevious}
        >
          {previousLabel}
        </button>
        
        <span className="review-pagination-page-v3">{currentPage}</span>
        
        <button
          type="button"
          className="review-pagination-btn-v3"
          onClick={onNext}
          disabled={!canGoNext}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
