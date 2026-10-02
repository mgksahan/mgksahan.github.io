import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router';

const navLinks = [
  { to: '/diary', label: 'Diary' },
  { to: '/interests', label: 'Interests' },
  { to: '/fitness', label: 'Fitness' },
];

export function RootLayout() {
  const location = useLocation();
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    setIsStandalone(mediaQuery.matches || (window.navigator as any).standalone === true);

    const handler = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const isGym = location.pathname.startsWith('/gym');
    const isFitness = location.pathname.startsWith('/fitness');
    const isDiary = location.pathname.startsWith('/diary');
    const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
    const appleFavicon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
    let manifest = document.querySelector("link[rel='manifest']") as HTMLLinkElement | null;

    if (isGym) {
      if (favicon) favicon.href = '/dumbbell_icon.png';
      if (appleFavicon) appleFavicon.href = '/dumbbell_icon.png';
      if (!manifest) {
        manifest = document.createElement('link');
        manifest.rel = 'manifest';
        document.head.appendChild(manifest);
      }
      manifest.href = '/manifest.json';
    } else if (isFitness) {
      if (favicon) favicon.href = '/dumbbell_icon.png';
      if (appleFavicon) appleFavicon.href = '/dumbbell_icon.png';
      if (manifest) {
        manifest.remove();
      }
    } else if (isDiary) {
      if (favicon) favicon.href = '/favicon.svg';
      if (appleFavicon) appleFavicon.href = '/diary_icon.png';
      if (!manifest) {
        manifest = document.createElement('link');
        manifest.rel = 'manifest';
        document.head.appendChild(manifest);
      }
      manifest.href = '/diary_manifest.json';
    } else {
      if (favicon) favicon.href = '/favicon.svg';
      if (appleFavicon) appleFavicon.href = '/favicon.svg';
      if (manifest) {
        manifest.remove();
      }
    }

    // Register PWA service worker with scoped path matching
    if ('serviceWorker' in navigator) {
      if (isGym) {
        navigator.serviceWorker.register('/sw.js', { scope: '/gym/' })
          .then((reg) => console.log('Fitness PWA SW registered:', reg.scope))
          .catch((err) => console.error('Fitness PWA SW registration failed:', err));
      } else if (isDiary) {
        navigator.serviceWorker.register('/sw.js', { scope: '/diary/' })
          .then((reg) => console.log('Diary PWA SW registered:', reg.scope))
          .catch((err) => console.error('Diary PWA SW registration failed:', err));
      }
    }
  }, [location.pathname]);

  const isHome = location.pathname === '/';
  const isGym = location.pathname === '/gym';

  if (isHome) {
    return (
      <main>
        <Outlet />
      </main>
    );
  }

  if (isGym || isStandalone) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <main className="flex-1 flex flex-col">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[#22313a] bg-[#0b1115]/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-6 py-4 flex items-center justify-between text-[0.95rem]">
          <Link to="/" className="font-mono text-[#8399a4] hover:text-[#6fd3ff] transition-colors no-underline">
            sahan.gamage
          </Link>
          
          <nav className="flex items-center gap-6">
            {navLinks.map(({ to, label }) => {
              const active = location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={[
                    'transition-colors no-underline',
                    active ? 'text-[#6fd3ff]' : 'text-[#d6e2e8] hover:text-[#6fd3ff]',
                  ].join(' ')}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="py-6 border-t border-[#22313a] text-center text-xs text-[#8399a4] font-mono">
        <p>© Kevindi | Kevindi is cool 😎</p>
      </footer>
    </div>
  );
}
