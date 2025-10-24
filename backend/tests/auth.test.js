const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server'); 
const User = require('../models/User');

describe('Auth Routes', () => {
  describe('POST /auth/signup', () => {
    it('should create a new user', async () => {
      jest.setTimeout(10000);
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(userData)
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('username', 'testuser');

      // Verify user was created in database
      const user = await User.findOne({ email: 'test@example.com' });
      expect(user).toBeTruthy();
      expect(user.username).toBe('testuser');
    });

    it('should not create user with duplicate email', async () => {
      jest.setTimeout(10000);
      // Create first user
      await User.create({
        username: 'user1',
        email: 'duplicate@example.com',
        password: 'password123'
      });

      // Try to create second user with same email
      const response = await request(app)
        .post('/auth/signup')
        .send({
          username: 'user2',
          email: 'duplicate@example.com',
          password: 'password123'
        })
        .expect(400);

      expect(response.body.error).toContain('already exists');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      jest.setTimeout(10000);
      // Create a test user
      await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });
    }, 10000);

    it('should login with username', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('username', 'testuser');
    });

    it('should login with email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('username', 'testuser');
    });

    it('should not login with wrong password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid credentials');
    });
  });
});