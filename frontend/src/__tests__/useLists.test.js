import { renderHook, act, waitFor } from '@testing-library/react';
import { useLists } from '../hooks/useLists';

// Mock dependencies
jest.mock('../context/AuthContext');
jest.mock('../context/SocketProvider');

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const toastMock = require('react-hot-toast');
toastMock.default.success = jest.fn();
toastMock.default.error = jest.fn();

const mockUseAuth = require('../context/AuthContext').useAuth;
const mockUseSocket = require('../context/SocketProvider').useSocket;

// Do not mock the hook itself since we're testing it

describe('useLists', () => {
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
      },
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

  test('initializes with empty lists and no current list', () => {
    const { result } = renderHook(() => useLists());

    expect(result.current.lists).toEqual([]);
    expect(result.current.currentList).toBe(null);
    // Loading starts as false but may change due to useEffect
    expect(typeof result.current.loading).toBe('boolean');
  });

  test('fetches lists on mount when user has token', async () => {
    const mockLists = [
      { _id: 'list1', name: 'List 1' },
      { _id: 'list2', name: 'List 2' }
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockLists)
    });

    const { result } = renderHook(() => useLists());

    await waitFor(() => {
      expect(result.current.lists).toEqual(mockLists);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/lists',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token123' }
      })
    );
  });

  test('does not fetch lists when no token', () => {
    mockUseAuth.mockReturnValue({ user: null });

    renderHook(() => useLists());

    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('creates a new list', async () => {
    const newList = { _id: 'new-list', name: 'New List' };

    // Mock initial fetch on mount
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([])
    });

    // Mock create list API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(newList)
    });

    const { result } = renderHook(() => useLists());

    await act(async () => {
      await result.current.createList('New List');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/lists',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'New List' })
      })
    );

    expect(result.current.lists).toEqual([newList]);
    expect(result.current.currentList).toEqual(newList);
  });

  test('selects a list and saves to localStorage', () => {
    const { result } = renderHook(() => useLists());

    const testList = { _id: 'list1', name: 'Test List' };

    act(() => {
      result.current.selectList(testList);
    });

    expect(result.current.currentList).toEqual(testList);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'currentList',
      JSON.stringify(testList)
    );
  });

  test('clears current list', () => {
    const { result } = renderHook(() => useLists());

    // Set a list first
    act(() => {
      result.current.selectList({ _id: 'list1', name: 'Test' });
    });

    // Clear it
    act(() => {
      result.current.selectList(null);
    });

    expect(result.current.currentList).toBe(null);
    expect(localStorage.removeItem).toHaveBeenCalledWith('currentList');
  });

  test('deletes a list', async () => {
    const mockLists = [{ _id: 'list1', name: 'List 1' }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockLists)
    });

    const { result } = renderHook(() => useLists());

    // Set up initial lists
    await waitFor(() => {
      expect(result.current.lists).toEqual(mockLists);
    });

    // Set current list
    act(() => {
      result.current.selectList(mockLists[0]);
    });

    // Mock delete API call
    mockFetch.mockResolvedValueOnce({ ok: true });

    await act(async () => {
      await result.current.deleteList('list1');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/lists/list1',
      expect.objectContaining({ method: 'DELETE' })
    );

    expect(result.current.lists).toEqual([]);
    expect(result.current.currentList).toBe(null);
  });

  test('updates list name', async () => {
    const mockLists = [{ _id: 'list1', name: 'Old Name' }];
    const updatedList = { _id: 'list1', name: 'New Name' };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockLists)
    });

    const { result } = renderHook(() => useLists());

    await waitFor(() => {
      expect(result.current.lists).toEqual(mockLists);
    });

    // Set current list
    act(() => {
      result.current.selectList(mockLists[0]);
    });

    // Mock update API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(updatedList)
    });

    await act(async () => {
      await result.current.updateListName('list1', 'New Name');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/lists/list1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'New Name' })
      })
    );

    expect(result.current.lists[0]).toEqual(updatedList);
    expect(result.current.currentList).toEqual(updatedList);
  });

  test('loads currentList from localStorage on mount', () => {
    const savedList = { _id: 'saved-list', name: 'Saved List' };
    localStorage.getItem.mockReturnValue(JSON.stringify(savedList));

    const { result } = renderHook(() => useLists());

    expect(result.current.currentList).toEqual(savedList);
  });

  test('handles invalid localStorage data gracefully', () => {
    localStorage.getItem.mockReturnValue('invalid json');

    const { result } = renderHook(() => useLists());

    expect(result.current.currentList).toBe(null);
    expect(localStorage.removeItem).toHaveBeenCalledWith('currentList');
  });

  test('listens for list:shared socket events', () => {
    const sharedList = { _id: 'shared-list', name: 'Shared List' };
    const mockToast = jest.fn();

    // Mock toast
    const toastMock = require('react-hot-toast');
    toastMock.default = mockToast;

    renderHook(() => useLists());

    // Find the socket listener
    const sharedHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'list:shared'
    )[1];

    act(() => {
      sharedHandler({ list: sharedList });
    });

    expect(mockToast).toHaveBeenCalled();
  });

  test('resets currentList if it no longer exists in fetched lists', async () => {
    const initialLists = [{ _id: 'list1', name: 'List 1' }];
    const updatedLists = [{ _id: 'list2', name: 'List 2' }];

    // Initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(initialLists)
    });

    const { result } = renderHook(() => useLists());

    // Set current list
    act(() => {
      result.current.selectList(initialLists[0]);
    });

    expect(result.current.currentList).toEqual(initialLists[0]);

    // Second fetch with different lists
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(updatedLists)
    });

    // Trigger re-fetch
    act(() => {
      result.current.fetchLists();
    });

    await waitFor(() => {
      expect(result.current.currentList).toBe(null);
    });
  });

  test('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useLists());

    // Should not crash, should remain with empty lists
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.lists).toEqual([]);
  });
});