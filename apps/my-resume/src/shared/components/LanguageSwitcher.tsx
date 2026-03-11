import i18n from '../../i18n/config';
import { apiClient } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

// Only show languages that have actual translation files
// To add more languages:
// 1. Add translation file to src/i18n/locales/{code}/common.json
// 2. Import in src/i18n/config.ts
// 3. Add here
const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'cn', name: 'Chinese', flag: '🇨🇳' },
  // Uncomment when translation files are ready:
  // { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  // { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  // { code: 'ar', name: 'العربية', flag: '🇸🇦' },
];

interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'buttons';
  className?: string;
}

export function LanguageSwitcher({ variant = 'dropdown', className = '' }: LanguageSwitcherProps) {
  const { isAuthenticated } = useAuth();

  const changeLanguage = async (lng: string) => {
    console.log('Changing language to:', lng); // Debug log

    try {
      await i18n.changeLanguage(lng);
      console.log('Language changed successfully to:', lng);

      // Update HTML dir attribute for RTL languages
      if (lng === 'ar') {
        document.documentElement.setAttribute('dir', 'rtl');
      } else {
        document.documentElement.setAttribute('dir', 'ltr');
      }

      // Save preference to localStorage
      localStorage.setItem('language', lng);

      // Save preference to backend if user is logged in
      if (isAuthenticated) {
        try {
          await apiClient.updateCurrentUser({ preferredLanguage: lng });
          console.log('Language preference saved to backend:', lng);
        } catch (error) {
          console.error('Failed to save language preference to backend:', error);
          // Don't throw - language still changed locally
        }
      }
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  };

  const currentLang = languages.find((lang) => lang.code === i18n.language) || languages[0];

  if (variant === 'buttons') {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={`btn btn-sm ${i18n.language === lang.code ? 'btn-primary' : 'btn-ghost'}`}
            title={lang.name}
          >
            {lang.flag} {lang.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`language-switcher-dropdown dropdown dropdown-end ${className}`}>
      <label tabIndex={0} className="btn btn-ghost btn-sm gap-2">
        {currentLang.flag} {currentLang.code.toUpperCase()}
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 mt-2"
      >
        {languages.map((lang) => (
          <li key={lang.code}>
            <button
              onClick={() => changeLanguage(lang.code)}
              className={i18n.language === lang.code ? 'active' : ''}
            >
              <span className="text-xl">{lang.flag}</span>
              <span>{lang.name}</span>
              {i18n.language === lang.code && (
                <span className="badge badge-primary badge-sm">✓</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
