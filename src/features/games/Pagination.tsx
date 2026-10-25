interface Props {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Pagination({ page, totalPages, onChange }: Props) {
  return (
    <nav aria-label="Phân trang" className="pagination">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <Chevron dir="left" />
        Trang trước
      </button>
      <span data-testid="pagination-status" className="pagination__status" aria-live="polite">
        Trang {page} / {totalPages}
      </span>
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Trang sau
        <Chevron dir="right" />
      </button>
    </nav>
  );
}
