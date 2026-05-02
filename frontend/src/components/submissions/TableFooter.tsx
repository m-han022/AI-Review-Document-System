

interface TableFooterProps {
  totalCount: number;
  resultSummary: string;
  currentPage: number;
  totalPages: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  previousLabel: string;
  nextLabel: string;
  pageLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  variant?: "default" | "reference";
}

export default function TableFooter({
  totalCount,
  resultSummary,
  currentPage,
  totalPages,
  canGoPrevious,
  canGoNext,
  previousLabel,
  nextLabel,
  pageLabel,
  onPrevious,
  onNext,
  variant = "default",
}: TableFooterProps) {
  if (totalCount === 0) return null;

  const isReferenceVariant = variant === "reference";

  return (
    <div className={`review-table__footer ${isReferenceVariant ? "review-table__footer--reference" : ""}`.trim()}>
      <span>{resultSummary}</span>
      <div className="review-table__pagination">
        <button
          type="button"
          className={`review-table__page ${isReferenceVariant ? "review-table__page--reference" : ""}`.trim()}
          onClick={onPrevious}
          disabled={!canGoPrevious}
        >
          {previousLabel}
        </button>
        {isReferenceVariant ? (
          <span className="review-table__page review-table__page--reference is-active">{currentPage}</span>
        ) : (
          <span className="review-table__page-status">
            {pageLabel.replace("{current}", String(currentPage)).replace("{total}", String(totalPages))}
          </span>
        )}
        <button
          type="button"
          className={`review-table__page ${isReferenceVariant ? "review-table__page--reference" : ""}`.trim()}
          onClick={onNext}
          disabled={!canGoNext}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
