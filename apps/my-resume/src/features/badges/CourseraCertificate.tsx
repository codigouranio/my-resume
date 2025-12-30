import React, { useEffect, useState, useRef } from 'react';
import { getCourseraVerifyUrl } from './constants';

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
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const componentRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePosition({ x, y });

    // Calculate rotation based on mouse position
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -10; // Max 10 degrees
    const rotateY = ((x - centerX) / centerX) * 10;

    cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (cardRef.current) {
      cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    }
  };

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
      fetch(getCourseraVerifyUrl(certId))
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
  const verifyUrl = credentialUrl || (certId ? getCourseraVerifyUrl(certId) : '#');

  return (
    <div ref={componentRef} className="inline-block mx-1.5 my-1">
      <div
        ref={cardRef}
        className={`card bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg w-52 h-72 border border-blue-400 transition-all duration-300 ease-out relative overflow-hidden ${isVisible ? 'animate-fadeInUp' : 'opacity-0'
          }`}
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.1s ease-out, box-shadow 0.3s ease-out',
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Spotlight effect */}
        {isHovered && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.4) 0%, transparent 50%)`,
              mixBlendMode: 'overlay',
            }}
          />
        )}

        {/* Shine effect */}
        {isHovered && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(115deg, transparent ${(mousePosition.x / (cardRef.current?.offsetWidth || 1)) * 100 - 20}%, rgba(255,255,255,0.6) ${(mousePosition.x / (cardRef.current?.offsetWidth || 1)) * 100}%, transparent ${(mousePosition.x / (cardRef.current?.offsetWidth || 1)) * 100 + 20}%)`,
              mixBlendMode: 'overlay',
            }}
          />
        )}

        <div className="card-body p-2 relative z-10 flex flex-col h-full justify-between">
          {/* Top Section - Logo and Organization */}
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <svg
                className="flex-shrink-0"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect width="24" height="24" rx="4" fill="#ffffff" />
                <path
                  d="M12 4L7 9L12 14L17 9L12 4Z"
                  fill="#0056D2"
                  opacity="0.9"
                />
                <path
                  d="M12 10L7 15L12 20L17 15L12 10Z"
                  fill="#0056D2"
                  opacity="0.6"
                />
              </svg>
            </div>
            <span className="text-[10px] text-blue-100 font-semibold uppercase tracking-wide">{organization}</span>
          </div>

          {/* Middle Section - Certificate Title */}
          <div className="flex items-center justify-center my-[5px]">
            <h3 className="text-xs font-bold text-white leading-tight text-center px-1 m-0">
              {title}
            </h3>
          </div>

          {/* Bottom Section - Details and Actions */}
          <div className="space-y-1">
            {date && (
              <div className="text-center">
                <p className="text-[9px] text-blue-200 uppercase tracking-wider mb-0">Issued</p>
                <p className="text-[10px] text-white font-semibold">{date}</p>
              </div>
            )}

            {credentialId && (
              <div className="text-center">
                <p className="text-[9px] text-blue-200 break-all leading-tight">
                  ID: {credentialId}
                </p>
              </div>
            )}

            <div className="flex flex-col items-center gap-0.5">
              <span className="inline-flex items-center gap-0.5 bg-blue-100 text-blue-800 text-[9px] font-medium px-1.5 py-0.5 rounded-full">
                <svg
                  width="8"
                  height="8"
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
                className="btn btn-xs bg-white text-blue-700 hover:bg-blue-50 border-0 w-full font-semibold text-[10px] min-h-0 h-6 px-2"
              >
                View →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
