const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const User = require('../models/User');
const List = require('../models/List');

describe('Lists Routes', () => {
  let token;
  let userId;
  let listId;

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
  }, 10000);

  describe('POST /lists/:listId/share', () => {
    it('should share list with existing user by userId', async () => {
      // Create another user
      const otherUser = await User.create({
        username: 'otheruser',
        email: 'other@example.com',
        password: 'password123'
      });

      const response = await request(app)
        .post(`/lists/${listId}/share`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: otherUser._id,
          role: 'editor'
        })
        .expect(200);

      expect(response.body.members).toHaveLength(2);
      expect(response.body.members.some(m => m.userId.toString() === otherUser._id.toString())).toBe(true);
    });

    it('should send invitation to non-existing user by email', async () => {
      const response = await request(app)
        .post(`/lists/${listId}/share`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'newuser@example.com',
          role: 'viewer'
        })
        .expect(200);

      expect(response.body.message).toContain('Invitation sent successfully');
      expect(response.body.invited).toBe(true);
    });

    it('should not share with owner', async () => {
      const response = await request(app)
        .post(`/lists/${listId}/share`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: userId,
          role: 'editor'
        })
        .expect(400);

      expect(response.body.error).toContain('Owner cannot be re-assigned');
    });
  });

  describe('GET /lists/:listId/members', () => {
    it('should get list members', async () => {
      const response = await request(app)
        .get(`/lists/${listId}/members`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].role).toBe('owner');
    });
  });
});