import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-blue-600 text-2xl font-bold">✓</span>
        <span className="font-bold text-gray-800 text-lg tracking-tight">TaskManager</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">
          {user?.full_name}
        </span>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-400 hover:text-red-500 transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
