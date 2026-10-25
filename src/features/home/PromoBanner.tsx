import { useCatalog } from '../catalog/catalog.ts';
import { Link } from '../../routing/index.ts';
import './home.css';

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M6 4.5v15a1 1 0 0 0 1.5.86l12.2-7.5a1 1 0 0 0 0-1.72L7.5 3.64A1 1 0 0 0 6 4.5z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Banner mỏng: "Chơi ngay" tới game đầu tiên trong catalog; chưa có catalog thì ẩn nút (không trỏ cứng). */
export function PromoBanner() {
  const catalog = useCatalog();
  const first = catalog.status === 'ready' ? catalog.games[0] : undefined;
  return (
    <div className="promo" data-testid="promo-banner">
      <div className="promo__text">
        <p className="promo__title">Chơi ngay — không cần cài đặt</p>
        <p className="promo__sub">
          Chọn một game, bấm vào và chơi liền tay. Miễn phí, có bảng xếp hạng.
        </p>
      </div>
      {first ? (
        <Link href={`/games/${encodeURIComponent(first.id)}`} className="promo__cta">
          <PlayIcon />
          Chơi ngay
        </Link>
      ) : null}
    </div>
  );
}
