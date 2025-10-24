import { createContext, useContext, useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

const AuthContext = createContext();

function decodeJwt(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload;
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    setUser(null);
    toast("You’ve been logged out");
  }, []);

  //  Load token & username from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const email = localStorage.getItem("email");

    if (token && username) {
      const payload = decodeJwt(token);

      // check if token is expired
      if (payload?.exp && Date.now() >= payload.exp * 1000) {
        console.warn("Token expired, logging out");
        logout();
      } else {
        setUser({
          token,
          username,
          email,
          _id: payload?.id,
        });
      }
    }
  }, [logout]);

  const login = async (username, password) => {
    try {
      const res = await fetch("http://localhost:5000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.username);
        localStorage.setItem("email", data.email || username); // Store email (fallback to username if not provided)
        const payload = decodeJwt(data.token);
        setUser({ token: data.token, username: data.username, email: data.email || username, _id: payload?.id });
        toast.success("Logged in successfully!");
        return true;
      } else {
        toast.error(data.error || "Login failed");
        return false;
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error");
      return false;
    }
  };

  const signup = async ( username, email, password) => {
    try {
      const res = await fetch("http://localhost:5000/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.username);
        localStorage.setItem("email", data.email || username); // Store email (fallback to username if not provided)
        const payload = decodeJwt(data.token);
        setUser({ token: data.token, username: data.username, email: data.email || username, _id: payload?.id });
        toast.success("Signed up successfully!");
        return true;
      } else {
        toast.error(data.error || "Signup failed");
        return false;
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error");
      return false;
    }
  };


  return (
    <AuthContext.Provider value={{ user, token: user?.token, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
