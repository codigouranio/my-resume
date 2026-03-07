/**
 * Converts URLs in text to clickable links (Twitter/X-style)
 * - Detects URLs with or without protocol (http://, https://)
 * - Handles trailing punctuation properly
 * - Truncates very long URLs in display
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
