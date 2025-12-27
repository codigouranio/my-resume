import './shared/styles/App.css';
import Resume from './features/resume/Resume';
import ChatWidget from './features/chat/ChatWidget';
import { useEffect, useState } from 'react';

const App = () => {
  const [languages, setLanguages] = useState<string[]>([]);
  const [version, setVersion] = useState<string>('');
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    // Fetch resume for languages
    fetch('/resume.md')
      .then((response) => response.text())
      .then((text) => {
        // Extract languages from the markdown
        const languagesMatch = text.match(/### Languages\n(.+)/);
        if (languagesMatch) {
          const langString = languagesMatch[1];
          const langs = langString.split(',').map((lang) =>
            lang
              .trim()
              .replace(/\(.*?\)/g, '')
              .trim(),
          );
          setLanguages(langs);
        }
      })
      .catch((error) => {
        console.error('Error loading languages:', error);
      });

    // Fetch version from package.json
    fetch('/package.json')
      .then((response) => response.json())
      .then((data) => {
        setVersion(data.version);
      })
      .catch((error) => {
        console.error('Error loading version:', error);
      });
  }, []);

  return (
    <div className="min-h-screen bg-base-200">
      <div className="flex">
        {/* Left Sidebar */}
        <aside className="w-64 bg-base-100 min-h-screen p-6 shadow-xl sticky top-0 hidden lg:block">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-primary mb-4">Skills</h2>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-base-content/70 mb-3 uppercase">
              Languages
            </h3>
            <div className="flex flex-wrap gap-2">
              {languages.map((lang, index) => (
                <span key={index} className="badge badge-primary badge-lg">
                  {lang}
                </span>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            <Resume />

            <div className="text-center mt-8">
              <button className="btn btn-primary">Download PDF</button>
              <button className="btn btn-outline btn-secondary ml-4">
                Contact Me
              </button>
            </div>

            {/* Footer with version and year */}
            <footer className="text-center mt-12 pb-8">
              <div className="text-base-content/50 text-sm">
                <p>© {currentYear} Jose Blanco. All rights reserved.</p>
                {version && (
                  <p className="mt-1">
                    Version {version}
                  </p>
                )}
              </div>
            </footer>
          </div>
        </main>
      </div>

      {/* Floating Chat Widget */}
      <ChatWidget />
    </div>
  );
};

export default App;
