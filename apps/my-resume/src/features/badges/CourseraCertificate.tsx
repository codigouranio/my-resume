import React, { useEffect, useState, useRef } from 'react';

interface CourseraCertificateProps {
  certId: string;
}

export const CourseraCertificate: React.FC<CourseraCertificateProps> = ({ certId }) => {
  const [isVisible, setIsVisible] = useState(false);
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

  const verifyUrl = `https://www.coursera.org/account/accomplishments/verify/${certId}`;

  return (
    <div ref={componentRef} className="my-8">
      <div
        className={`card bg-gradient-to-br from-blue-50 to-indigo-50 shadow-xl max-w-md border border-blue-200 ${isVisible ? 'animate-fadeInUp' : 'opacity-0'
          }`}
      >
        <div className="card-body p-6">
          {/* Header */}
          <div
            className={`flex items-center gap-3 mb-4 ${isVisible ? 'animate-fadeIn' : 'opacity-0'
              }`}
            style={{ animationDelay: '0.1s' }}
          >
            <svg
              className="flex-shrink-0"
              width="32"
              height="32"
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
            <div>
              <h3 className="text-lg font-bold text-blue-900 leading-none">
                Coursera Certificate
              </h3>
              <p className="text-sm text-blue-700 mt-0.5">Verified Credential</p>
            </div>
          </div>

          {/* Certificate Info */}
          <div
            className={`bg-white rounded-lg p-4 mb-4 border border-blue-100 ${isVisible ? 'animate-fadeInScale' : 'opacity-0'
              }`}
            style={{ animationDelay: '0.2s' }}
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="12" cy="12" r="10" fill="#0056D2" opacity="0.1" />
                  <path
                    d="M9 12L11 14L15 10"
                    stroke="#0056D2"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="#0056D2"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
                  Certificate ID
                </p>
                <p className="font-mono text-sm text-blue-900 font-medium break-all">
                  {certId}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className={`flex items-center justify-between ${isVisible ? 'animate-fadeIn' : 'opacity-0'
              }`}
            style={{ animationDelay: '0.3s' }}
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
                Verified
              </span>
            </div>
            <a
              href={verifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-primary bg-blue-600 hover:bg-blue-700 border-blue-600 text-white"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              View Certificate
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
