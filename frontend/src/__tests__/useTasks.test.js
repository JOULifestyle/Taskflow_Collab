import { renderHook, act, waitFor } from '@testing-library/react';
import { useTasks } from '../hooks/useTasks';

// Mock dependencies
jest.mock('../context/AuthContext');
jest.mock('../context/SocketProvider');
jest.mock('react-hot-toast', () => {
  const mockToast = {
    success: jest.fn(),
    error: jest.fn()
  };
  return {
    toast: mockToast,
    default: mockToast,
    __esModule: true
  };
});

const mockUseAuth = require('../context/AuthContext').useAuth;
const mockUseSocket = require('../context/SocketProvider').useSocket;

describe('useTasks', () => {
  let mockSocket;
  let mockUser;
  let mockFetch;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
    });

    // Setup mocks
    mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    };

    mockUser = {
      _id: 'user1',
      token: 'token123'
    };

    mockUseAuth.mockReturnValue({ user: mockUser });
    mockUseSocket.mockReturnValue({ socket: mockSocket });

    // Mock fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  test('initializes with empty tasks when no listId', () => {
    const { result } = renderHook(() => useTasks(null));

    expect(result.current.tasks).toEqual([]);
    expect(result.current.loading).toBe(true); // Initially loading
  });

  test('loads tasks from localStorage on mount', async () => {
    const mockTasks = [{ _id: 'task1', text: 'Test task' }];
    localStorage.getItem.mockReturnValue(JSON.stringify(mockTasks));

    const { result } = renderHook(() => useTasks('list1'));

    await waitFor(() => {
      expect(result.current.tasks).toEqual([
        { _id: 'task1', text: 'Test task', repeat: null, category: 'General', priority: 'normal' }
      ]);
    });

    expect(localStorage.getItem).toHaveBeenCalledWith('tasks-list1');
  });

  test('fetches tasks from API when listId and token exist', async () => {
    const mockApiTasks = [{ _id: 'task1', text: 'API task' }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockApiTasks)
    });

    const { result } = renderHook(() => useTasks('list1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/lists/list1/tasks',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token123' }
      })
    );
  });

  test('merges API tasks with local tasks', async () => {
    const localTasks = [{ _id: 'temp-123', text: 'Local task' }];
    const apiTasks = [{ _id: 'task1', text: 'API task' }];

    localStorage.getItem.mockReturnValue(JSON.stringify(localTasks));
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(apiTasks)
    });

    const { result } = renderHook(() => useTasks('list1'));

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(2);
    });
  });

  test('adds a new task', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ _id: 'new-task', text: 'New task' })
    });

    const { result } = renderHook(() => useTasks('list1'));

    await act(async () => {
      await result.current.addTask('New task', null, 'medium', 'General');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/lists/list1/tasks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          text: 'New task',
          due: null,
          priority: 'medium',
          category: 'General',
          repeat: null
        })
      })
    );
  });

  test('toggles task completion', async () => {
    const mockTask = { _id: 'task1', text: 'Test', completed: false };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...mockTask, completed: true })
    });

    const { result } = renderHook(() => useTasks('list1'));

    // Set initial tasks
    act(() => {
      result.current.setTasks([mockTask]);
    });

    await act(async () => {
      await result.current.toggleTask('task1');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/lists/list1/tasks/task1',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"completed":true')
      })
    );
  });

  test('deletes a task', async () => {
    const mockTask = { _id: 'task1', text: 'Test' };
    mockFetch.mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useTasks('list1'));

    act(() => {
      result.current.setTasks([mockTask]);
    });

    await act(async () => {
      await result.current.deleteTask('task1');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/lists/list1/tasks/task1',
      expect.objectContaining({ method: 'DELETE' })
    );

    expect(result.current.tasks).toEqual([]);
  });

  test('saves task edits', async () => {
    const mockTask = { _id: 'task1', text: 'Old text' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...mockTask, text: 'New text' })
    });

    const { result } = renderHook(() => useTasks('list1'));

    act(() => {
      result.current.setTasks([mockTask]);
    });

    await act(async () => {
      await result.current.saveEdit('task1', { text: 'New text' });
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/lists/list1/tasks/task1',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"text":"New text"')
      })
    );
  });

  test('handles offline operations', async () => {
    // Simulate offline
    Object.defineProperty(navigator, 'onLine', { value: false });

    const { result } = renderHook(() => useTasks('list1'));

    await act(async () => {
      await result.current.addTask('Offline task', null, 'medium', 'General');
    });

    // Should add to queue instead of making API call
    expect(result.current.queue).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1); // Initial fetch still happens
  });

  test('listens for socket task updates', () => {
    const mockUpdatedTask = { _id: 'task1', text: 'Updated task' };

    renderHook(() => useTasks('list1'));

    // Simulate socket event
    const updateHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'task:updated'
    )[1];

    act(() => {
      updateHandler(mockUpdatedTask);
    });

    // The hook should have set up the listener
    expect(mockSocket.on).toHaveBeenCalledWith('task:updated', expect.any(Function));
  });

  test('auto-refreshes tasks every 30 seconds', async () => {
    jest.useFakeTimers();

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    });

    renderHook(() => useTasks('list1'));

    // Fast-forward 30 seconds
    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + refresh
    });

    jest.useRealTimers();
  });

  test('normalizes task data', () => {
    const rawTasks = [
      { _id: '1', text: 'Task 1' }, // Missing fields
      { _id: '2', text: 'Task 2', repeat: 'daily', category: 'Work', priority: 'high' } // Complete
    ];

    const { result } = renderHook(() => useTasks('list1'));

    act(() => {
      result.current.setTasks(rawTasks);
    });

    expect(result.current.tasks[0]).toMatchObject({
      _id: '1',
      text: 'Task 1'
    });
  });
});