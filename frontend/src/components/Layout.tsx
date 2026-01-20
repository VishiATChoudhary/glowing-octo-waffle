import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, MessageSquare, Settings, Network, Users, Home } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/search', label: 'Search Papers', icon: FileText },
  { to: '/researchers', label: 'Researchers', icon: Users },
  { to: '/query', label: 'Query', icon: MessageSquare },
  { to: '/graph', label: 'Graph', icon: Network },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border flex flex-col">
        {/* Logo */}
        <NavLink to="/">
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <img
                src="/waffle-icon.svg"
                alt="Waffles"
                className="w-10 h-10"
              />
              <h1 className="text-4xl font-semibold tracking-tight">Waffles</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Academic Discovery</p>
          </div>
        </NavLink>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => {
              const isActive = location.pathname === to;
              return (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors relative ${
                      isActive
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute inset-0 bg-secondary rounded"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <Icon className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">{label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Version 1.0.0
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
};

export default Layout;
