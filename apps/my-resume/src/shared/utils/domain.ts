/**
 * Get the base domain from environment or use default
 */
export function getBaseDomain(): string {
  return import.meta.env.PUBLIC_BASE_DOMAIN || 'resumecast.ai';
}

/**
 * Get the display base domain (without subdomain)
 * For "my-resume.paskot.com" returns "my-resume.paskot.com"
 * For "resumecast.ai" returns "resumecast.ai"
 */
export function getDisplayBaseDomain(): string {
  return getBaseDomain();
}

/**
 * Format a custom domain URL
 * @param customDomain - The custom subdomain (e.g., "john")
 * @param path - Optional path (e.g., "/my-resume")
 * @returns Full URL (e.g., "john.my-resume.paskot.com/my-resume")
 */
export function formatCustomDomainUrl(customDomain: string, path?: string): string {
  const baseDomain = getBaseDomain();
  const pathPart = path ? `/${path}` : '';
  if (customDomain) {
    return `${customDomain}.${baseDomain}`;
  }
  return `${baseDomain}${pathPart}`;
}

/**
 * Format a public resume URL
 * @param slug - The resume slug
 * @param customDomain - Optional custom subdomain
 * @returns Full path or URL
 */
export function formatResumeUrl(slug: string, customDomain?: string): string {
  if (customDomain) {
    return `https://${formatCustomDomainUrl(customDomain, slug)}`;
  }
  return `/resume/${slug}`;
}

/**
 * Format a display resume path (without protocol)
 * @param slug - The resume slug
 * @param customDomain - Optional custom subdomain
 * @returns Display path
 */
export function formatResumeDisplayPath(slug: string, customDomain?: string): string {
  if (customDomain) {
    return formatCustomDomainUrl(customDomain, slug);
  }
  const baseDomain = getBaseDomain();
  return `${baseDomain}/resume/${slug}`;
}
