import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('adds and persists a task, navigates, and applies dark theme', async ({ page }) => {
  const taskTitle = `浏览器任务 ${Date.now()}`;
  await page.getByLabel('快速添加任务').fill(taskTitle);
  await page.getByRole('button', { name: '添加任务', exact: true }).click();
  await expect(page.getByText(taskTitle)).toBeVisible();

  await page.reload();
  await expect(page.getByText(taskTitle)).toBeVisible();

  await page.getByLabel('切换深色模式').click();
  await expect(page.locator('.app-frame')).toHaveClass(/theme-dark/);
  await expect(page.locator('.app-frame')).toHaveCSS('background-color', 'rgb(25, 30, 28)');

  if (await page.getByLabel('打开导航').isVisible()) await page.getByLabel('打开导航').click();
  await page.getByLabel('日历').click();
  await expect(page.getByRole('heading', { name: /年.*月/ })).toBeVisible();
});

test('keeps the mobile layout within the viewport and opens navigation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await expect(page.getByLabel('打开导航')).toBeVisible();
  await page.getByLabel('打开导航').click();
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();

  const metrics = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(metrics.width).toBeLessThanOrEqual(metrics.viewport);
});

test('completes one pomodoro and starts break manually', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.addInitScript(() => { window.__RIXU_TEST_CLOCK__ = { now: '2026-08-31T08:00:00.000Z' }; });
  await page.reload();

  await page.getByLabel('开始专注').click();
  await page.getByLabel('专注主题').fill('浏览器专注');
  await page.getByRole('spinbutton', { name: '专注分钟' }).fill('1');
  await page.getByRole('dialog', { name: '开始一段专注' }).getByRole('button', { name: '开始专注' }).click();
  await expect(page.getByRole('region', { name: '专注模式' })).toBeVisible();
  await page.evaluate(() => { window.__RIXU_TEST_CLOCK__.now = '2026-08-31T08:01:01.000Z'; });

  await expect(page.getByText('本轮完成')).toBeVisible();
  await page.getByRole('button', { name: '开始休息' }).click();
  await expect(page.getByText('休息中')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('rixu-focus:v1')).state.records.length)).toBe(1);
});

test('restores a paused mobile stopwatch in the mini bar without overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.addInitScript(() => { window.__RIXU_TEST_CLOCK__ = { now: '2026-08-31T08:00:00.000Z' }; });
  await page.reload();

  await page.getByLabel('开始专注').click();
  await page.getByRole('button', { name: '自由计时' }).click();
  await page.getByLabel('专注主题').fill('移动阅读');
  await page.getByRole('dialog', { name: '开始一段专注' }).getByRole('button', { name: '开始专注' }).click();
  await page.getByRole('button', { name: '暂停' }).click();
  await expect(page.getByText('已暂停')).toBeVisible();
  await page.getByRole('button', { name: '退出沉浸模式' }).click();
  await expect(page.getByRole('complementary', { name: '活动专注计时' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('complementary', { name: '活动专注计时' })).toContainText('已暂停');
  const metrics = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(metrics.width).toBeLessThanOrEqual(metrics.viewport);
});
