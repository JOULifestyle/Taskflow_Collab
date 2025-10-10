import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import TodoPage from "./pages/TodoPage";
import Dashboard from "./pages/Dashboard";
import CalendarView from "./pages/CalenderView";
import Layout from "./Layout";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { useAuth } from "./context/AuthContext"; 
import AuthPage from "./pages/AuthPage";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  usePushNotifications(token);

  const [dark, setDark] = useState(false);

  // Request notification permission for fallback notifications
  useEffect(() => {
    if (token && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        console.log("🔔 Notification permission:", permission);
      });
    }
  }, [token]);


  return (
    <Layout dark={dark}>
      {/* Fixed Nav */}
      <nav className="fixed top-0 left-0 w-full p-4 bg-white/80 backdrop-blur-md shadow-md flex gap-4 z-10">
        <Link to="/">Tasks</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/calenderview">Calender</Link>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setDark(!dark)}
            className="px-3 py-1 bg-gray-300 rounded"
          >
            {dark ? "☀️" : "🌙"}
          </button>

          {token ? (
            <button
              onClick={() => {
                logout();
                navigate("/auth");
              }}
              className="px-3 py-1 bg-red-500 text-white rounded"
            >
              Logout
            </button>
          ) : (
            <Link
              to="/auth"
              className="px-3 py-1 bg-blue-500 text-white rounded"
            >
              Login / Signup
            </Link>
          )}
        </div>
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
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </main>
    </Layout>
  );
}
