import { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router';
import {
  LayoutDashboard,
  FileText,
  Upload,
  MessageSquare,
  Search,
  Shield,
  Bot,
  LogOut,
  User,
  Menu,
  X,
  ChevronDown,
  Wifi,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getInitials } from './shared/utils';

const PRIMARY = '#0d6efd';
const BORDER = '#e9ecef';
const LIGHT = '#f8f9fa';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
  { to: '/documents', icon: <FileText size={16} />, label: 'Documents' },
  { to: '/upload', icon: <Upload size={16} />, label: 'Upload' },
  { to: '/chat', icon: <MessageSquare size={16} />, label: 'Chat' },
  { to: '/search', icon: <Search size={16} />, label: 'Search' },
  { to: '/admin', icon: <Shield size={16} />, label: 'Admin', adminOnly: true },
];

export function Layout({ title }: { title: string }) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = getInitials(user?.firstName, user?.lastName, user?.username);

  const SidebarContent = () => (
    <div
      style={{
        width: 240,
        background: '#fff',
        borderRight: `1px solid ${BORDER}`,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
        boxSizing: 'border-box',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, paddingLeft: 4 }}>
        <div
          style={{
            background: PRIMARY,
            borderRadius: 8,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bot size={20} color="#fff" />
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#212529' }}>DocAI</span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setSidebarOpen(false)}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              color: isActive ? '#fff' : '#495057',
              background: isActive ? PRIMARY : 'transparent',
              transition: 'background 0.15s, color 0.15s',
            })}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User dropdown */}
      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12, position: 'relative' }}>
        <button
          onClick={() => setUserMenuOpen((v) => !v)}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 4px',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: '#cfe2ff',
              color: PRIMARY,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#212529',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : user?.username}
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#6c757d',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.email}
            </div>
          </div>
          <ChevronDown size={14} color="#6c757d" />
        </button>

        {userMenuOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              background: '#fff',
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              marginBottom: 4,
              overflow: 'hidden',
            }}
          >
            <NavLink
              to="/profile"
              onClick={() => { setUserMenuOpen(false); setSidebarOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                textDecoration: 'none',
                color: '#495057',
                fontSize: 14,
              }}
            >
              <User size={15} />
              My Profile
            </NavLink>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#dc3545',
                fontSize: 14,
                textAlign: 'left',
              }}
            >
              <LogOut size={15} />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: LIGHT }}>
      {/* Desktop sidebar */}
      <div className="hidden md:block" style={{ width: 240, flexShrink: 0 }}>
        <SidebarContent />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className="md:hidden"
        style={{
          position: 'fixed',
          left: sidebarOpen ? 0 : -260,
          top: 0,
          zIndex: 100,
          transition: 'left 0.25s ease',
        }}
      >
        <SidebarContent />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div
          style={{
            height: 56,
            background: '#fff',
            borderBottom: `1px solid ${BORDER}`,
            boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <button
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h5 style={{ margin: 0, fontWeight: 600, fontSize: 16, color: '#212529', flex: 1 }}>
            {title}
          </h5>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: '#d1e7dd',
              color: '#0f5132',
              borderRadius: 20,
              padding: '3px 10px',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <Wifi size={12} />
            Online
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
