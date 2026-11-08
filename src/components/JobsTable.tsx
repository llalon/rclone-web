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
import { cn } from '@/lib/ui'
import type { RunningJobRow } from '@/rclone/jobs'

const columnWidths = {
    id: 'w-[80px]',
    status: 'w-[112px]',
    started: 'w-[200px]',
    duration: 'w-[120px]',
    progress: 'w-[220px]',
    speed: 'w-[100px]',
    actions: 'w-[80px]',
} as const

export function JobsTable({
    jobs,
    onStop,
    isStopping,
}: {
    jobs: RunningJobRow[]
    onStop: (jobid: number) => void
    isStopping: boolean
}) {
    const t = useT()
    return (
        <div className="overflow-hidden rounded-xl border">
            <Table className="min-w-[912px] table-fixed text-xs">
                <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-muted/40">
                        <TableHead
                            className={cn(
                                columnWidths.id,
                                'h-9 px-2 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            {t('jobsTable.id')}
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.status,
                                'h-9 px-2 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            {t('transfersTable.status')}
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.started,
                                'h-9 px-2 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            {t('jobsTable.started')}
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.duration,
                                'h-9 px-2 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            {t('jobsTable.duration')}
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.progress,
                                'h-9 px-2 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            {t('transfersTable.progress')}
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.speed,
                                'h-9 px-2 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            {t('transfersTable.speed')}
                        </TableHead>
                        <TableHead
                            className={cn(
                                columnWidths.actions,
                                'h-9 px-2 text-left font-semibold text-muted-foreground'
                            )}
                        >
                            {t('transfersTable.actions')}
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {jobs.map((job) => (
                        <TableRow key={job.id} className="hover:bg-muted/20">
                            <TableCell
                                className={cn(
                                    columnWidths.id,
                                    'px-2 py-1.5 text-left font-mono font-medium text-muted-foreground tabular-nums align-middle'
                                )}
                            >
                                #{job.id}
                            </TableCell>

                            <TableCell
                                className={cn(
                                    columnWidths.status,
                                    'px-2 py-1.5 text-left align-middle'
                                )}
                            >
                                <div className="flex justify-start">
                                    <Badge
                                        className="h-6 gap-1 px-1.5 text-xs tracking-wide bg-emerald-500/15 text-emerald-500"
                                        variant="secondary"
                                    >
                                        <RefreshCwIcon className="size-3.5 animate-spin" />
                                        {t('transfersTable.running')}
                                    </Badge>
                                </div>
                            </TableCell>

                            <TableCell
                                className={cn(
                                    columnWidths.started,
                                    'px-2 py-1.5 text-left font-medium tabular-nums align-middle'
                                )}
                            >
                                {formatTime(job.startTime)}
                            </TableCell>

                            <TableCell
                                className={cn(
                                    columnWidths.duration,
                                    'px-2 py-1.5 text-left font-medium tabular-nums align-middle'
                                )}
                            >
                                {formatDuration(job.elapsedSeconds)}
                            </TableCell>

                            <TableCell
                                className={cn(
                                    columnWidths.progress,
                                    'px-2 py-1.5 text-left align-middle'
                                )}
                            >
                                {job.progress === null ? (
                                    <span className="text-muted-foreground">—</span>
                                ) : (
                                    <div className="w-full max-w-[204px] space-y-1">
                                        <div className="flex items-center justify-between gap-2 tabular-nums">
                                            <span className="font-medium">{job.progress}%</span>
                                            <span className="text-muted-foreground">
                                                {formatBytes(job.bytes)} /{' '}
                                                {formatBytes(job.totalBytes)}
                                            </span>
                                        </div>
                                        <div className="h-1 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full rounded-full transition-all bg-emerald-500"
                                                style={{ width: `${job.progress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </TableCell>

                            <TableCell
                                className={cn(
                                    columnWidths.speed,
                                    'px-2 py-1.5 text-left font-medium tabular-nums align-middle'
                                )}
                            >
                                {job.speed > 0 ? `${formatBytes(job.speed)}/s` : '—'}
                            </TableCell>

                            <TableCell
                                className={cn(
                                    columnWidths.actions,
                                    'px-2 py-1.5 text-left align-middle'
                                )}
                            >
                                <div className="flex justify-start">
                                    <Button
                                        size="xs"
                                        variant="destructive"
                                        disabled={isStopping}
                                        onClick={() => onStop(job.id)}
                                    >
                                        {t('common.stop')}
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
