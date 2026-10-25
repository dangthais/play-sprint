import { HistoryPage } from './features/account/HistoryPage.tsx';
import { ProfilePage } from './features/account/ProfilePage.tsx';
import { AuthProvider } from './features/auth/AuthProvider.tsx';
import { GuestOnly, RequireAuth } from './features/auth/guards.tsx';
import { LoginPage } from './features/auth/LoginPage.tsx';
import { RegisterPage } from './features/auth/RegisterPage.tsx';
import { GameListPage } from './features/games/GameListPage.tsx';
import { GamePlayPage } from './features/play/GamePlayPage.tsx';
import { SiteLayout } from './layout/SiteLayout.tsx';
import { Link, useRoute } from './routing/index.ts';
import './features/games/games.css';

export function App() {
  const route = useRoute();
  return (
    <AuthProvider>
      <SiteLayout>
        {route.name === 'list' && <GameListPage />}
        {route.name === 'play' && <GamePlayPage key={route.id} id={route.id} />}
        {route.name === 'login' && (
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        )}
        {route.name === 'register' && (
          <GuestOnly>
            <RegisterPage />
          </GuestOnly>
        )}
        {route.name === 'profile' && (
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        )}
        {route.name === 'history' && (
          <RequireAuth>
            <HistoryPage />
          </RequireAuth>
        )}
        {route.name === 'notFound' && (
          <div data-testid="page-not-found" className="games-message">
            <p>Không tìm thấy trang.</p>
            <Link href="/" className="play-page__back">
              Về trang chủ
            </Link>
          </div>
        )}
      </SiteLayout>
    </AuthProvider>
  );
}
