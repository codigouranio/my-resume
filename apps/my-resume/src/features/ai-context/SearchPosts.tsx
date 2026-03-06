import { useState, useEffect, useRef } from 'react';
import { Input } from "@shared/components/input";
import { Button } from "@shared/components/button";

interface SearchPostsProps {
  onSearch: (query: string) => void;
}

export function SearchPosts({ onSearch }: SearchPostsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Debounce search with 1 second delay
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      onSearch(searchQuery);
    }, 1000);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery, onSearch]);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleClear = () => {
    setSearchQuery('');
  };

  return (
    <div className="search-posts mb-6">
      <div className="relative">
        <input
          type="text"
          placeholder="🔍 Search your journal entries..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="input input-bordered w-full pr-10"
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 btn btn-ghost btn-xs"
            title="Clear search"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
