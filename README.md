# Play Sprint — Frontend

Frontend của nền tảng chơi game nhanh trên web (tách từ monorepo Quick Playing): danh mục game kiểu "arcade", trang chơi nhúng game trong iframe sandbox, nộp điểm có xác minh, bảng xếp hạng, đăng nhập/đăng ký, hồ sơ và lịch sử chơi.

## Công nghệ
- React 19 + Vite 8, TypeScript 6 (strict), không dùng router bên ngoài (routing tự viết bằng History API).
- Test: Vitest + jsdom + Testing Library.
- Lint/format: ESLint (flat config) + Prettier.
- Node 24 (`.nvmrc`), pnpm.

## Chạy
```bash
nvm use
pnpm install
pnpm dev        # http://localhost:5173
```

Frontend cần hai dịch vụ chạy riêng (repo backend):
- **API** — mặc định `http://127.0.0.1:3000`. Dev server Vite proxy `/api` sang đây để frontend gọi API **cùng origin** (cookie đăng nhập `SameSite`, kiểm `Origin` chống CSRF).
- **Games server** — phục vụ game ở **origin riêng**, mặc định `http://localhost:5174`.

## Biến môi trường (`.env` ở thư mục gốc repo, không commit)
| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `VITE_GAME_ORIGIN` | `http://localhost:5174` | Origin phục vụ game; dùng để kiểm `embedUrl` và đặt CSP `frame-src`. Phải khác origin của web. |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:3000` | Chỉ dev: địa chỉ backend mà Vite proxy `/api` tới. |

Production: phục vụ bản build (`dist/`) và `/api` của backend **dưới cùng một origin** (reverse proxy), có SPA fallback về `index.html`, và đặt CSP/header bảo mật ở reverse proxy.

## Lệnh
| Việc | Lệnh |
|---|---|
| Dev | `pnpm dev` |
| Test | `pnpm test` |
| Lint / format | `pnpm lint`, `pnpm format` |
| Type-check | `pnpm typecheck` |
| Build | `pnpm build` (ra `dist/`) |

## Hợp đồng API & giao thức game
- `docs/api-contract.yaml` — hợp đồng FE ↔ BE (OpenAPI 3.1). Bản này là **bản sao**; nguồn sự thật nằm ở repo backend — cập nhật contract ở đó trước rồi đồng bộ về đây.
- `docs/game-protocol.md` — giao thức `postMessage` giữa game (iframe) và host.

## Ghi công
Các game được nhúng dựa trên mã nguồn MIT của Talha Bin Yousaf (https://github.com/he-is-talha/html-css-javascript-games); game được phục vụ từ games server ở repo backend.
