import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { useState } from "react";
import TodoPage from "./pages/TodoPage";
import Dashboard from "./pages/Dashboard";
import CalendarView from "./pages/CalenderView";
import Layout from "./Layout";

export default function App() {
  const [dark, setDark] = useState(false);
  return (
    <Router>
      <Layout dark={dark}>
        {/* Fixed Nav */}
        <nav className="fixed top-0 left-0 w-full p-4 bg-white/80 backdrop-blur-md shadow-md flex gap-4 z-10">
          <Link to="/">Tasks</Link>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/calenderview">Calender</Link>
          <button
            onClick={() => setDark(!dark)}
            className="ml-auto px-3 py-1 bg-gray-300 rounded"
          >
            {dark ? "☀️" : "🌙"}
          </button>
        </nav>

        {/* Centered page content */}
        <main className="flex-1 flex justify-center items-center pt-24">
          <Routes>
            <Route path="/" element={<TodoPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/calenderview" element={<CalendarView />} />
          </Routes>
        </main>
      </Layout>
    </Router>
  );
}
