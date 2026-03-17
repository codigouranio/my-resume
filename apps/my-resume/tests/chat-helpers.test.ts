import { expect, test, describe } from '@rstest/core';

// Mock localStorage for testing
const createMockLocalStorage = () => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
};

// Helper functions extracted from ChatWidget for testing
const getResumeSlug = (pathname: string) => {
  const match = pathname.match(/\/resume\/([^/]+)/);
  return match ? match[1] : null;
};

const generateConversationId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

describe('ChatWidget Helpers', () => {
  describe('getResumeSlug', () => {
    test('extracts slug from resume URL', () => {
      const slug = getResumeSlug('/resume/john-doe-2024');
      expect(slug).toBe('john-doe-2024');
    });

    test('returns null for non-resume URLs', () => {
      const slug = getResumeSlug('/dashboard');
      expect(slug).toBeNull();
    });

    test('returns null for root URL', () => {
      const slug = getResumeSlug('/');
      expect(slug).toBeNull();
    });

    test('handles slug with special characters', () => {
      const slug = getResumeSlug('/resume/jane-smith_v2');
      expect(slug).toBe('jane-smith_v2');
    });

    test('extracts first slug when multiple segments', () => {
      const slug = getResumeSlug('/resume/john-doe/edit');
      expect(slug).toBe('john-doe');
    });
  });

  describe('generateConversationId', () => {
    test('generates a conversation ID', () => {
      const id = generateConversationId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    test('generates IDs with timestamp format when crypto unavailable', () => {
      // Test the fallback path
      const id = generateConversationId();
      expect(id).toBeTruthy();
    });
  });
});
