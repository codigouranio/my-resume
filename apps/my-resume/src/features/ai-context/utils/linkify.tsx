import { useState } from 'react';

/**
 * Extract YouTube video ID from various YouTube URL formats
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Component for rendering YouTube video thumbnails
 */
function YouTubeEmbed({ videoId, url }: { videoId: string; url: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;

  if (isPlaying) {
    return (
      <div className="my-3 relative" style={{ paddingBottom: '56.25%', height: 0 }}>
        <iframe
          src={embedUrl}
          className="absolute top-0 left-0 w-full h-full rounded-lg"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="YouTube video player"
        />
      </div>
    );
  }

  return (
    <div
      className="my-3 relative cursor-pointer group max-w-lg"
      onClick={() => setIsPlaying(true)}
    >
      <img
        src={thumbnailUrl}
        alt="YouTube video thumbnail"
        className="w-full rounded-lg shadow-lg group-hover:shadow-xl transition-shadow"
      />
      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors rounded-lg">
        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="white"
            className="w-8 h-8 ml-1"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      {/* Video URL link below thumbnail */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-2 text-sm link link-primary hover:underline"
        onClick={(e) => e.stopPropagation()}
        title={url}
      >
        🎥 Watch on YouTube
      </a>
    </div>
  );
}

/**
 * Converts URLs in text to clickable links (Twitter/X-style)
 * - Detects URLs with or without protocol (http://, https://)
 * - Handles trailing punctuation properly
 * - Truncates very long URLs in display
 * - Embeds YouTube videos with thumbnails
 */
export function linkifyText(text: string): React.ReactNode[] {
  // Enhanced regex that matches:
  // 1. URLs with protocol: https://example.com
  // 2. URLs without protocol: www.example.com or example.com
  // 3. Handles paths, query params, fragments: example.com/path?param=value#hash
  const urlRegex = /(https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)|(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*))/gi;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    let url = match[0];
    const index = match.index;

    // Remove trailing punctuation that's not part of the URL
    const trailingPunctuationRegex = /[.,;:!?)\]]+$/;
    const punctuationMatch = url.match(trailingPunctuationRegex);
    let trailingPunctuation = '';

    if (punctuationMatch) {
      trailingPunctuation = punctuationMatch[0];
      url = url.slice(0, -trailingPunctuation.length);
    }

    // Add text before the URL
    if (index > lastIndex) {
      parts.push(text.substring(lastIndex, index));
    }

    // Ensure URL has protocol for href
    const href = url.match(/^https?:\/\//i) ? url : `https://${url}`;

    // Check if this is a YouTube URL
    const youtubeId = extractYouTubeId(href);

    if (youtubeId) {
      // Render YouTube embed instead of plain link
      parts.push(<YouTubeEmbed key={`youtube-${index}`} videoId={youtubeId} url={href} />);
    } else {
      // Truncate display text for very long URLs (Twitter shows ~30 chars)
      const displayUrl = url.length > 40 ? `${url.substring(0, 37)}...` : url;

      // Add the URL as a link
      parts.push(
        <a
          key={`link-${index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="link link-primary hover:underline"
          title={url} // Show full URL on hover
        >
          {displayUrl}
        </a>
      );
    }

    // Add back the trailing punctuation as plain text
    if (trailingPunctuation) {
      parts.push(trailingPunctuation);
    }

    lastIndex = index + url.length + trailingPunctuation.length;
  }

  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  // If no URLs found, return the original text
  return parts.length === 0 ? [text] : parts;
}

