
import React, { useState } from "react";
import { shareList } from "../api/lists";
import { getSocket } from "../socket";

export default function ShareList({ listId, token, onShared }) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("viewer");
  const [message, setMessage] = useState("");

  const handleShare = async (e) => {
    e.preventDefault();
    try {
      const updatedList = await shareList(listId, { userId, role }, token);
      setMessage("✅ List shared successfully");
      if (onShared) onShared(updatedList);

      // also join socket room so they receive updates
      const socket = getSocket();
      socket.emit("join-list", listId);

    } catch (err) {
      setMessage("❌ Error sharing list: " + err.response?.data?.error);
    }
  };

  return (
    <form onSubmit={handleShare} className="p-4 space-y-3 bg-gray-100 rounded-xl">
      <input
        type="text"
        placeholder="Enter userId"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="border p-2 w-full rounded"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="border p-2 w-full rounded"
      >
        <option value="viewer">Viewer</option>
        <option value="editor">Editor</option>
      </select>
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
        Share
      </button>
      {message && <p>{message}</p>}
    </form>
  );
}
