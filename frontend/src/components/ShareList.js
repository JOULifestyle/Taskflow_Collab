
import React, { useState } from "react";
import { shareList } from "../api/lists";
import { getSocket } from "../socket";

export default function ShareList({ listId, token, onShared }) {
  const [input, setInput] = useState("");
  const [inputType, setInputType] = useState("email"); 
  const [role, setRole] = useState("viewer");
  const [message, setMessage] = useState("");

  const handleShare = async (e) => {
    e.preventDefault();
    if (!input.trim()) {
      setMessage("❌ Please enter an email address or user ID");
      return;
    }

    try {
      const shareData = inputType === "email"
        ? { email: input.trim(), role }
        : { userId: input.trim(), role };

      const response = await shareList(listId, shareData, token);

      if (response.invited) {
        setMessage("✅ Invitation sent successfully");
      } else {
        setMessage("✅ List shared successfully");
        if (onShared) onShared(response);

        
        const socket = getSocket();
        socket.emit("join-list", listId);
      }

      setInput("");
    } catch (err) {
      setMessage("❌ Error sharing list: " + err.response?.data?.error);
    }
  };

  return (
    <form onSubmit={handleShare} className="p-4 space-y-3 bg-gray-100 rounded-xl">
      <div className="flex space-x-2">
        <select
          value={inputType}
          onChange={(e) => setInputType(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="email">Email</option>
          <option value="userId">User ID</option>
        </select>
        <input
          type={inputType === "email" ? "email" : "text"}
          placeholder={inputType === "email" ? "Enter email address" : "Enter userId"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="border p-2 flex-1 rounded"
        />
      </div>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="border p-2 w-full rounded"
      >
        <option value="viewer">Viewer</option>
        <option value="editor">Editor</option>
      </select>
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
        {inputType === "email" ? "Invite" : "Share"}
      </button>
      {message && <p>{message}</p>}
    </form>
  );
}
