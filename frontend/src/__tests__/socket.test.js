import { createSocket, getSocket, disconnectSocket, joinList, leaveList, onMemberEvents, offMemberEvents } from '../socket';

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

const mockIO = require('socket.io-client');

describe('Socket utilities', () => {
  let mockSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = {
      id: 'mock-socket-id',
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      connected: true,
    };
    mockIO.io.mockReturnValue(mockSocket);
  });

  afterEach(() => {
    // Reset the module-level socket variable
    jest.resetModules();
  });

  describe('createSocket', () => {
    test('returns existing socket if already created', () => {
      const token1 = 'token1';
      const token2 = 'token2';

      const socket1 = createSocket(token1);
      const socket2 = createSocket(token2);

      expect(socket1).toBe(socket2); // Should return the same socket
    });
  });

  describe('getSocket', () => {
    test('returns the current socket instance', () => {
      const socket = createSocket('token');
      const retrievedSocket = getSocket();

      expect(retrievedSocket).toBe(socket);
    });

    test('returns null when no socket exists', () => {
      // Reset the module to clear socket
      jest.resetModules();
      const { getSocket } = require('../socket');
      const retrievedSocket = getSocket();
      expect(retrievedSocket).toBe(null);
    });

    test('returns null when socket is undefined', () => {
      // Reset the module to clear socket
      jest.resetModules();
      const { getSocket } = require('../socket');
      const retrievedSocket = getSocket();
      expect(retrievedSocket).toBe(null);
    });
  });

  describe('disconnectSocket', () => {
    test('handles disconnecting when no socket exists', () => {
      expect(() => disconnectSocket()).not.toThrow();
    });
  });

  describe('joinList', () => {
    test('emits join-list event with listId', () => {
      createSocket('token');
      const listId = 'list123';

      joinList(listId);

      expect(mockSocket.emit).toHaveBeenCalledWith('join-list', listId);
    });

    test('does nothing when no socket exists', () => {
      joinList('list123');

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    test('does nothing when listId is falsy', () => {
      createSocket('token');

      joinList(null);
      joinList('');
      joinList(undefined);

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('leaveList', () => {
    test('does nothing when no socket exists', () => {
      leaveList('list123');

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    test('does nothing when listId is falsy', () => {
      createSocket('token');

      leaveList(null);
      leaveList('');
      leaveList(undefined);

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('onMemberEvents', () => {
    test('does nothing when no socket exists', () => {
      const onShared = jest.fn();
      onMemberEvents({ onShared });

      expect(mockSocket.on).not.toHaveBeenCalled();
    });
  });

  describe('offMemberEvents', () => {
    test('does nothing when no socket exists', () => {
      offMemberEvents();

      expect(mockSocket.off).not.toHaveBeenCalled();
    });
  });

});