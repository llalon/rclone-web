import { expect, test } from '@playwright/test'
import { loginUrl } from './helpers'

test.beforeEach(async ({ page }) => {
    await page.route('**/operations/about', (route) => route.fulfill({ json: {} }))
})

test('creates, edits, triggers, and deletes a named job', async ({ page }) => {
    let jobs: { name: string; schedule: string; payload: { command: string } }[] = []
    let runs = 0
    await page.route('**/api/jobs**', async (route) => {
        const request = route.request()
        const path = new URL(request.url()).pathname
        if (path.endsWith('/run')) {
            runs += 1
            await route.fulfill({ status: 202, json: { state: 'queued' } })
        } else if (request.method() === 'GET') {
            await route.fulfill({ json: jobs })
        } else if (request.method() === 'DELETE') {
            jobs = []
            await route.fulfill({ status: 204 })
        } else {
            jobs = [request.postDataJSON()]
            await route.fulfill({ status: request.method() === 'POST' ? 201 : 200, json: jobs[0] })
        }
    })
    await page.goto(loginUrl())
    await page.getByRole('link', { name: 'Jobs', exact: true }).click()
    await page.getByRole('button', { name: 'New job', exact: true }).click()
    await page.getByLabel('Name', { exact: true }).fill('Documents Backup')
    await page.getByLabel('Cron schedule').fill('0 3 * * *')
    await page.getByLabel('Command JSON').fill('{invalid')
    await page.getByRole('button', { name: 'Save job' }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
    await page
        .getByLabel('Command JSON')
        .fill(
            '{"command":"sync/copy","command_args":{"srcFs":"/share/docs","dstFs":"remote:backup"}}'
        )
    await page.getByRole('button', { name: 'Save job' }).click()
    await expect(page.getByRole('heading', { name: 'Documents Backup' })).toBeVisible()
    expect(jobs[0].schedule).toBe('0 3 * * *')
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await expect(page.getByText('Job queued')).toBeVisible()
    expect(runs).toBe(1)
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.getByLabel('Name', { exact: true })).toBeDisabled()
    await page.getByLabel('Cron schedule').fill('')
    await page.getByRole('button', { name: 'Save job' }).click()
    await expect(page.getByText('Manual only')).toBeVisible()
    await page.goto(loginUrl())
    await page.getByRole('link', { name: 'Jobs', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Documents Backup' })).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.getByRole('button', { name: 'Delete job', exact: true }).click()
    await expect(page.getByText('No jobs yet.', { exact: false })).toBeVisible()
})

test('shows errors loading and saving named jobs', async ({ page }) => {
    let failLoad = true
    await page.route('**/api/jobs**', async (route) => {
        if (route.request().method() === 'GET') {
            await route.fulfill(
                failLoad ? { status: 503, json: { error: 'Service unavailable' } } : { json: [] }
            )
        } else {
            await route.fulfill({ status: 400, json: { error: 'Invalid cron schedule' } })
        }
    })
    await page.goto(loginUrl())
    await page.getByRole('link', { name: 'Jobs', exact: true }).click()
    await expect(page.getByText('Could not load named jobs:', { exact: false })).toBeVisible()
    failLoad = false
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await page.getByRole('button', { name: 'New job', exact: true }).click()
    await page.getByLabel('Name', { exact: true }).fill('Backup')
    await page.getByLabel('Cron schedule').fill('invalid')
    await page.getByRole('button', { name: 'Save job' }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Invalid cron schedule')
})

test('combines saved and running jobs and switches the same action between Stop and Run', async ({
    page,
}) => {
    let active = [41, 42, 99]
    let savedIDs = [41, 42]
    const stopped: number[] = []
    let definitionsLoaded = 0
    let runsLoaded = 0
    await page.route('**/api/jobs**', async (route) => {
        if (route.request().url().endsWith('/run')) {
            active = [53, 99]
            savedIDs = [53]
            await route.fulfill({ status: 202, json: { state: 'queued' } })
        } else {
            definitionsLoaded += 1
            await route.fulfill({
                json: [
                    {
                        name: 'Documents Backup',
                        schedule: '0 3 * * *',
                        payload: { command: 'sync/copy' },
                        running_job_ids: savedIDs,
                    },
                ],
            })
        }
    })
    await page.route('**/job/list', async (route) => {
        runsLoaded += 1
        await route.fulfill({ json: { jobids: active, runningIds: active } })
    })
    await page.route('**/job/status', (route) =>
        route.fulfill({
            json: {
                id: route.request().postDataJSON().jobid,
                finished: false,
                startTime: new Date().toISOString(),
            },
        })
    )
    await page.route('**/core/stats', (route) =>
        route.fulfill({ json: { bytes: 50, totalBytes: 100, speed: 10 } })
    )
    await page.route('**/job/stop', async (route) => {
        const id = route.request().postDataJSON().jobid as number
        stopped.push(id)
        active = active.filter((value) => value !== id)
        await route.fulfill({ json: {} })
    })
    await page.goto(loginUrl())
    await page.getByRole('link', { name: 'Jobs', exact: true }).click()
    const row = page
        .getByRole('row')
        .filter({ has: page.getByRole('heading', { name: 'Documents Backup' }) })
    await expect(row.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(2)
    await expect(page.getByRole('heading', { name: 'Running jobs', exact: true })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Named jobs', exact: true })).toHaveCount(0)
    const actions = page.getByRole('button', { name: 'New job', exact: true }).locator('..')
    await expect(actions.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible()
    await row.getByRole('button', { name: 'Stop', exact: true }).click()
    await expect(row.getByRole('button', { name: 'Run', exact: true })).toBeEnabled()
    expect(stopped.sort()).toEqual([41, 42])
    await expect(page.locator('tbody tr')).toHaveCount(2)
    await row.getByRole('button', { name: 'Run', exact: true }).click()
    await expect(row.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
    await expect(page.locator('tbody tr')).toHaveCount(2)
    // Completion also restores Run without waiting for the queued-trigger timeout.
    active = [99]
    await expect(row.getByRole('button', { name: 'Run', exact: true })).toBeEnabled()
    const beforeDefinitions = definitionsLoaded
    const beforeRuns = runsLoaded
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect.poll(() => definitionsLoaded).toBeGreaterThan(beforeDefinitions)
    await expect.poll(() => runsLoaded).toBeGreaterThan(beforeRuns)
})
