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
  { to: '/query', label: 'Chat', icon: MessageSquare },
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
                    className="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors relative"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute inset-0 bg-white rounded-full"
                        initial={false}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        style={{
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)',
                          zIndex: 0
                        }}
                      >
                        {/* Small indicator bar on the left side */}
                        <div
                          className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full"
                          style={{
                            background: '#F59E0B'
                          }}
                        />
                      </motion.div>
                    )}
                    <Icon className={`w-4 h-4 relative ${isActive ? 'text-foreground' : 'text-muted-foreground'}`} style={{ zIndex: 1 }} />
                    <span className={`relative ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`} style={{ zIndex: 1 }}>
                      {label}
                    </span>
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
