import { useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router';
import { Button } from './ui/button';
import { BookOpen, Heart, Dumbbell, ChevronLeft } from 'lucide-react';

const navLinks = [
  { to: '/diary', label: 'Diary', icon: BookOpen, exact: false },
  { to: '/interests', label: 'Interests', icon: Heart, exact: false },
  { to: '/fitness', label: 'Fitness', icon: Dumbbell, exact: false },
];

export function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const isGymOrFitness = location.pathname.startsWith('/gym') || location.pathname.startsWith('/fitness');
    const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
    const appleFavicon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;

    if (isGymOrFitness) {
      if (favicon) favicon.href = '/dumbbell_icon.png';
      if (appleFavicon) appleFavicon.href = '/dumbbell_icon.png';
    } else {
      if (favicon) favicon.href = '/favicon.svg';
      if (appleFavicon) appleFavicon.href = '/favicon.svg';
    }
  }, [location.pathname]);

  const isGym = location.pathname === '/gym';

  const isActive = (to: string, exact: boolean) =>
    exact ? location.pathname === to : location.pathname.startsWith(to);

  if (isGym) {
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
      <header className="glow-line-b sticky top-0 z-30 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Left Side: Back button (<) shown only on subpages */}
          <div className="flex items-center min-w-[40px]">
            {location.pathname !== '/' && (
              <Button 
                onClick={() => navigate('/')} 
                variant="ghost" 
                size="icon" 
                className="cursor-pointer border-none shadow-none animate-fade-in hover:bg-muted/50"
                title="Back to Portfolio"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
          </div>
          
          {/* Right Side: Tabs navigation */}
          <div className="flex items-center">
            <nav className="flex gap-1">
              {navLinks.map(({ to, label, icon: Icon, exact }) => (
                <Link
                  key={to}
                  to={to}
                  className={[
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                    isActive(to, exact)
                      ? 'bg-muted font-medium'
                      : 'opacity-60 hover:opacity-100 hover:bg-muted/50',
                  ].join(' ')}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="glow-line-t py-6 bg-card/30 text-center text-xs opacity-50 font-medium">
        <p className="copyright">© Sahan | Built with Antigravity</p>
      </footer>
    </div>
  );
}
