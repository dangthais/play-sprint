import type { CSSProperties } from 'react';
import { CategoryIcon } from '../catalog/CategoryIcon.tsx';
import { useCatalog, useCategories } from '../catalog/catalog.ts';
import { Link } from '../../routing/index.ts';
import './home.css';

/** Hàng ô danh mục (chỉ danh mục có ≥1 game). Lỗi catalog: ẩn khối; đang tải: khung chờ. */
export function CategoryTiles() {
  const catalog = useCatalog();
  const categories = useCategories();

  if (catalog.status === 'loading') {
    return (
      <div className="category-tiles category-tiles--skeleton" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className="category-tile category-tile--skeleton" />
        ))}
      </div>
    );
  }
  if (categories.length === 0) return null;

  const style = { '--n': Math.min(categories.length, 4) } as CSSProperties;
  return (
    <ul className="category-tiles" aria-label="Danh mục nổi bật" style={style}>
      {categories.map((c) => (
        <li key={c.slug}>
          <Link
            href={`/?tag=${encodeURIComponent(c.slug)}`}
            className="category-tile"
            data-testid="category-tile"
            style={{ '--tile-a': c.from, '--tile-b': c.to } as CSSProperties}
          >
            <span className="category-tile__art" aria-hidden="true">
              <CategoryIcon slug={c.slug} size={64} />
            </span>
            <span className="category-tile__name">{c.name}</span>
            <span className="category-tile__count">{c.count} game</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
