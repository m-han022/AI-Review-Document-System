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
    <div className="ds-table-footer">
      <div className="ds-pagination">
        <button
          type="button"
          className="ds-pagination-btn ds-pagination-nav"
          onClick={onPrevious}
          disabled={!canGoPrevious}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        
        <div className="ds-pagination-current">{currentPage}</div>
        
        <button
          type="button"
          className="ds-pagination-btn"
          onClick={() => {}} // Placeholder for page 2 if needed, but current logic only shows current
          style={{ opacity: totalCount > 10 ? 1 : 0.5 }}
        >
          {currentPage + 1}
        </button>

        <button
          type="button"
          className="ds-pagination-btn ds-pagination-nav"
          onClick={onNext}
          disabled={!canGoNext}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
      <span className="ds-caption" style={{ color: 'var(--ds-color-text-muted)', fontWeight: 500 }}>
        {resultSummary}
      </span>
    </div>
  );
}
