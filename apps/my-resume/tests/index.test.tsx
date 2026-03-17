import { expect, test } from '@rstest/core';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

test('renders the main page', () => {
  render(<App />);
  // Check for specific heading text
  expect(screen.getByText('Why Choose ResumeCast.ai?')).toBeInTheDocument();
});
