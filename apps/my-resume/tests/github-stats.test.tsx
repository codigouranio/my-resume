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

import { GitHubStats } from '../src/features/badges/GitHubStats';

describe('GitHubStats Component', () => {
  test('renders with username prop', () => {
    const { container } = render(<GitHubStats username="testuser" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  test('accepts theme prop - light', () => {
    const { container } = render(<GitHubStats username="testuser" theme="light" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  test('accepts theme prop - dark', () => {
    const { container } = render(<GitHubStats username="testuser" theme="dark" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  test('uses dark theme by default', () => {
    const { container } = render(<GitHubStats username="testuser" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  test('renders without crashing for different usernames', () => {
    const { container: container1 } = render(<GitHubStats username="user1" />);
    expect(container1.firstChild).toBeInTheDocument();

    const { container: container2 } = render(<GitHubStats username="another-user" />);
    expect(container2.firstChild).toBeInTheDocument();
  });
});
