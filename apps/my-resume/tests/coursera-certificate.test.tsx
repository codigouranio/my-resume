import { expect, test, describe } from '@rstest/core';
import { render, screen } from '@testing-library/react';

// Mock IntersectionObserver BEFORE importing the component
if (typeof global.IntersectionObserver === 'undefined') {
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    takeRecords() { return []; }
    unobserve() {}
  } as any;
}

import { CourseraCertificate } from '../src/features/badges/CourseraCertificate';

describe('CourseraCertificate Component', () => {
  test('renders certificate with title', () => {
    render(
      <CourseraCertificate
        title="Machine Learning Specialization"
        date="2024-01"
      />
    );

    expect(screen.getByText('Machine Learning Specialization')).toBeInTheDocument();
  });

  test('displays date when provided', () => {
    render(
      <CourseraCertificate
        title="Deep Learning"
        date="2024-03"
      />
    );

    expect(screen.getByText(/2024-03/)).toBeInTheDocument();
  });

  test('displays organization', () => {
    render(
      <CourseraCertificate
        title="Python for Data Science"
        organization="Stanford University"
      />
    );

    expect(screen.getByText(/Stanford University/)).toBeInTheDocument();
  });

  test('uses default organization when not provided', () => {
    render(
      <CourseraCertificate
        title="AI Specialization"
      />
    );

    // Check that Coursera appears at least once (might appear multiple times in the component)
    const courseraElements = screen.getAllByText(/Coursera/);
    expect(courseraElements.length).toBeGreaterThan(0);
  });

  test('renders with certificate ID', () => {
    const { container } = render(
      <CourseraCertificate
        certId="ABC123XYZ"
        title="AWS Cloud Practitioner"
      />
    );

    expect(container.firstChild).toBeInTheDocument();
  });

  test('renders with credential URL', () => {
    render(
      <CourseraCertificate
        title="Data Science"
        credentialUrl="https://coursera.org/verify/ABC123"
        credentialId="ABC123"
      />
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://coursera.org/verify/ABC123');
  });

  test('handles all props together', () => {
    render(
      <CourseraCertificate
        certId="CERT001"
        title="Full Stack Development"
        date="2024-02"
        organization="Meta"
        credentialId="CRED123"
        credentialUrl="https://example.com/verify/CRED123"
      />
    );

    expect(screen.getByText('Full Stack Development')).toBeInTheDocument();
    expect(screen.getByText(/Meta/)).toBeInTheDocument();
    expect(screen.getByText(/2024-02/)).toBeInTheDocument();
  });

  test('renders without optional props', () => {
    const { container } = render(
      <CourseraCertificate title="Basic Course" />
    );

    expect(container.firstChild).toBeInTheDocument();
    expect(screen.getByText('Basic Course')).toBeInTheDocument();
  });
});
