import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ListChecksIcon } from 'lucide-react'
import { toast } from 'sonner'
import { JobsTable } from '@/components/JobsTable'
import { PageContent } from '@/components/PageContent'
import { PageHeader } from '@/components/PageHeader'
import { PageWrapper } from '@/components/PageWrapper'
import { RefreshButton } from '@/components/RefreshButton'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { useT } from '@/lib/i18n'
import { fetchRunningJobs, stopJob } from '@/rclone/jobs'

export function JobsPage() {
    const t = useT()
    const queryClient = useQueryClient()

    const jobsQuery = useQuery({
        queryKey: ['runningJobs'],
        queryFn: fetchRunningJobs,
        refetchInterval: 1500,
    })

    const stopMutation = useMutation({
        mutationFn: stopJob,
        onSuccess: () => {
            toast.success(t('jobs.stopSuccess'))
            queryClient.invalidateQueries({ queryKey: ['runningJobs'] })
            queryClient.invalidateQueries({ queryKey: ['jobs'] })
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : t('common.unknownError')
            toast.error(t('jobs.stopError', { message }))
        },
    })

    const jobs = jobsQuery.data ?? []

    return (
        <PageWrapper>
            <PageHeader
                title={t('jobs.title')}
                description={t('jobs.description')}
                actions={
                    <RefreshButton isFetching={jobsQuery.isFetching} refetch={jobsQuery.refetch} />
                }
            />
            <PageContent>
                {jobsQuery.isPending ? (
                    <div className="flex items-center justify-center px-6 py-14">
                        <Spinner className="size-8" />
                    </div>
                ) : null}

                {jobsQuery.isError ? (
                    <Alert variant="destructive">
                        <AlertTitle>{t('jobs.loadError')}</AlertTitle>
                        <AlertDescription>
                            {jobsQuery.error instanceof Error
                                ? jobsQuery.error.message
                                : t('common.unknownError')}
                        </AlertDescription>
                        <AlertAction>
                            <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={() => {
                                    jobsQuery.refetch()
                                }}
                            >
                                {t('common.retry')}
                            </Button>
                        </AlertAction>
                    </Alert>
                ) : null}

                {jobsQuery.isSuccess && jobs.length === 0 ? (
                    <Empty className="rounded-xl border">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <ListChecksIcon />
                            </EmptyMedia>
                            <EmptyTitle>{t('jobs.emptyTitle')}</EmptyTitle>
                            <EmptyDescription>{t('jobs.emptyDescription')}</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : null}

                {jobs.length > 0 ? (
                    <JobsTable
                        jobs={jobs}
                        onStop={(jobid) => stopMutation.mutate(jobid)}
                        isStopping={stopMutation.isPending}
                    />
                ) : null}
            </PageContent>
        </PageWrapper>
    )
}
