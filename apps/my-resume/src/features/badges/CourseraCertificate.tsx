import React, { useEffect, useState, useRef } from 'react';

interface CourseraCertificateProps {
  certId?: string;
  title: string;
  date?: string;
  organization?: string;
  credentialId?: string;
  credentialUrl?: string;
}

export const CourseraCertificate: React.FC<CourseraCertificateProps> = ({
  certId,
  title,
  date,
  organization = 'Coursera',
  credentialId,
  credentialUrl
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [fetchedDate, setFetchedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const componentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (componentRef.current) {
      observer.observe(componentRef.current);
    }

    return () => {
      if (componentRef.current) {
        observer.unobserve(componentRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Only fetch date if not provided and certificate ID is BKQ777C62BXZ
    if (!date && certId && certId === 'BKQ777C62BXZ') {
      setIsLoading(true);
      fetch(`https://www.coursera.org/account/accomplishments/verify/${certId}`)
        .then(response => response.text())
        .then(html => {
          // Try to extract date from meta tags or structured data
          const dateMatch = html.match(/"datePublished":"([^"]+)"/);
          if (dateMatch) {
            const dateStr = new Date(dateMatch[1]).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short'
            });
            setFetchedDate(dateStr);
          }
        })
        .catch(error => {
          console.error('Error fetching certificate date:', error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [certId, date]);

  // Use credentialUrl if provided, otherwise construct from certId
  const verifyUrl = credentialUrl || (certId ? `https://www.coursera.org/account/accomplishments/verify/${certId}` : '#');

  return (
    <div ref={componentRef} className="my-3">
      <div
        className={`card bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md max-w-md border border-blue-200 ${isVisible ? 'animate-fadeInUp' : 'opacity-0'
          }`}
      >
        <div className="card-body p-2.5">
          {/* Header */}
          <div
            className={`flex items-start justify-between gap-2 ${isVisible ? 'animate-fadeIn' : 'opacity-0'
              }`}
            style={{ animationDelay: '0.1s' }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <svg
                  className="flex-shrink-0"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect width="24" height="24" rx="4" fill="#0056D2" />
                  <path
                    d="M12 4L7 9L12 14L17 9L12 4Z"
                    fill="white"
                    opacity="0.9"
                  />
                  <path
                    d="M12 10L7 15L12 20L17 15L12 10Z"
                    fill="white"
                    opacity="0.6"
                  />
                </svg>
                <span className="text-xs text-blue-700 font-medium">{organization}</span>
              </div>
              <h3 className="text-sm font-bold text-gray-900 leading-tight mb-0.5 break-words">
                {title}
              </h3>
              {credentialId && (
                <div className="text-xs text-gray-500 break-all">
                  ID: {credentialId}
                </div>
              )}
            </div>

            {/* Right side actions */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              {date && (
                <span className="text-xs text-gray-600 font-semibold">{date}</span>
              )}
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-0.5 bg-blue-100 text-blue-800 text-xs font-medium px-1.5 py-0.5 rounded">
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                  Verified
                </span>
                <a
                  href={verifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-xs btn-primary bg-blue-600 hover:bg-blue-700 border-blue-600 text-white min-h-0 h-auto py-1 px-2"
                >
                  View
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
