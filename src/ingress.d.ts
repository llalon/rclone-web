export {}

declare global {
    interface Window {
        __RCLONE_INGRESS_BASE__?: string
        __RCLONE_INGRESS_URL__?: string
    }
}
