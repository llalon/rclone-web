import { resolveUrlWithIngress } from '@/lib/url'

export type NamedJob = {
    running_job_ids?: number[]
    name: string
    schedule: string
    payload: { command: string; command_args?: Record<string, unknown> }
}

export async function namedJobsAPI<T>(path = '', method = 'GET', job?: NamedJob): Promise<T> {
    const response = await fetch(resolveUrlWithIngress(`/api/jobs${path}`), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: job ? JSON.stringify(job) : undefined,
    })
    if (response.status === 204) return undefined as T
    const data = (await response.json()) as T & { error?: string }
    if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`)
    return data as T
}
