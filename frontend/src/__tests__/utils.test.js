import { formatDueDate, formatDateForInput, urlBase64ToUint8Array } from '../utils';

// Mock Intl.DateTimeFormat for consistent testing
const mockDateTimeFormat = jest.fn();
mockDateTimeFormat.mockReturnValue('12/25/2023, 11:30 AM');

global.Intl = {
  DateTimeFormat: jest.fn(() => ({
    format: mockDateTimeFormat
  }))
};

describe('Utility functions', () => {
  describe('formatDueDate', () => {
    test('formats valid ISO date string', () => {
      const isoString = '2023-12-25T10:30:00.000Z';
      const result = formatDueDate(isoString);

      expect(result).toBe('12/25/2023, 11:30 AM');
    });

    test('returns empty string for null/undefined', () => {
      expect(formatDueDate(null)).toBe('');
      expect(formatDueDate(undefined)).toBe('');
    });

    test('returns empty string for empty string', () => {
      expect(formatDueDate('')).toBe('');
    });
  });

  describe('formatDateForInput', () => {
    test('converts ISO string to datetime-local format', () => {
      const isoString = '2023-12-25T10:30:00.000Z';
      const mockDate = new Date(isoString);

      // Mock getTimezoneOffset to return 0 for consistent testing
      mockDate.getTimezoneOffset = jest.fn(() => 0);

      // Mock Date constructor and methods
      const originalDate = global.Date;
      global.Date = jest.fn(() => mockDate);
      global.Date.prototype = originalDate.prototype;
      global.Date.now = originalDate.now;

      const result = formatDateForInput(isoString);

      expect(result).toBe('2023-12-25T10:30');
    });

    test('returns empty string for null/undefined', () => {
      expect(formatDateForInput(null)).toBe('');
      expect(formatDateForInput(undefined)).toBe('');
    });

    test('returns empty string for empty string', () => {
      expect(formatDateForInput('')).toBe('');
    });
  });

  describe('urlBase64ToUint8Array', () => {
    test('converts base64 string to Uint8Array', () => {
      // Test with a simple base64 string
      const base64 = 'SGVsbG8gV29ybGQ'; // "Hello World" in base64
      const result = urlBase64ToUint8Array(base64);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);

      // Convert back to string to verify
      const decoded = String.fromCharCode(...result);
      expect(decoded).toBe('Hello World');
    });

    test('handles base64url format (with - and _)', () => {
      // Test with base64url characters
      const base64url = 'SGVs-bG8_V29ybGQ'; // Modified "Hello World"
      const result = urlBase64ToUint8Array(base64url);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    test('handles padding', () => {
      // Test with padding
      const base64 = 'SGVsbG8gV29ybGQ='; // "Hello World" with padding
      const result = urlBase64ToUint8Array(base64);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    test('handles empty string', () => {
      const result = urlBase64ToUint8Array('');
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(0);
    });
  });

});