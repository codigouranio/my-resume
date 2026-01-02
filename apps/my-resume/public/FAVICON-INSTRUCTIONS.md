# ResumeCast.ai Favicon Creation Guide

## Design Specifications

### Favicon Version (favicon.png)
- **Content**: Crop tightly to just the swirling "C" shape from the logo
- **Size**: 512x512px (master file)
- **Format**: PNG with transparency
- **Centering**: Ensure the "C" is perfectly centered in the square canvas
- **Padding**: Leave ~10% padding around the edges for breathing room

### Color Palette
```
Deep Navy Background: #0A1A2F or #001F3F
Primary Blue: #007BFF
Vibrant Teal: #00C2CB
Gradient: #007BFF → #00C2CB
```

### Required Favicon Sizes
Generate these sizes using [RealFaviconGenerator.net](https://realfavicongenerator.net/):
- `favicon.ico` - Multi-size ICO (16x16, 32x32, 48x48)
- `favicon-16x16.png`
- `favicon-32x32.png`
- `apple-touch-icon.png` - 180x180px (iOS)
- `android-chrome-192x192.png` - 192x192px
- `android-chrome-512x512.png` - 512x512px

## Full Logo Wordmark

### Typography
- **Font**: Inter Bold (or Medium weight)
- **Text**: "ResumeCast.ai"
- **Color Split**:
  - "Resume" → Deep Navy (#0A1A2F)
  - "Cast.ai" → Vibrant Teal (#00C2CB)

### Logo Variations Needed
1. **Horizontal Lockup**: Icon + Wordmark side-by-side
2. **Stacked Version**: Icon above wordmark (for mobile)
3. **Icon Only**: Just the "C" swirl (for favicons/avatars)

## Brand Assets Structure
```
public/
├── logo.png              # Full horizontal logo (light mode)
├── logo-dark.png         # Full horizontal logo (dark mode - inverted gradient)
├── logo-icon.png         # Icon only - "C" swirl
├── favicon.ico           # Multi-size favicon
├── favicon-16x16.png
├── favicon-32x32.png
├── apple-touch-icon.png
├── android-chrome-192x192.png
└── android-chrome-512x512.png
```

## Dark Mode Variations
- **Light Mode**: Use standard gradient (#007BFF → #00C2CB)
- **Dark Mode**: 
  - Option 1: Invert gradient direction
  - Option 2: Lighten colors by 15-20%
  - Option 3: Add subtle glow effect around the icon

## Implementation Steps

1. **Extract the "C" Shape**:
   - Open `logo.jpg` in image editor (Photoshop, Figma, or Affinity Designer)
   - Crop tightly to just the swirling "C" portion
   - Remove any text or surrounding elements

2. **Create Master Favicon (512x512)**:
   - Create new 512x512px canvas
   - Paste the "C" shape centered
   - Ensure ~50px padding on all sides
   - Export as `favicon-master.png` (PNG-24 with transparency)

3. **Generate All Sizes**:
   - Go to https://realfavicongenerator.net/
   - Upload `favicon-master.png`
   - Configure settings:
     - iOS: Use gradient background or transparent
     - Android: Use gradient background
     - Windows: Teal accent color (#00C2CB)
   - Download the package and extract to `public/` folder

4. **Test in Browsers**:
   ```bash
   # Rebuild frontend
   cd apps/my-resume
   yarn build
   
   # Clear browser cache and test
   # Chrome: Cmd+Shift+R
   # Firefox: Cmd+Shift+R
   # Safari: Cmd+Option+R
   ```

## Current Status
- ✅ Brand colors defined in code
- ✅ ResumeCast.ai branding updated
- ⏳ Favicon files need to be generated (follow steps above)
- ⏳ Dark mode logo variant needed

## Quick Command to Replace Favicons
```bash
# After generating favicons from RealFaviconGenerator
cd /Users/joseblanco/data/dev/my-resume/apps/my-resume/public
# Replace the generated files here
git add favicon* apple-touch-icon.png android-chrome-*
git commit -m "feat: Add proper ResumeCast.ai favicon suite"
git push origin main
```
