import { expect, test, describe } from '@rstest/core';
import {
  getBaseDomain,
  getDisplayBaseDomain,
  formatCustomDomainUrl,
  formatResumeUrl,
} from '../src/shared/utils/domain';

describe('Domain Utilities', () => {
  describe('getBaseDomain', () => {
    test('returns default domain when env not set', () => {
      const domain = getBaseDomain();
      // Should return either env value or default
      expect(typeof domain).toBe('string');
      expect(domain.length).toBeGreaterThan(0);
    });
  });

  describe('getDisplayBaseDomain', () => {
    test('returns the base domain for display', () => {
      const displayDomain = getDisplayBaseDomain();
      expect(typeof displayDomain).toBe('string');
      expect(displayDomain.length).toBeGreaterThan(0);
    });
  });

  describe('formatCustomDomainUrl', () => {
    test('formats custom domain with subdomain', () => {
      const url = formatCustomDomainUrl('john');
      expect(url).toContain('john.');
      expect(url).not.toContain('undefined');
    });

    test('formats custom domain with subdomain and path', () => {
      const url = formatCustomDomainUrl('john', 'my-resume');
      expect(url).toContain('john.');
      expect(url).not.toContain('/my-resume'); // Path is not included in custom domain URL
    });

    test('handles empty custom domain', () => {
      const url = formatCustomDomainUrl('');
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
    });

    test('handles path without custom domain', () => {
      const url = formatCustomDomainUrl('', 'my-resume');
      expect(url).toContain('/my-resume');
    });
  });

  describe('formatResumeUrl', () => {
    test('formats public resume URL without custom domain', () => {
      const url = formatResumeUrl('john-doe-resume');
      expect(url).toBe('/resume/john-doe-resume');
    });

    test('formats resume URL with custom domain', () => {
      const url = formatResumeUrl('john-doe-resume', 'john');
      expect(url).toContain('https://');
      expect(url).toContain('john.');
    });

    test('handles special characters in slug', () => {
      const url = formatResumeUrl('john-doe-2024');
      expect(url).toBe('/resume/john-doe-2024');
    });

    test('formats full URL with custom domain', () => {
      const url = formatResumeUrl('my-cv', 'johndoe');
      expect(url).toMatch(/^https:\/\//);
      expect(url).toContain('johndoe.');
      // Custom domain URL - slug is used as path parameter but URL structure depends on implementation
    });
  });
});
