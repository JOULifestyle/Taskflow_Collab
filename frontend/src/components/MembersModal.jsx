
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { onMemberEvents, offMemberEvents } from "../socket";
import {
  getListMembers,
  shareList,
  addOrUpdateMember,
  removeMember as apiRemoveMember,
} from "../api/lists";

export default function MembersModal({ list, token, onClose, currentUser }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inviteUser, setInviteUser] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");

  useEffect(() => {
  console.log("🔎 CurrentUser:", currentUser);
  console.log("🔎 Members:", members);
}, [currentUser, members]);

  // Fetch members
  useEffect(() => {
    if (!list?._id) return;
    setLoading(true);
    getListMembers(list._id, token)
      .then(setMembers)
      .catch(() => toast.error("Failed to load members"))
      .finally(() => setLoading(false));
  }, [list, token]);

  // ---  Listen to socket events ---
  useEffect(() => {
    if (!list?._id) return;

    onMemberEvents({
      onShared: ({ userId, role }) => {
        setMembers((prev) => {
          const existing = prev.find((m) => m.userId === userId);
          if (existing) {
            return prev.map((m) =>
              m.userId === userId ? { ...m, role } : m
            );
          }
          return [...prev, { userId, role }];
        });
        toast.success(`Member ${userId} set to ${role}`);
      },
      onRemoved: ({ userId }) => {
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
        toast(`Member ${userId} removed`, { icon: "🗑️" });
      },
    });

    return () => {
      offMemberEvents();
    };
  }, [list?._id]);

  // Invite new member
  const invite = async () => {
    if (!inviteUser) return;
    try {
      const updatedList = await shareList(
        list._id,
        { userId: inviteUser, role: inviteRole },
        token
      );
      setMembers(updatedList.members);
      toast.success("Member invited!");
      setInviteUser("");
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  // Change member role
  const changeRole = async (userId, role) => {
    try {
      const updatedList = await addOrUpdateMember(
        list._id,
        { userId, role },
        token
      );
      setMembers(updatedList.members);
      toast.success("Role updated!");
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  // Remove member
  const remove = async (userId) => {
    try {
      await apiRemoveMember(list._id, userId, token);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      toast.success("Member removed!");
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const isOwner = members.find(
    (m) => String(m.userId) === String(currentUser?._id) && m.role === "owner"
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-96 shadow-lg">
        <h2 className="text-lg font-bold mb-4">Manage Members</h2>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <ul className="space-y-3 mb-4">
            {members.map((m) => (
              <li
                key={m.userId}
                className="flex justify-between items-center border-b py-2"
              >
                <span> {m.userId === currentUser._id ? "You" : m.userId}</span>
                <div className="flex items-center gap-2">
                  {isOwner && m.role !== "owner" ? (
                    <>
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.userId, e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                      </select>
                      <button
                        onClick={() => remove(m.userId)}
                        className="text-red-500 hover:underline text-sm"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <span className="text-sm text-gray-600">{m.role}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {isOwner && (
          <div className="mb-4">
            <div className="flex gap-2 mb-2">
              <input
                value={inviteUser}
                onChange={(e) => setInviteUser(e.target.value)}
                placeholder="User ID"
                className="flex-1 border rounded px-2 py-1"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="border rounded px-2 py-1"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
            </div>
            <button
              onClick={invite}
              className="bg-blue-600 text-white px-4 py-2 rounded w-full hover:bg-blue-700"
            >
              Invite
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-3 text-sm text-gray-500 hover:underline w-full"
        >
          Close
        </button>
      </div>
    </div>
  );
}
