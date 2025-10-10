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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <AuthForm />
    </div>
  );
}
