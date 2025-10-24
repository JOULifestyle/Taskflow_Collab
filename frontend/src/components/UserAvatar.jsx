import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function UserAvatar() {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  if (!user) return null;

  // Get first letter of email (or username as fallback)
  const displayEmail = user.email || user.username;
  const firstLetter = displayEmail.charAt(0).toUpperCase();

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold text-lg hover:bg-blue-600 transition-colors"
        title="User menu"
      >
        {firstLetter}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="text-sm text-gray-600">User ID</div>
            <div className="text-sm font-mono text-gray-800 break-all">{user._id}</div>
          </div>
          <div className="px-4 py-2">
            <div className="text-sm text-gray-600">Email</div>
            <div className="text-sm font-mono text-gray-800 break-all">{displayEmail}</div>
          </div>
          <div className="border-t border-gray-100 mt-2 pt-2">
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      )}

      
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}