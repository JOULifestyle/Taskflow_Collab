// src/hooks/useLists.js
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketProvider"; 
import toast from "react-hot-toast";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export function useLists() {
  const { user } = useAuth();          //  get user from context
  const token = user?.token;           //  extract token safely
  const { socket } = useSocket();      //  socket is provided by SocketProvider

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

      // Reset currentList if it no longer exists
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

  //  Socket listener for list:shared
  useEffect(() => {
    if (!token || !socket) return;

    const handleShared = (data) => {
      console.log("📢 List shared update:", data);
      toast((t) => (
        <div className="flex flex-col gap-2">
          <span>
            📂 A new list{" "}
            <strong>{data.list?.name || "Untitled"}</strong> was shared with you!
          </span>
          <button
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            onClick={() => {
              selectList(data.list);
              toast.dismiss(t.id);
            }}
          >
            Go to List
          </button>
        </div>
      ));
      fetchLists();
    };

    socket.on("list:shared", handleShared);

    return () => {
      socket.off("list:shared", handleShared);
    };
  }, [token, socket, fetchLists]);

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

  // inside useLists.js
const deleteList = useCallback(
  async (listId) => {
    if (!listId) return;
    try {
      const res = await fetch(`${API_URL}/lists/${listId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete list");

      // update local state
      setLists((prev) => prev.filter((l) => l._id !== listId));

      // clear currentList if it was the one deleted
      if (currentList?._id === listId) {
        selectList(null);
      }

      toast.success("List deleted!");
    } catch (err) {
      console.error(err);
      toast.error("Could not delete list");
    }
  },
  [token, currentList]
);

//  Update list name
const updateListName = useCallback(
  async (listId, newName) => {
    if (!listId || !newName?.trim()) return;
    try {
      const res = await fetch(`${API_URL}/lists/${listId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error("Failed to update list name");
      const updated = await res.json();

      // update local state immediately
      setLists((prev) =>
        prev.map((l) => (l._id === listId ? updated : l))
      );

      // also update currentList if it’s the one edited
      if (currentList?._id === listId) {
        setCurrentList(updated);
        localStorage.setItem("currentList", JSON.stringify(updated));
      }

      toast.success("List renamed!");
    } catch (err) {
      console.error(err);
      toast.error("Could not rename list");
    }
  },
  [token, currentList]
);

  // Restore currentList from localStorage on startup
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

  return { lists, currentList, selectList, createList, updateListName, deleteList, loading, fetchLists };
}
