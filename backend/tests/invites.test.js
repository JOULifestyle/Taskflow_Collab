const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const User = require('../models/User');
const List = require('../models/List');
const { generateInviteToken } = require('../utils/inviteToken');

describe('Invites Routes', () => {
  let token;
  let userId;
  let listId;
  let inviteToken;

  beforeEach(async () => {
    jest.setTimeout(10000);
    // Create a test user
    const user = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    });
    userId = user._id;

    // Generate token
    token = jwt.sign({ id: userId }, process.env.JWT_SECRET || 'test-secret');

    // Create a test list
    const list = await List.create({
      name: 'Test List',
      owner: userId,
      members: [{ userId: userId, role: 'owner' }]
    });
    listId = list._id;

    // Generate an invite token
    inviteToken = generateInviteToken(listId, 'invitee@example.com', 'editor');
  }, 10000);

  describe('POST /invites/accept', () => {
    it('should accept a valid invitation', async () => {
      // Create the invited user
      const invitedUser = await User.create({
        username: 'invitee',
        email: 'invitee@example.com',
        password: 'password123'
      });

      const invitedToken = jwt.sign(
        { id: invitedUser._id },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(app)
        .post('/invites/accept')
        .set('Authorization', `Bearer ${invitedToken}`)
        .send({ token: inviteToken })
        .expect(200);

      expect(response.body.message).toContain('Successfully joined');

      // Verify user was added to list
      const updatedList = await List.findById(listId);
      expect(updatedList.members).toHaveLength(2);
      expect(updatedList.members.some(m =>
        m.userId.toString() === invitedUser._id.toString() && m.role === 'editor'
      )).toBe(true);
    });

    it('should reject invitation for wrong user', async () => {
      // Create a different user
      const wrongUser = await User.create({
        username: 'wronguser',
        email: 'wrong@example.com',
        password: 'password123'
      });

      const wrongToken = jwt.sign(
        { id: wrongUser._id },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(app)
        .post('/invites/accept')
        .set('Authorization', `Bearer ${wrongToken}`)
        .send({ token: inviteToken })
        .expect(403);

      expect(response.body.error).toContain('not for you');
    });

    it('should reject expired or invalid token', async () => {
      const response = await request(app)
        .post('/invites/accept')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'invalid-token' })
        .expect(400);

      expect(response.body.error).toContain('Invalid or expired token');
    });

    it('should not allow joining list twice', async () => {
      // Create the invited user and add them to the list first
      const invitedUser = await User.create({
        username: 'invitee',
        email: 'invitee@example.com',
        password: 'password123'
      });

      await List.findByIdAndUpdate(listId, {
        $push: { members: { userId: invitedUser._id, role: 'viewer' } }
      });

      const invitedToken = jwt.sign(
        { id: invitedUser._id },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(app)
        .post('/invites/accept')
        .set('Authorization', `Bearer ${invitedToken}`)
        .send({ token: inviteToken })
        .expect(400);

      expect(response.body.error).toContain('already a member');
    });
  });
});