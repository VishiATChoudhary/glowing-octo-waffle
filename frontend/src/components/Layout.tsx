import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings, Users, Home, Workflow, FileText, LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/pipeline', label: 'Pipeline', icon: Workflow },
  { to: '/researchers', label: 'Researchers', icon: Users },
  { to: '/papers', label: 'Papers', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const { user, logout } = useAuth();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

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

        {/* User Profile */}
        <div className="p-4 border-t border-border">
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full">
                <div className="flex items-center gap-3 p-2 rounded hover:bg-secondary transition-colors">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user.picture || undefined} alt={user.name} />
                    <AvatarFallback className="text-xs">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2">
                  <User className="w-4 h-4" />
                  <span>{user.email}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="gap-2 text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <p className="text-xs text-muted-foreground mt-2">
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
