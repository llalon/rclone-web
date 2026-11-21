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
    await page.getByRole('button', { name: 'Run now' }).click()
    await expect(page.getByText('Job queued via MQTT')).toBeVisible()
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
    await expect(page.getByText('No named jobs yet.', { exact: false })).toBeVisible()
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
