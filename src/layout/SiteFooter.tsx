import { GAME_ORIGIN } from '../config.ts';

export const CREDIT_REPO_URL = 'https://github.com/he-is-talha/html-css-javascript-games';

export function SiteFooter({ year = new Date().getFullYear() }: { year?: number }) {
  return (
    <footer className="site-footer">
      <p className="site-footer__credit">
        Các game dựa trên mã nguồn MIT của Talha Bin Yousaf (
        <a href={CREDIT_REPO_URL} target="_blank" rel="noopener noreferrer">
          mã nguồn gốc
        </a>
        {' · '}
        <a href={`${GAME_ORIGIN}/games/LICENSE.txt`} target="_blank" rel="noopener noreferrer">
          giấy phép
        </a>
        ).
      </p>
      <p className="site-footer__copy">© {year} Quick Playing</p>
    </footer>
  );
}
