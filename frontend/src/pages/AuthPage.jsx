import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthForm from "../components/AuthForm";

export default function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // redirect if already logged in
  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4 transition-colors duration-300">
      <div className="w-full max-w-md">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 dark:bg-blue-500 rounded-full mb-4 shadow-lg">
            <span className="text-2xl text-white font-bold">📅</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Todo app</h1>
          <p className="text-gray-600 dark:text-gray-300">Organize your tasks, boost your productivity</p>
        </div>

        <AuthForm />

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
          <p>© 2025 JOU Lifestyle inc. Built for productivity.</p>
        </div>
      </div>
    </div>
  );
}
