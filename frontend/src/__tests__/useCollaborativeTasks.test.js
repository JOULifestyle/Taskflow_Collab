import { renderHook, act } from '@testing-library/react';
import { useCollaborativeTasks } from '../hooks/useCollaborativeTasks';

//  Mock context hooks and toast
jest.mock('../context/AuthContext');
jest.mock('../context/SocketProvider');
jest.mock('react-hot-toast');

const mockUseAuth = require('../context/AuthContext').useAuth;
const mockUseSocket = require('../context/SocketProvider').useSocket;

describe('useCollaborativeTasks', () => {
  let mockSocket, mockSetTasks, mockUser;

  beforeAll(() => {
    const MockNotification = jest.fn().mockImplementation(function (title, options) {
      this.title = title;
      this.options = options;
      this.close = jest.fn();
    });

    Object.defineProperty(global, 'Notification', {
      writable: true,
      configurable: true,
      value: MockNotification,
    });

    global.Notification.permission = 'granted';
    global.Notification.requestPermission = jest.fn(() => Promise.resolve('granted'));
  });

  beforeEach(() => {
    jest.clearAllMocks();

    const listeners = {};
    mockSocket = {
      on: jest.fn((event, callback) => {
        listeners[event] = callback;
      }),
      off: jest.fn((event) => {
        delete listeners[event];
      }),
      emit: jest.fn((event, data) => {
        if (listeners[event]) listeners[event](data);
      }),
    };

    mockSetTasks = jest.fn();
    mockUser = { _id: 'user1' };

    mockUseAuth.mockReturnValue({ user: mockUser });
    mockUseSocket.mockReturnValue({ socket: mockSocket });

    document.hasFocus = jest.fn(() => false);
  });

  test('does nothing when no socket or user', () => {
    mockUseSocket.mockReturnValue({ socket: null });
    mockUseAuth.mockReturnValue({ user: null });
    renderHook(() => useCollaborativeTasks(mockSetTasks));
    expect(mockSocket.on).not.toHaveBeenCalled();
  });

  test('sets up socket event listeners', () => {
    renderHook(() => useCollaborativeTasks(mockSetTasks));
    expect(mockSocket.on).toHaveBeenCalledWith('task:created', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('task:updated', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('task:deleted', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('task:reminder', expect.any(Function));
  });

  test('handles task:created events', () => {
    renderHook(() => useCollaborativeTasks(mockSetTasks));
    const createdHandler = mockSocket.on.mock.calls.find(([e]) => e === 'task:created')[1];
    const newTask = { _id: 'new-task', text: 'New task' };
    const currentTasks = [{ _id: 'existing-task', text: 'Existing' }];

    mockSetTasks.mockImplementation((cb) => {
      const result = cb(currentTasks);
      expect(result).toEqual([...currentTasks, newTask]);
    });

    act(() => createdHandler(newTask));
  });

  test('replaces temp tasks on creation', () => {
    renderHook(() => useCollaborativeTasks(mockSetTasks));
    const createdHandler = mockSocket.on.mock.calls.find(([e]) => e === 'task:created')[1];

    const realTask = { _id: 'real-task', text: 'Real task' };
    const currentTasks = [
      { _id: 'temp-123', text: 'Real task' },
      { _id: 'existing-task', text: 'Existing' },
    ];

    mockSetTasks.mockImplementation((cb) => {
      const result = cb(currentTasks);
      expect(result).toEqual([realTask, { _id: 'existing-task', text: 'Existing' }]);
    });

    act(() => createdHandler(realTask));
  });

  test('handles task:updated events', () => {
    renderHook(() => useCollaborativeTasks(mockSetTasks));
    const updatedHandler = mockSocket.on.mock.calls.find(([e]) => e === 'task:updated')[1];
    const updatedTask = { _id: 'task1', text: 'Updated task' };
    const currentTasks = [
      { _id: 'task1', text: 'Old task' },
      { _id: 'task2', text: 'Other task' },
    ];

    mockSetTasks.mockImplementation((cb) => {
      const result = cb(currentTasks);
      expect(result).toEqual([updatedTask, { _id: 'task2', text: 'Other task' }]);
    });

    act(() => updatedHandler(updatedTask));
  });

  test('handles task:deleted events', () => {
    renderHook(() => useCollaborativeTasks(mockSetTasks));
    const deletedHandler = mockSocket.on.mock.calls.find(([e]) => e === 'task:deleted')[1];

    const currentTasks = [
      { _id: 'task1', text: 'Task to delete' },
      { _id: 'task2', text: 'Keep this' },
    ];

    mockSetTasks.mockImplementation((cb) => {
      const result = cb(currentTasks);
      expect(result).toEqual([{ _id: 'task2', text: 'Keep this' }]);
    });

    act(() => deletedHandler('task1'));
  });

  test('handles task:reminder events', () => {
    renderHook(() => useCollaborativeTasks(mockSetTasks));
    const reminderHandler = mockSocket.on.mock.calls.find(([e]) => e === 'task:reminder')[1];

    act(() => reminderHandler({ message: 'Task is due!', task: { _id: 'task1' }, stage: 'due' }));
    expect(global.Notification).toHaveBeenCalledWith('Task Reminder', expect.any(Object));
  });

  test('cleans up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useCollaborativeTasks(mockSetTasks));
    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('task:created');
    expect(mockSocket.off).toHaveBeenCalledWith('task:updated');
    expect(mockSocket.off).toHaveBeenCalledWith('task:deleted');
    expect(mockSocket.off).toHaveBeenCalledWith('task:reminder');
  });

  test('prevents duplicate task creation', () => {
    renderHook(() => useCollaborativeTasks(mockSetTasks));
    const createdHandler = mockSocket.on.mock.calls.find(([e]) => e === 'task:created')[1];

    const newTask = { _id: 'existing-task', text: 'Existing task' };
    const currentTasks = [{ _id: 'existing-task', text: 'Existing task' }];

    mockSetTasks.mockImplementation((cb) => {
      const result = cb(currentTasks);
      expect(result).toBe(currentTasks);
    });

    act(() => createdHandler(newTask));
  });
});
