import { renderHook, act, waitFor } from '@testing-library/react';
import { SocketProvider, useSocket } from '../context/SocketProvider';

// Mock dependencies
jest.mock('../context/AuthContext');
jest.mock('../socket');

const mockUseAuth = require('../context/AuthContext').useAuth;
const mockSocketModule = require('../socket');

describe('SocketProvider', () => {
  let mockUser;
  let mockSocket;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUser = {
      _id: 'user1',
      token: 'token123'
    };

    mockSocket = {
      id: 'socket123',
      on: jest.fn(),
      off: jest.fn(),
      disconnect: jest.fn(),
      emit: jest.fn(),
    };

    mockUseAuth.mockReturnValue({ user: mockUser });
    mockSocketModule.createSocket.mockReturnValue(mockSocket);
    mockSocketModule.disconnectSocket.mockImplementation(() => {});
    mockSocketModule.getSocket.mockReturnValue(mockSocket);
  });

  test('provides socket context to children', () => {
    const wrapper = ({ children }) => (
      <SocketProvider>{children}</SocketProvider>
    );

    const { result } = renderHook(() => useSocket(), { wrapper });

    expect(result.current).toHaveProperty('socket');
    expect(result.current).toHaveProperty('getSocket');
  });

  test('creates socket when user has token', () => {
    renderHook(() => useSocket(), {
      wrapper: ({ children }) => <SocketProvider>{children}</SocketProvider>
    });

    expect(mockSocketModule.createSocket).toHaveBeenCalledWith(mockUser.token);
  });

  test('does not create socket when user has no token', () => {
    mockUseAuth.mockReturnValue({ user: null });

    renderHook(() => useSocket(), {
      wrapper: ({ children }) => <SocketProvider>{children}</SocketProvider>
    });

    expect(mockSocketModule.createSocket).not.toHaveBeenCalled();
  });

  test('disconnects socket when user token is removed', () => {
    const { rerender } = renderHook(() => useSocket(), {
      wrapper: ({ children }) => <SocketProvider>{children}</SocketProvider>
    });

    // Initially connected
    expect(mockSocketModule.createSocket).toHaveBeenCalled();

    // Change user to have no token
    mockUseAuth.mockReturnValue({ user: null });

    rerender();

    expect(mockSocketModule.disconnectSocket).toHaveBeenCalled();
  });

  test('sets socket state when connect event fires', async () => {
    let connectCallback;

    mockSocket.on.mockImplementation((event, callback) => {
      if (event === 'connect') {
        connectCallback = callback;
      }
    });

    const { result } = renderHook(() => useSocket(), {
      wrapper: ({ children }) => <SocketProvider>{children}</SocketProvider>
    });

    // Initially socket should be null
    expect(result.current.socket).toBe(null);

    // Simulate connect event
    act(() => {
      connectCallback();
    });

    await waitFor(() => {
      expect(result.current.socket).toBe(mockSocket);
    });
  });

  test('handles connect_error events', () => {
    let errorCallback;

    mockSocket.on.mockImplementation((event, callback) => {
      if (event === 'connect_error') {
        errorCallback = callback;
      }
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    renderHook(() => useSocket(), {
      wrapper: ({ children }) => <SocketProvider>{children}</SocketProvider>
    });

    // Simulate connect_error event
    act(() => {
      errorCallback({ message: 'Connection failed' });
    });

    expect(consoleSpy).toHaveBeenCalledWith('❌ Socket connection error:', 'Connection failed');

    consoleSpy.mockRestore();
  });

  test('disconnects socket on unmount', () => {
    const { unmount } = renderHook(() => useSocket(), {
      wrapper: ({ children }) => <SocketProvider>{children}</SocketProvider>
    });

    unmount();

    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  test('recreates socket when token changes', () => {
    const { rerender } = renderHook(() => useSocket(), {
      wrapper: ({ children }) => <SocketProvider>{children}</SocketProvider>
    });

    // First render with token123
    expect(mockSocketModule.createSocket).toHaveBeenCalledWith('token123');

    // Change token
    mockUser.token = 'new-token';
    mockUseAuth.mockReturnValue({ user: mockUser });

    rerender();

    expect(mockSocketModule.createSocket).toHaveBeenCalledWith('new-token');
  });

  test('getSocket returns the socket instance', () => {
    const { result } = renderHook(() => useSocket(), {
      wrapper: ({ children }) => <SocketProvider>{children}</SocketProvider>
    });

    expect(result.current.getSocket()).toBe(mockSocket);
  });

  test('handles socket creation failure gracefully', () => {
    mockSocketModule.createSocket.mockReturnValue(null);

    const { result } = renderHook(() => useSocket(), {
      wrapper: ({ children }) => <SocketProvider>{children}</SocketProvider>
    });

    expect(result.current.socket).toBe(null);
    expect(mockSocketModule.createSocket).toHaveBeenCalledWith(mockUser.token);
  });

  test('cleans up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useSocket(), {
      wrapper: ({ children }) => <SocketProvider>{children}</SocketProvider>
    });

    unmount();

    // Should disconnect the socket
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  test('logs connection success', () => {
    let connectCallback;
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    mockSocket.on.mockImplementation((event, callback) => {
      if (event === 'connect') {
        connectCallback = callback;
      }
    });

    renderHook(() => useSocket(), {
      wrapper: ({ children }) => <SocketProvider>{children}</SocketProvider>
    });

    act(() => {
      connectCallback();
    });

    expect(consoleSpy).toHaveBeenCalledWith('✅ Socket connected:', mockSocket.id);

    consoleSpy.mockRestore();
  });

  test('handles multiple socket creation calls', () => {
    // First render
    const { rerender } = renderHook(() => useSocket(), {
      wrapper: ({ children }) => <SocketProvider>{children}</SocketProvider>
    });

    expect(mockSocketModule.createSocket).toHaveBeenCalledTimes(1);

    // Second render with same token - should not create new socket
    rerender();

    expect(mockSocketModule.createSocket).toHaveBeenCalledTimes(1);
  });

  test('disconnects old socket before creating new one', () => {
    const oldSocket = { ...mockSocket, disconnect: jest.fn() };
    mockSocketModule.createSocket.mockReturnValueOnce(oldSocket);

    const { rerender } = renderHook(() => useSocket(), {
      wrapper: ({ children }) => <SocketProvider>{children}</SocketProvider>
    });

    // Change token to trigger new socket creation
    mockUser.token = 'new-token';
    mockUseAuth.mockReturnValue({ user: mockUser });

    rerender();

    expect(oldSocket.disconnect).toHaveBeenCalled();
  });
});