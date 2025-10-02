import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Fetch members of a list
export async function getListMembers(listId, token) {
  const res = await axios.get(`${API_URL}/lists/${listId}/members`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

// Share a list with a user
export async function shareList(listId, { userId, role }, token) {
  const res = await axios.post(
    `${API_URL}/lists/${listId}/share`,
    { userId, role },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}

// Add or update a member (alternative endpoint)
export async function addOrUpdateMember(listId, { userId, role }, token) {
  const res = await axios.post(
    `${API_URL}/lists/${listId}/members`,
    { userId, role },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}

//  Remove a member from a list
export async function removeMember(listId, userId, token) {
  const res = await axios.delete(`${API_URL}/lists/${listId}/members/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

// Delete a list (and cascade delete tasks + logs on backend)
export async function deleteList(listId, token) {
  const res = await axios.delete(`${API_URL}/lists/${listId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

// Update list name
export async function updateListName(listId, name, token) {
  const res = await axios.put(
    `${API_URL}/lists/${listId}`,
    { name },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}
