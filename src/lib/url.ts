// Resolves a URL against the Home Assistant Ingress path when the app is
// served through Ingress, so requests stay under the Ingress URL. Outside
// Ingress the URL is returned unchanged.
export function resolveUrlWithIngress(url: string): string {
    const base = window.__RCLONE_INGRESS_BASE__
    if (!base || base === '/') return url

    const path = url.startsWith('/') ? url : `/${url}`
    return `${base.replace(/\/+$/, '')}${path}`
}
