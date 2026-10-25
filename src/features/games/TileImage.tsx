import { useState } from 'react';
import { PLACEHOLDER, safeThumb } from './GameCard.tsx';

/**
 * Ảnh thumbnail cho ô bento / "Chơi tiếp". Không gắn `data-testid="game-thumbnail"`
 * (thuộc riêng thẻ game trong lưới). Ảnh trang trí: tên game nằm ở text của link bọc ngoài.
 */
export function TileImage({ url, className }: { url: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      className={className}
      src={failed ? PLACEHOLDER : safeThumb(url)}
      alt=""
      loading="lazy"
      width="320"
      height="240"
      onError={() => setFailed(true)}
    />
  );
}
