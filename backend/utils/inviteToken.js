const jwt = require('jsonwebtoken');

function generateInviteToken(listId, email, role) {
  return jwt.sign(
    { listId, email, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyInviteToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = { generateInviteToken, verifyInviteToken };