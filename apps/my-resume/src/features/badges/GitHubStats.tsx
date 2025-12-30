import { useEffect, useState, useRef } from 'react';

interface GitHubStatsProps {
  username: string;
  theme?: 'light' | 'dark';
}

interface GitHubData {
  repos: number;
  stars: number;
  forks: number;
  followers: number;
  publicGists: number;
  totalSize: number;
  languages: { [key: string]: number };
}

export function GitHubStats({ username, theme = 'dark' }: GitHubStatsProps) {
  const [data, setData] = useState<GitHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchGitHubData = async () => {
      try {
        setLoading(true);

        // Fetch user data
        const userResponse = await fetch(`https://api.github.com/users/${username}`);
        if (!userResponse.ok) {
          throw new Error('Failed to fetch GitHub user data');
        }
        const userData = await userResponse.json();

        // Fetch repositories
        const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`);
        if (!reposResponse.ok) {
          throw new Error('Failed to fetch repositories');
        }
        const repos = await reposResponse.json();

        // Calculate statistics
        const totalStars = repos.reduce((sum: number, repo: any) => sum + (repo.stargazers_count || 0), 0);
        const totalForks = repos.reduce((sum: number, repo: any) => sum + (repo.forks_count || 0), 0);
        const totalSize = repos.reduce((sum: number, repo: any) => sum + (repo.size || 0), 0);

        // Aggregate languages
        const languageCounts: { [key: string]: number } = {};
        for (const repo of repos) {
          if (repo.language) {
            languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
          }
        }

        // Sort languages by count
        const sortedLanguages = Object.entries(languageCounts)
          .sort(([, a], [, b]) => b - a)
          .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

        setData({
          repos: userData.public_repos || repos.length,
          stars: totalStars,
          forks: totalForks,
          followers: userData.followers || 0,
          publicGists: userData.public_gists || 0,
          totalSize,
          languages: sortedLanguages,
        });
      } catch (err: any) {
        console.error('Error fetching GitHub data:', err);
        setError(err.message || 'Failed to load GitHub stats');
      } finally {
        setLoading(false);
      }
    };

    fetchGitHubData();
  }, [username]);

  // Intersection Observer for scroll animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 } // Trigger when 10% of the element is visible
    );

    const currentRef = cardRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [data]); // Re-run when data loads to check visibility

  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-base-300' : 'bg-base-100';
  const textColor = isDark ? 'text-base-content' : 'text-base-content';
  const borderColor = isDark ? 'border-base-content/20' : 'border-base-300';

  if (loading) {
    return (
      <div className={`card ${bgColor} shadow-md ${borderColor} border my-3 max-w-md`}>
        <div className="card-body p-2">
          <div className="flex items-center gap-2">
            <div className="skeleton h-3 w-3 rounded-full"></div>
            <div className="skeleton h-2.5 w-24"></div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-1.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-10 w-full"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-warning my-3 max-w-md text-xs py-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>Unable to load GitHub stats</span>
      </div>
    );
  }

  if (!data) return null;

  const topLanguages = Object.entries(data.languages).slice(0, 3);

  return (
    <div
      ref={cardRef}
      className={`card ${bgColor} shadow-md ${borderColor} border my-3 not-prose max-w-md ${isVisible ? 'animate-[fadeInUp_0.6s_ease-out]' : 'opacity-0'
        }`}
    >
      <div className="card-body p-2">
        {/* Header */}
        <div className={`flex items-center gap-1.5 mb-1.5 ${isVisible ? 'animate-[fadeIn_0.5s_ease-out]' : 'opacity-0'}`}>
          <svg className="w-5 h-5 flex-shrink-0 self-center text-white" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <h3 className={`text-sm font-bold ${textColor} leading-none`}>
            {username}'s GitHub
          </h3>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className={`bg-base-100/50 rounded p-1.5 ${isVisible ? 'animate-[fadeInScale_0.5s_ease-out_0.1s_backwards]' : 'opacity-0'
            }`}>
            <div className="text-xs opacity-70">Repos</div>
            <div className="text-base font-bold">📦 {data.repos}</div>
          </div>

          <div className={`bg-base-100/50 rounded p-1.5 ${isVisible ? 'animate-[fadeInScale_0.5s_ease-out_0.2s_backwards]' : 'opacity-0'
            }`}>
            <div className="text-xs opacity-70">Stars</div>
            <div className="text-base font-bold">⭐ {data.stars}</div>
          </div>

          <div className={`bg-base-100/50 rounded p-1.5 ${isVisible ? 'animate-[fadeInScale_0.5s_ease-out_0.3s_backwards]' : 'opacity-0'
            }`}>
            <div className="text-xs opacity-70">Forks</div>
            <div className="text-base font-bold">🔀 {data.forks}</div>
          </div>
        </div>

        {/* Top Languages */}
        {topLanguages.length > 0 && (
          <div className={`mt-1.5 ${isVisible ? 'animate-[fadeIn_0.5s_ease-out_0.4s_backwards]' : 'opacity-0'}`}>
            <div className="flex flex-wrap gap-1 justify-center">
              {topLanguages.map(([language, count], index) => (
                <div
                  key={language}
                  className={`badge badge-sm badge-primary ${isVisible ? 'animate-[fadeInScale_0.4s_ease-out_backwards]' : 'opacity-0'
                    }`}
                  style={{ animationDelay: isVisible ? `${0.5 + index * 0.1}s` : '0s' }}
                >
                  {language} ({count})
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={`mt-1.5 text-center ${isVisible ? 'animate-[fadeIn_0.5s_ease-out_0.7s_backwards]' : 'opacity-0'}`}>
          <a
            href={`https://github.com/${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-xs btn-outline gap-1"
          >
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
