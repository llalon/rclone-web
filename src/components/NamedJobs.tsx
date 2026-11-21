import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { type JobDisplayRow, JobsTable } from '@/components/JobsTable'
import { PageContent } from '@/components/PageContent'
import { PageHeader } from '@/components/PageHeader'
import { PageWrapper } from '@/components/PageWrapper'
import { RefreshButton } from '@/components/RefreshButton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/lib/i18n'
import { fetchRunningJobs, stopJob } from '@/rclone/jobs'
import { type NamedJob, namedJobsAPI } from '@/rclone/named-jobs'

const example = JSON.stringify(
    {
        command: 'sync/copy',
        command_args: { srcFs: '/share/documents', dstFs: 'remote:backup' },
    },
    null,
    2
)

export function NamedJobs() {
    const t = useT()
    const client = useQueryClient()
    const jobs = useQuery({
        queryKey: ['namedJobs'],
        queryFn: () => namedJobsAPI<NamedJob[]>(),
        refetchInterval: 1500,
    })
    const running = useQuery({
        queryKey: ['runningJobs'],
        queryFn: fetchRunningJobs,
        refetchInterval: 1500,
    })
    const [queued, setQueued] = useState<Record<string, number>>({})
    const [open, setOpen] = useState(false)
    const [editing, setEditing] = useState(false)
    const [name, setName] = useState('')
    const [schedule, setSchedule] = useState('')
    const [payload, setPayload] = useState(example)
    const [error, setError] = useState('')
    const [deleting, setDeleting] = useState<NamedJob | null>(null)

    const mutation = useMutation({
        mutationFn: async (action: { type: 'save' | 'delete' | 'run'; job: NamedJob }) => {
            const path = `/${encodeURIComponent(action.job.name)}`
            if (action.type === 'run') return namedJobsAPI(`${path}/run`, 'POST')
            if (action.type === 'delete') return namedJobsAPI(path, 'DELETE')
            const { name, schedule, payload } = action.job
            return namedJobsAPI(editing ? path : '', editing ? 'PUT' : 'POST', {
                name,
                schedule,
                payload,
            })
        },
        onSuccess: (_, action) => {
            client.invalidateQueries({ queryKey: ['namedJobs'] })
            client.invalidateQueries({ queryKey: ['runningJobs'] })
            if (action.type === 'run')
                setQueued((current) => ({ ...current, [action.job.name]: Date.now() + 10000 }))
            if (action.type === 'save') setOpen(false)
            if (action.type === 'delete') setDeleting(null)
            toast.success(
                action.type === 'run'
                    ? 'Job queued via MQTT'
                    : action.type === 'delete'
                      ? 'Job deleted'
                      : 'Job saved'
            )
        },
        onError: (err) => {
            setError(err.message)
            toast.error(err.message)
        },
    })

    function showEditor(job?: NamedJob) {
        setEditing(Boolean(job))
        setName(job?.name ?? '')
        setSchedule(job?.schedule ?? '')
        setPayload(job ? JSON.stringify(job.payload, null, 2) : example)
        setError('')
        setOpen(true)
    }

    const stop = useMutation({
        mutationFn: async (row: JobDisplayRow) => {
            // A definition can have overlapping runs; stop every active instance.
            const results = await Promise.allSettled(row.runs.map((run) => stopJob(run.id)))
            const failure = results.find((result) => result.status === 'rejected')
            if (failure?.status === 'rejected') throw failure.reason
        },
        onSuccess: (_, row) => {
            if (row.definition) setQueued((current) => ({ ...current, [row.definition!.name]: 0 }))
            toast.success(t('jobs.stopSuccess'))
        },
        onError: (err) =>
            toast.error(err instanceof Error ? err.message : t('common.unknownError')),
        onSettled: () => {
            client.invalidateQueries({ queryKey: ['runningJobs'] })
            client.invalidateQueries({ queryKey: ['namedJobs'] })
            client.invalidateQueries({ queryKey: ['jobs'] })
        },
    })

    const runs = running.data ?? []
    // Once a queued trigger has appeared, completion should immediately restore Run.
    useEffect(() => {
        const activeIDs = new Set((running.data ?? []).map((run) => run.id))
        setQueued((current) => {
            let next = current
            for (const job of jobs.data ?? []) {
                if (current[job.name] > 0 && job.running_job_ids?.some((id) => activeIDs.has(id))) {
                    next = { ...next, [job.name]: 0 }
                }
            }
            return next
        })
    }, [jobs.data, running.data])

    const claimed = new Set<number>()
    const rows: JobDisplayRow[] = (jobs.data ?? []).map((job) => {
        const ids = new Set(job.running_job_ids ?? [])
        const matches = runs.filter((run) => ids.has(run.id))
        for (const run of matches) claimed.add(run.id)
        return { key: `named:${job.name}`, definition: job, runs: matches }
    })
    for (const run of runs) {
        if (!claimed.has(run.id)) rows.push({ key: `running:${run.id}`, runs: [run] })
    }

    return (
        <PageWrapper>
            <PageHeader
                title={t('jobs.title')}
                description="Manage, schedule, and monitor your jobs."
                actions={
                    <div className="flex items-center gap-2">
                        <Button size="lg" onClick={() => showEditor()}>
                            <PlusIcon />
                            New job
                        </Button>
                        <RefreshButton
                            isFetching={jobs.isFetching || running.isFetching}
                            refetch={() => {
                                jobs.refetch()
                                running.refetch()
                            }}
                        />
                    </div>
                }
            />
            <PageContent>
                {(jobs.isPending || running.isPending) && <p role="status">Loading jobs…</p>}
                {jobs.isError && (
                    <div role="alert">
                        Could not load named jobs: {jobs.error.message}{' '}
                        <Button variant="outline" onClick={() => jobs.refetch()}>
                            Retry
                        </Button>
                    </div>
                )}
                {running.isError && (
                    <div role="alert">
                        {t('jobs.loadError')}: {running.error.message}{' '}
                        <Button variant="outline" onClick={() => running.refetch()}>
                            Retry
                        </Button>
                    </div>
                )}
                {jobs.isSuccess && running.isSuccess && rows.length === 0 && (
                    <p className="rounded-xl border p-6 text-sm text-muted-foreground">
                        No jobs yet. Create a job to run it by name or on a schedule.
                    </p>
                )}
                {rows.length > 0 && (
                    <JobsTable
                        jobs={rows}
                        onRun={(job) => mutation.mutate({ type: 'run', job })}
                        onStop={(row) => stop.mutate(row)}
                        onEdit={showEditor}
                        onDelete={setDeleting}
                        isBusy={mutation.isPending || stop.isPending}
                        canRun={jobs.isSuccess && running.isSuccess}
                        queued={queued}
                    />
                )}
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent className="sm:max-w-xl max-h-[90dvh] overflow-y-auto">
                        <DialogTitle>{editing ? 'Edit named job' : 'New named job'}</DialogTitle>
                        <DialogDescription>
                            Enter a name, cron schedule, and rclone command JSON.
                        </DialogDescription>
                        <form
                            className="space-y-4"
                            onSubmit={(event) => {
                                event.preventDefault()
                                try {
                                    const parsed = JSON.parse(payload) as NamedJob['payload']
                                    if (
                                        !parsed ||
                                        Array.isArray(parsed) ||
                                        typeof parsed.command !== 'string' ||
                                        !parsed.command.trim()
                                    )
                                        throw new Error(
                                            'JSON must contain a command and optional command_args object.'
                                        )
                                    setError('')
                                    mutation.mutate({
                                        type: 'save',
                                        job: { name, schedule, payload: parsed },
                                    })
                                } catch (err) {
                                    setError(err instanceof Error ? err.message : 'Invalid JSON')
                                }
                            }}
                        >
                            <div className="space-y-2">
                                <Label htmlFor="job-name">Name</Label>
                                <Input
                                    id="job-name"
                                    required
                                    maxLength={128}
                                    disabled={editing || mutation.isPending}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Documents Backup"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="job-schedule">Cron schedule</Label>
                                <Input
                                    id="job-schedule"
                                    value={schedule}
                                    onChange={(e) => setSchedule(e.target.value)}
                                    placeholder="0 3 * * *"
                                    aria-describedby="job-schedule-help"
                                />
                                <p id="job-schedule-help" className="text-sm text-muted-foreground">
                                    Minute, hour, day, month, weekday. Uses the add-on timezone;
                                    optionally prefix with CRON_TZ=America/Toronto. Leave blank for
                                    manual runs.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="job-payload">Command JSON</Label>
                                <Textarea
                                    id="job-payload"
                                    required
                                    rows={9}
                                    className="font-mono"
                                    value={payload}
                                    onChange={(e) => setPayload(e.target.value)}
                                />
                            </div>
                            {error && (
                                <p role="alert" className="text-sm text-destructive">
                                    {error}
                                </p>
                            )}
                            <div className="flex justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={mutation.isPending}
                                    onClick={() => setOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={mutation.isPending}>
                                    {mutation.isPending ? 'Saving…' : 'Save job'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
                <Dialog
                    open={Boolean(deleting)}
                    onOpenChange={(value) => {
                        if (!value) setDeleting(null)
                    }}
                >
                    <DialogContent>
                        <DialogTitle>Delete named job?</DialogTitle>
                        <DialogDescription>
                            Delete {deleting?.name} and its schedule? Running transfers will
                            continue.
                        </DialogDescription>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                disabled={mutation.isPending}
                                onClick={() => setDeleting(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                disabled={mutation.isPending}
                                onClick={() => {
                                    if (deleting) mutation.mutate({ type: 'delete', job: deleting })
                                }}
                            >
                                Delete job
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </PageContent>
        </PageWrapper>
    )
}
