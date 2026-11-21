import { RefreshCwIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { formatBytes, formatDuration, formatTime } from '@/lib/format'
import { useT } from '@/lib/i18n'
import type { RunningJobRow } from '@/rclone/jobs'
import type { NamedJob } from '@/rclone/named-jobs'

export type JobDisplayRow = {
    key: string
    definition?: NamedJob
    runs: RunningJobRow[]
}

export function JobsTable({
    jobs,
    onRun,
    onStop,
    onEdit,
    onDelete,
    isBusy,
    canRun,
    queued,
}: {
    jobs: JobDisplayRow[]
    onRun: (job: NamedJob) => void
    onStop: (job: JobDisplayRow) => void
    onEdit: (job: NamedJob) => void
    onDelete: (job: NamedJob) => void
    isBusy: boolean
    canRun: boolean
    queued: Record<string, number>
}) {
    const t = useT()
    return (
        <div className="overflow-hidden rounded-xl border">
            <Table className="min-w-[1050px] text-xs">
                <TableHeader className="bg-muted/40">
                    <TableRow>
                        <TableHead className="w-[240px]">Job</TableHead>
                        <TableHead>{t('transfersTable.status')}</TableHead>
                        <TableHead>{t('jobsTable.started')}</TableHead>
                        <TableHead>{t('jobsTable.duration')}</TableHead>
                        <TableHead className="w-[220px]">{t('transfersTable.progress')}</TableHead>
                        <TableHead>{t('transfersTable.speed')}</TableHead>
                        <TableHead>{t('transfersTable.actions')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {jobs.map((row) => {
                        const job = row.definition
                        const running = row.runs.length > 0
                        const waiting = Boolean(job && queued[job.name] > Date.now() && !running)
                        const bytes = row.runs.reduce((sum, run) => sum + run.bytes, 0)
                        const total = row.runs.reduce((sum, run) => sum + run.totalBytes, 0)
                        const speed = row.runs.reduce((sum, run) => sum + run.speed, 0)
                        const progress =
                            total > 0 ? Math.min(100, Math.round((bytes / total) * 100)) : null
                        const latest = row.runs[0]
                        return (
                            <TableRow key={row.key}>
                                <TableCell className="max-w-[280px] whitespace-normal">
                                    <h3 className="font-medium break-all">
                                        {job?.name ?? 'Running job'}
                                    </h3>
                                    {job && (
                                        <>
                                            <p className="font-mono text-muted-foreground break-all">
                                                {job.schedule || 'Manual only'}
                                            </p>
                                            <p className="text-muted-foreground">
                                                {job.payload.command}
                                            </p>
                                        </>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant="secondary"
                                        className={
                                            running ? 'bg-emerald-500/15 text-emerald-500' : ''
                                        }
                                    >
                                        {running && (
                                            <RefreshCwIcon className="size-3.5 animate-spin" />
                                        )}
                                        {running
                                            ? t('transfersTable.running')
                                            : waiting
                                              ? 'Queued'
                                              : 'Stopped'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="tabular-nums">
                                    {latest ? formatTime(latest.startTime) : '—'}
                                </TableCell>
                                <TableCell className="tabular-nums">
                                    {latest
                                        ? formatDuration(
                                              Math.max(...row.runs.map((run) => run.elapsedSeconds))
                                          )
                                        : '—'}
                                </TableCell>
                                <TableCell>
                                    {progress === null ? (
                                        '—'
                                    ) : (
                                        <div className="space-y-1">
                                            <div className="flex justify-between gap-2 tabular-nums">
                                                <span>{progress}%</span>
                                                <span className="text-muted-foreground">
                                                    {formatBytes(bytes)} / {formatBytes(total)}
                                                </span>
                                            </div>
                                            <div className="h-1 overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className="h-full bg-emerald-500 transition-all"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="tabular-nums">
                                    {speed > 0 ? `${formatBytes(speed)}/s` : '—'}
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-2">
                                        <Button
                                            size="xs"
                                            variant={running ? 'destructive' : 'outline'}
                                            disabled={isBusy || (!running && (!canRun || waiting))}
                                            onClick={() => {
                                                if (running) onStop(row)
                                                else if (job) onRun(job)
                                            }}
                                        >
                                            {running ? t('common.stop') : 'Run'}
                                        </Button>
                                        {job && (
                                            <>
                                                <Button
                                                    size="xs"
                                                    variant="outline"
                                                    disabled={isBusy}
                                                    onClick={() => onEdit(job)}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    size="xs"
                                                    variant="destructive"
                                                    disabled={isBusy}
                                                    onClick={() => onDelete(job)}
                                                >
                                                    Delete
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}
