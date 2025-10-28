import { Routes, Route, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import TodoPage from "./pages/TodoPage";
import Dashboard from "./pages/Dashboard";
import CalendarView from "./pages/CalenderView";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import Layout from "./Layout";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import ProtectedRoute from "./components/ProtectedRoute";
import UserAvatar from "./components/UserAvatar";
import InstallPrompt from "./components/InstallPrompt";

export default function App() {
  const { token } = useAuth();
  
  usePushNotifications(token);

  const [dark, setDark] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Request notification permission for fallback notifications
  useEffect(() => {
    if (token && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
      });
    }
  }, [token]);


  return (
    <Layout dark={dark}>
      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Fixed Nav */}
      <nav className="fixed top-0 left-0 w-full p-4 bg-white/80 backdrop-blur-md shadow-md z-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <img src="/logo192.png" alt="Taskflow Logo" className="w-8 h-8" />
            {/* Hamburger Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 bg-gray-300 rounded"
            >
              ☰
            </button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-4">
            <Link to="/">Tasks</Link>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/calenderview">Calender</Link>
          </div>

          <div className="flex gap-2 items-center">
            <button
              onClick={() => setDark(!dark)}
              className="px-3 py-1 bg-gray-300 rounded"
            >
              {dark ? "☀️" : "🌙"}
            </button>

            {token ? (
              <UserAvatar />
            ) : (
              <Link
                to="/auth"
                className="px-3 py-1 bg-blue-500 text-white rounded"
              >
                Login / Signup
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 flex flex-col gap-2 bg-white/90 rounded p-4">
            <Link to="/" onClick={() => setIsMobileMenuOpen(false)}>Tasks</Link>
            <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>Dashboard</Link>
            <Link to="/calenderview" onClick={() => setIsMobileMenuOpen(false)}>Calender</Link>
          </div>
        )}
      </nav>

      {/* Centered page content */}
      <main className="flex-1 flex justify-center items-center pt-24">
        <Routes>
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <TodoPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/calenderview"
            element={
              <ProtectedRoute>
                <CalendarView />
              </ProtectedRoute>
            }
          />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </main>
    </Layout>
  );
}
