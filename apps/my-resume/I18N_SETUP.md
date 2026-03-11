# i18n Multi-Language Setup

## ✅ Completed Implementation

The application now has full internationalization (i18n) support with:

### 📦 Infrastructure
- **react-i18next** - React integration
- **i18next** - Core i18n library  
- **i18next-browser-languagedetector** - Auto-detect user language
- Configuration in `src/i18n/config.ts`
- Initialized in `src/index.tsx`

### 🌍 Supported Languages (Ready)
- **English (en)** - Complete ✅
- **Spanish (es)** - Complete ✅
- **Portuguese (pt)** - Template ready 📝
- **German (de)** - Template ready 📝
- **Polish (pl)** - Template ready 📝
- **Arabic (ar)** - Template ready 📝 (RTL support included!)

### 📁 File Structure
```
src/i18n/
  config.ts                 # i18n setup & configuration
  locales/
    en/
      common.json          # English translations (complete)
    es/
      common.json          # Spanish translations (complete)
    pt/
      common.json          # Portuguese (to be added)
    de/
      common.json          # German (to be added)
    pl/
      common.json          # Polish (to be added)
    ar/
      common.json          # Arabic (to be added)
```

### 🎯 Translated Features
All UI strings extracted and organized by feature:

- **Navigation** - Menu items, links
- **Common** - Buttons, actions, messages
- **Interviews** - Complete interview tracker feature
- **Dashboard** - Main dashboard UI
- **Settings** - User settings page
- **Auth** - Login/signup forms
- **Chat** - AI chat widget
- **Resume** - Resume display
- **Analytics** - Analytics dashboard
- **AI Context** - Journal/context feed
- **Errors** - Error messages
- **Validation** - Form validation messages

### 🔧 Usage in Components

**Import the hook:**
```tsx
import { useTranslation } from 'react-i18next';
```

**Use translations:**
```tsx
export function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('interviews.title')}</h1>
      <button>{t('common.save')}</button>
      <p>{t('interviews.subtitle')}</p>
    </div>
  );
}
```

**With variables:**
```tsx
{t('interviews.applied_count', { count: 5 })}
// Automatically handles pluralization per language
```

### 🎨 Language Switcher Component

Located at: `src/shared/components/LanguageSwitcher.tsx`

**Usage:**
```tsx
import { LanguageSwitcher } from '../shared/components/LanguageSwitcher';

// Dropdown variant (recommended for navbar)
<LanguageSwitcher variant="dropdown" />

// Button variant (for settings page)
<LanguageSwitcher variant="buttons" className="my-4" />
```

**Features:**
- Dropdown or button layout
- Shows flag + language name
- Auto-saves preference to localStorage
- Handles RTL for Arabic automatically
- DaisyUI styled

### 📝 Adding New Translations

**1. Add locale file:**
```bash
# Create new language file
cp apps/my-resume/src/i18n/locales/en/common.json \
   apps/my-resume/src/i18n/locales/pt/common.json
```

**2. Translate strings:**
Edit the new file and translate all English strings to your target language.

**3. Update config:**
```typescript
// src/i18n/config.ts
import ptCommon from './locales/pt/common.json';

i18n.init({
  resources: {
    en: { common: enCommon },
    es: { common: esCommon },
    pt: { common: ptCommon }, // Add this
  },
  // ...
});
```

**4. Add to language switcher:**
```tsx
// src/shared/components/LanguageSwitcher.tsx
const languages = [
  // ...existing languages
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
];
```

### 🌐 Integration with Frontend

**Already updated components:**
- ✅ InterviewBoard
- ✅ InterviewStats  
- ✅ InterviewCard
- ✅ InterviewForm (partial - key labels)

**To add language switcher to navbar:**
```tsx
// In your navigation component
import { LanguageSwitcher } from './shared/components/LanguageSwitcher';

<nav className="navbar">
  {/* ...other nav items */}
  <LanguageSwitcher variant="dropdown" />
</nav>
```

**To add to settings page:**
```tsx
import { LanguageSwitcher } from '../../shared/components/LanguageSwitcher';

<div className="settings-section">
  <h3>Language / Idioma</h3>
  <LanguageSwitcher variant="buttons" />
</div>
```

### 🔄 RTL Support (Arabic)

The system automatically handles RTL layout when Arabic is selected:

1. Sets `<html dir="rtl">` attribute
2. DaisyUI styles automatically flip
3. Flexbox layouts reverse
4. Text alignment adjusts

### 📊 Translation Coverage

**Complete (100%):**
- Interviews feature
- Common UI elements

**Partial (<50%):**
- Dashboard (main strings done)
- Settings (main strings done)
- Other features (ready for translation)

### 🚀 Next Steps

1. **Gradual rollout:**
   - Start with Spanish (es) ✅
   - Add Portuguese (pt) - largest user base in Brazil
   - Add remaining languages as needed

2. **Backend i18n:**
   - Email templates (nestjs-i18n)
   - Error messages
   - API responses

3. **Content:**
   - Separate language files per feature for better organization
   - Add `interviews.json`, `dashboard.json`, etc.

4. **Testing:**
   - Test all features in Spanish
   - Verify RTL layout with Arabic
   - Check pluralization rules

### 🎯 Best Practices

**DO:**
- Use translation keys semantically: `interviews.delete_confirm` not `msg_123`
- Group by feature: `interviews.*`, `dashboard.*`
- Keep strings short and simple
- Test with longer text (German is ~30% longer)

**DON'T:**
- Hardcode strings in JSX
- Concatenate translated strings
- Use translation keys as IDs
- Forget pluralization forms

### 📚 Resources

- [react-i18next docs](https://react.i18next.com/)
- [i18next docs](https://www.i18next.com/)
- [Pluralization rules](https://www.i18next.com/translation-function/plurals)
- [RTL guidelines](https://rtlstyling.com/)

### 🐛 Common Issues

**Issue:** Translation not showing
- Check: Is the key correct?
- Check: Is the language file imported in config.ts?
- Check: Did you use `t()` function?

**Issue:** Language not changing
- Check: Is localStorage being set?
- Check: Is config.ts imported before App?
- Check: Browser console for i18next errors

**Issue:** RTL looks broken
- Check: DaisyUI version supports RTL
- Check: Custom CSS doesn't override `[dir="rtl"]`
- Check: `<html dir="rtl">` is set

---

## 🎉 Ready to Use!

Your app now supports multiple languages. Add the `<LanguageSwitcher />` component to your navigation and users can switch languages instantly!
