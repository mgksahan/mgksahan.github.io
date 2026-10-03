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
    let manifest = document.querySelector("link[rel='manifest']") as HTMLLinkElement | null;

    const setDefaultFavicons = () => {
      // Remove any override favicon links
      document.querySelectorAll("link[rel*='icon']").forEach((el) => el.remove());

      const configs = [
        { rel: 'icon', href: '/favicon-black.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: light)' },
        { rel: 'icon', href: '/favicon-white.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: dark)' },
        { rel: 'icon', href: '/favicon-black-32.png', type: 'image/png', sizes: '32x32', media: '(prefers-color-scheme: light)' },
        { rel: 'icon', href: '/favicon-white-32.png', type: 'image/png', sizes: '32x32', media: '(prefers-color-scheme: dark)' },
        { rel: 'apple-touch-icon', href: '/favicon-black-180.png', media: '(prefers-color-scheme: light)' },
        { rel: 'apple-touch-icon', href: '/favicon-white-180.png', media: '(prefers-color-scheme: dark)' },
      ];

      configs.forEach((cfg) => {
        const link = document.createElement('link');
        link.rel = cfg.rel;
        link.href = cfg.href;
        if (cfg.type) link.type = cfg.type;
        if (cfg.sizes) link.setAttribute('sizes', cfg.sizes);
        if (cfg.media) link.media = cfg.media;
        document.head.appendChild(link);
      });
    };

    const setSingleFavicon = (iconPath: string, appleIconPath?: string) => {
      document.querySelectorAll("link[rel*='icon']").forEach((el) => el.remove());

      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = iconPath;
      document.head.appendChild(link);

      if (appleIconPath) {
        const appleLink = document.createElement('link');
        appleLink.rel = 'apple-touch-icon';
        appleLink.href = appleIconPath;
        document.head.appendChild(appleLink);
      }
    };

    if (isGym) {
      setSingleFavicon('/dumbbell_icon.png', '/dumbbell_icon.png');
      if (!manifest) {
        manifest = document.createElement('link');
        manifest.rel = 'manifest';
        document.head.appendChild(manifest);
      }
      manifest.href = '/manifest.json';
    } else if (isFitness) {
      setSingleFavicon('/dumbbell_icon.png', '/dumbbell_icon.png');
      if (manifest) {
        manifest.remove();
      }
    } else if (isDiary) {
      setSingleFavicon('/favicon-black.svg', '/diary_icon.png');
      if (!manifest) {
        manifest = document.createElement('link');
        manifest.rel = 'manifest';
        document.head.appendChild(manifest);
      }
      manifest.href = '/diary_manifest.json';
    } else {
      // Check if we need to restore default favicons (e.g. if previous page had custom favicon)
      const hasMediaFavicon = document.querySelector("link[rel='icon'][media]");
      if (!hasMediaFavicon) {
        setDefaultFavicons();
      }
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
