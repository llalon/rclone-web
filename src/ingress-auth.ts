import { useStore } from '@/lib/store'

// Home Assistant Ingress already authenticates the session and the rclone
// daemon runs with --rc-no-auth, so satisfy the app's auth gate with a dummy
// user instead of showing the login page.
export function applyIngressAuth() {
    const url = window.__RCLONE_INGRESS_URL__
    if (!url) return

    const { user, pass } = useStore.getState()
    if (!user || !pass) {
        useStore.setState({ user: 'homeassistant', pass: 'homeassistant' })
    }
}
