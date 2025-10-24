const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const User = require('../models/User');
const List = require('../models/List');
const Task = require('../models/Task');

describe('Tasks Routes', () => {
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

  describe('POST /lists/:listId/tasks', () => {
    it('should create a new task', async () => {
      const taskData = {
        text: 'Test task',
        priority: 'high',
        category: 'Work'
      };

      const response = await request(app)
        .post(`/lists/${listId}/tasks`)
        .set('Authorization', `Bearer ${token}`)
        .send(taskData)
        .expect(200);

      expect(response.body.text).toBe('Test task');
      expect(response.body.priority).toBe('high');
      expect(response.body.category).toBe('Work');
      expect(response.body.completed).toBe(false);

      // Verify task was created in database
      const task = await Task.findById(response.body._id);
      expect(task).toBeTruthy();
      expect(task.listId.toString()).toBe(listId.toString());
    });

    it('should create task with due date', async () => {
      const dueDate = new Date('2025-12-31T23:59:59Z');
      const taskData = {
        text: 'Task with due date',
        due: dueDate.toISOString()
      };

      const response = await request(app)
        .post(`/lists/${listId}/tasks`)
        .set('Authorization', `Bearer ${token}`)
        .send(taskData)
        .expect(200);

      expect(new Date(response.body.due).toISOString()).toBe(dueDate.toISOString());
    });
  });

  describe('PUT /lists/:listId/tasks/:taskId', () => {
    let taskId;

    beforeEach(async () => {
      // Create a test task
      const task = await Task.create({
        text: 'Original task',
        listId: listId,
        userId: userId,
        completed: false,
        priority: 'medium',
        category: 'General'
      });
      taskId = task._id;
    });

    it('should update task completion status', async () => {
      const response = await request(app)
        .put(`/lists/${listId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ completed: true })
        .expect(200);

      expect(response.body.completed).toBe(true);

      // Verify in database
      const updatedTask = await Task.findById(taskId);
      expect(updatedTask.completed).toBe(true);
    });

    it('should update task text and priority', async () => {
      const updateData = {
        text: 'Updated task text',
        priority: 'high'
      };

      const response = await request(app)
        .put(`/lists/${listId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.text).toBe('Updated task text');
      expect(response.body.priority).toBe('high');
    });
  });

  describe('DELETE /lists/:listId/tasks/:taskId', () => {
    let taskId;

    beforeEach(async () => {
      // Create a test task
      const task = await Task.create({
        text: 'Task to delete',
        listId: listId,
        userId: userId,
        completed: false
      });
      taskId = task._id;
    });

    it('should delete a task', async () => {
      await request(app)
        .delete(`/lists/${listId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Verify task was deleted from database
      const deletedTask = await Task.findById(taskId);
      expect(deletedTask).toBeNull();
    });
  });
});