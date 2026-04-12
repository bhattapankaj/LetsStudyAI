import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  HiOutlineHome, HiOutlineCalendar, HiOutlineAcademicCap,
  HiOutlineClipboardCheck, HiOutlineUser, HiOutlineDocumentText,
  HiOutlineBookOpen,
} from 'react-icons/hi';

const navItems = [
  { path: '/',           icon: HiOutlineHome,           label: 'Dashboard' },
  { path: '/planner',    icon: HiOutlineCalendar,        label: 'Planner' },
  { path: '/tutor',      icon: HiOutlineAcademicCap,     label: 'Tutor' },
  { path: '/evaluator',  icon: HiOutlineClipboardCheck,  label: 'Evaluator' },
  { path: '/documents',  icon: HiOutlineDocumentText,    label: 'Documents' },
  { path: '/profile',    icon: HiOutlineUser,            label: 'Profile' },
];

export default function Sidebar() {
  const { state } = useApp();

  // Get initials for avatar
  const initials = (state.user.name || 'S')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <HiOutlineBookOpen />
        </div>
        <div className="sidebar-brand">
          <h1>LetsStudyAI</h1>
          <span>Multi-Agent System</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Menu</div>
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            end={item.path === '/'}
          >
            <item.icon className="nav-icon" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <NavLink to="/profile" className="sidebar-user" style={{ textDecoration: 'none' }}>
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <span className="name">{state.user.name}</span>
            <span className="role">{state.user.grade}</span>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}
