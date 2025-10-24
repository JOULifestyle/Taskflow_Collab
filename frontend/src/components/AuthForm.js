import { useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AuthForm() {
  const { login, signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const navigate = useNavigate(); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let success;
      if (mode === "login") {
        success = await login(email, password);
      } else {
        success = await signup(email, email, password);
      }

      if (success) {
        toast.success(`${mode} successful`);
        navigate("/");   
      }
    } catch (err) {
      toast.error(err.message || "Auth failed");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-6 rounded-md shadow-md flex flex-col gap-3 w-full max-w-sm"
    >
      <h2 className="text-xl font-bold text-center mb-2">
        {mode === "login" ? "Login" : "Signup"}
      </h2>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="p-2 border rounded-md"
        required
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="p-2 border rounded-md"
        required
      />

      <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
        {mode === "login" ? "Login" : "Signup"}
      </button>

      <p className="text-sm text-center mt-2">
        {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="text-blue-500 underline"
        >
          {mode === "login" ? "Signup" : "Login"}
        </button>
      </p>
    </form>
  );
}
