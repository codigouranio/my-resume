import { expect, test, describe, beforeEach, vi } from '@rstest/core';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SearchPage } from '../src/features/search/SearchPage';

// Mock fetch
global.fetch = vi.fn();

const mockSearchResponse = {
  query: 'python developer',
  results: [
    {
      id: '1',
      slug: 'test-resume',
      title: 'Test Resume',
      content: 'Python developer with 5 years experience',
      userId: 'user1',
      user: {
        firstName: 'John',
        lastName: 'Doe',
      },
      similarity: 0.75,
      rank: 1,
    },
  ],
  total: 1,
  limit: 20,
  offset: 0,
  executionTime: 50,
};

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders search page with initial state', () => {
    render(
      <BrowserRouter>
        <SearchPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Resume Search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Python developer with AWS/)).toBeInTheDocument();
    expect(screen.getByText('Start Searching')).toBeInTheDocument();
  });

  test('shows validation error for short queries', async () => {
    render(
      <BrowserRouter>
        <SearchPage />
      </BrowserRouter>
    );

    const input = screen.getByPlaceholderText(/Python developer with AWS/);
    const searchButton = screen.getByRole('button', { name: /Search/ });

    fireEvent.change(input, { target: { value: 'py' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText(/Query must be at least 3 characters/)).toBeInTheDocument();
    });
  });

  test('performs search and displays results', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSearchResponse,
    });

    render(
      <BrowserRouter>
        <SearchPage />
      </BrowserRouter>
    );

    const input = screen.getByPlaceholderText(/Python developer with AWS/);
    const searchButton = screen.getByRole('button', { name: /Search/ });

    fireEvent.change(input, { target: { value: 'python developer' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('Test Resume')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('75.0%')).toBeInTheDocument();
      expect(screen.getByText('Excellent Match')).toBeInTheDocument();
    });
  });

  test('displays no results message when search returns empty', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockSearchResponse, results: [], total: 0 }),
    });

    render(
      <BrowserRouter>
        <SearchPage />
      </BrowserRouter>
    );

    const input = screen.getByPlaceholderText(/Python developer with AWS/);
    const searchButton = screen.getByRole('button', { name: /Search/ });

    fireEvent.change(input, { target: { value: 'nonexistent skill' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });

  test('displays error message on fetch failure', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(
      <BrowserRouter>
        <SearchPage />
      </BrowserRouter>
    );

    const input = screen.getByPlaceholderText(/Python developer with AWS/);
    const searchButton = screen.getByRole('button', { name: /Search/ });

    fireEvent.change(input, { target: { value: 'python' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  test('adjusts similarity threshold', () => {
    render(
      <BrowserRouter>
        <SearchPage />
      </BrowserRouter>
    );

    // Open advanced options
    const advancedToggle = screen.getByText('Advanced Options');
    fireEvent.click(advancedToggle);

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '0.6' } });

    expect(screen.getByText('Minimum Similarity: 60%')).toBeInTheDocument();
  });
});
