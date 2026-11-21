import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
    const client = useQueryClient()
    const jobs = useQuery({ queryKey: ['namedJobs'], queryFn: () => namedJobsAPI<NamedJob[]>() })
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
            return namedJobsAPI(editing ? path : '', editing ? 'PUT' : 'POST', action.job)
        },
        onSuccess: (_, action) => {
            client.invalidateQueries({ queryKey: ['namedJobs'] })
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

    return (
        <section className="space-y-4" aria-label="Named jobs">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold">Named jobs</h2>
                    <p className="text-sm text-muted-foreground">
                        Save commands and schedule them through MQTT.
                    </p>
                </div>
                <Button onClick={() => showEditor()}>New job</Button>
            </div>
            {jobs.isPending && <p role="status">Loading named jobs…</p>}
            {jobs.isError && (
                <div role="alert">
                    Could not load named jobs: {jobs.error.message}{' '}
                    <Button variant="outline" onClick={() => jobs.refetch()}>
                        Retry
                    </Button>
                </div>
            )}
            {jobs.isSuccess && jobs.data.length === 0 && (
                <p className="rounded-xl border p-6 text-sm text-muted-foreground">
                    No named jobs yet. Create a job to run it by name or on a schedule.
                </p>
            )}
            {jobs.data?.map((job) => (
                <div
                    key={job.name}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
                >
                    <div className="min-w-0">
                        <h3 className="font-medium break-all">{job.name}</h3>
                        <p className="font-mono text-sm break-all">
                            {job.schedule || 'Manual only'}
                        </p>
                        <p className="text-sm text-muted-foreground">{job.payload.command}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            disabled={mutation.isPending}
                            onClick={() => mutation.mutate({ type: 'run', job })}
                        >
                            Run now
                        </Button>
                        <Button
                            variant="outline"
                            disabled={mutation.isPending}
                            onClick={() => showEditor(job)}
                        >
                            Edit
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={mutation.isPending}
                            onClick={() => setDeleting(job)}
                        >
                            Delete
                        </Button>
                    </div>
                </div>
            ))}
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
                        Delete {deleting?.name} and its schedule? Running transfers will continue.
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
        </section>
    )
}
