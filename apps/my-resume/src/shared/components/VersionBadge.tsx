/**
 * Version Badge Component
 * Displays the current app version in the bottom right corner
 */

const VersionBadge = () => {
  const version = import.meta.env.VITE_APP_VERSION || '1.0.0';

  return (
    <div
      className="fixed bottom-2 left-2 text-xs text-gray-500 bg-gray-100 rounded px-2 py-1 opacity-60 hover:opacity-100 transition-opacity cursor-default"
      title={`Version ${version}`}
    >
      v{version}
    </div>
  );
};

export default VersionBadge;
