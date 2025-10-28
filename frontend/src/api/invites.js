import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export async function acceptInvite(token, authToken) {
  const res = await axios.post(
    `${API_URL}/invites/accept`,
    { token },
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  return res.data;
}