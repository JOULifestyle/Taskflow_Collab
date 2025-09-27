// src/hooks/useLists.js
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export function useLists() {
  const { token } = useAuth();
  const [lists, setLists] = useState([]);
  const [currentList, setCurrentList] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchLists = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/lists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch lists");
      const data = await res.json();
      setLists(data);

      // If currentList is missing or invalid, reset it
      if (currentList && !data.find((l) => l._id === currentList._id)) {
        selectList(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, currentList]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  // Create a new list
  const createList = useCallback(
    async (name) => {
      if (!name?.trim()) return;
      try {
        const res = await fetch(`${API_URL}/lists`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) throw new Error("Failed to create list");
        const newList = await res.json();
        setLists((prev) => [...prev, newList]);
        selectList(newList);
      } catch (err) {
        console.error(err);
      }
    },
    [token]
  );

  // Select or clear currentList
  const selectList = (list) => {
    setCurrentList(list);
    if (list) {
      localStorage.setItem("currentList", JSON.stringify(list));
    } else {
      localStorage.removeItem("currentList");
    }
  };

  // Restore currentList only once at startup
  useEffect(() => {
    const saved = localStorage.getItem("currentList");
    if (saved) {
      try {
        setCurrentList(JSON.parse(saved));
      } catch {
        localStorage.removeItem("currentList");
      }
    }
  }, []);

  return { lists, currentList, selectList, createList, loading, fetchLists };
}
