# DaisyUI Example Component

Here's a simple example to test DaisyUI:

```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl">My Resume</a>
        </div>
        <div className="flex-none">
          <ul className="menu menu-horizontal px-1">
            <li><a>About</a></li>
            <li><a>Projects</a></li>
            <li><a>Contact</a></li>
          </ul>
        </div>
      </div>

      <div className="hero min-h-screen">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-5xl font-bold">Hello there!</h1>
            <p className="py-6">
              This is a DaisyUI-powered resume app.
            </p>
            <button className="btn btn-primary">Get Started</button>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Experience</h2>
              <p>Your work experience here</p>
              <div className="card-actions justify-end">
                <button className="btn btn-primary">Learn More</button>
              </div>
            </div>
          </div>
          
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Skills</h2>
              <p>Your skills here</p>
              <div className="card-actions justify-end">
                <button className="btn btn-primary">Learn More</button>
              </div>
            </div>
          </div>
          
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Education</h2>
              <p>Your education here</p>
              <div className="card-actions justify-end">
                <button className="btn btn-primary">Learn More</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Available DaisyUI Components

- **Buttons**: `btn`, `btn-primary`, `btn-secondary`, `btn-accent`
- **Cards**: `card`, `card-body`, `card-title`, `card-actions`
- **Navbar**: `navbar`, `menu`, `menu-horizontal`
- **Hero**: `hero`, `hero-content`
- **Forms**: `input`, `textarea`, `select`, `checkbox`, `radio`
- **Modals**: `modal`, `modal-box`, `modal-action`
- **Alerts**: `alert`, `alert-info`, `alert-success`, `alert-error`
- **Badges**: `badge`, `badge-primary`, `badge-secondary`
- **Tabs**: `tabs`, `tab`, `tab-active`
- **And many more!**

## Theme Switching

To add theme switching:

```tsx
<select className="select select-bordered w-full max-w-xs" data-choose-theme>
  <option value="light">Light</option>
  <option value="dark">Dark</option>
  <option value="cupcake">Cupcake</option>
  <option value="cyberpunk">Cyberpunk</option>
</select>
```

Add this script to toggle themes:

```tsx
document.querySelector('[data-choose-theme]').addEventListener('change', (e) => {
  document.documentElement.setAttribute('data-theme', e.target.value);
});
```
