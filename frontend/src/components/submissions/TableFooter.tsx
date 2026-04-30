

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
}: TableFooterProps) {
  if (totalCount === 0) return null;

  return (
    <div className="review-table__footer">
      <span>{resultSummary}</span>
      <div className="review-table__pagination">
        <button
          type="button"
          className="review-table__page"
          onClick={onPrevious}
          disabled={!canGoPrevious}
        >
          {previousLabel}
        </button>
        <span className="review-table__page-status">
          {pageLabel.replace("{current}", String(currentPage)).replace("{total}", String(totalPages))}
        </span>
        <button
          type="button"
          className="review-table__page"
          onClick={onNext}
          disabled={!canGoNext}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
