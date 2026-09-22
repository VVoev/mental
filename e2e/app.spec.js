const { test, expect } = require('@playwright/test');
const replies = require('./fixtures/replies.json');
const issue = 'Обмислям нова работа и искам да изясня приоритетите си.';

test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    if (host === '127.0.0.1' || host === 'localhost') return route.continue();
    return route.abort('blockedbyclient');
  });
});
async function start(page, text = issue) {
  await page.goto('/');
  await page.getByLabel('На колко години си?').fill('30');
  await page.getByLabel('Кое решение обмисляш?').fill(text);
  await page.getByRole('button', { name: 'Започни', exact: true }).click();
}

test('adult flow, optional goal, reflection sheet and complete reset', async ({ page }) => {
  await start(page);
  await expect(page.getByText(replies.opening)).toBeVisible();
  await expect(page.getByText('Локално демо', { exact: false })).toBeVisible();
  await page.getByLabel('Моята цел (незадължително)').fill('Да изясня приоритетите си');
  await page.getByLabel('Твоето съобщение', { exact: true }).fill('Искам повече време за себе си.');
  const outgoing = page.waitForRequest(r => r.url().endsWith('/message') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Изпрати', exact: true }).click();
  expect((await outgoing).postDataJSON().goal).toBe('Да изясня приоритетите си');
  await expect(page.getByText(replies.reflect)).toBeVisible();
  await page.getByRole('button', { name: 'Моята равносметка' }).click();
  await expect(page.getByLabel('Какво съм описал', { exact: true })).toHaveValue(issue);
  await page.getByLabel('Мои предположения', { exact: true }).fill('Предполагам, че новият график е по-гъвкав.');
  await page.getByLabel('Какво още не знам', { exact: true }).fill('Какъв е действителният график?');
  await page.getByRole('button', { name: 'Затвори', exact: true }).click();
  await page.getByRole('button', { name: 'Приключи и изчисти' }).click();
  await expect(page.getByLabel('Кое решение обмисляш?')).toHaveValue('');
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  await expect(page.getByRole('log')).toHaveCount(0);
});

test('underage gate and visible disclaimer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Това не е терапия', { exact: false })).toBeVisible();
  await page.getByLabel('На колко години си?').fill('17');
  await page.getByLabel('Кое решение обмисляш?').fill(issue);
  await page.getByRole('button', { name: 'Започни', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('пълнолетни');
  await expect(page.getByRole('log')).toHaveCount(0);
});

test('crisis fixture preserves readable clickable resources', async ({ page }) => {
  await start(page, 'Не искам да живея');
  await expect(page.getByRole('log')).toContainText('Мислиш ли за това сега?');
  await expect(page.getByRole('log').getByRole('link', { name: '112', exact: true })).toHaveAttribute('href', 'tel:112');
});

test('failed reply is explicit and retry does not duplicate user turn', async ({ page }) => {
  await start(page, '[demo:error]');
  await expect(page.getByRole('alert')).toContainText('не завърши');
  await page.getByRole('button', { name: 'Опитай отново', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('не завърши');
  await expect(page.getByRole('article', { name: 'Съобщение от теб', exact: true })).toHaveCount(1);
});

test('stop and end during generation, then restart without late content', async ({ page }) => {
  await start(page, '[demo:slow]');
  await page.getByRole('button', { name: 'Спри отговора', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('спрян');
  await page.getByRole('button', { name: 'Приключи и изчисти' }).click();
  await expect(page.getByLabel('Кое решение обмисляш?')).toHaveValue('');
  await start(page);
  await expect(page.getByText(replies.opening)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Кое решение обмисляш?')).toHaveValue('');
});

test('server deadline yields a visible failure', async ({ page }) => {
  await start(page, '[demo:slow]');
  await expect(page.getByRole('alert')).toContainText('не завърши');
});

test('empty stream is never marked complete', async ({ page }) => {
  await start(page, '[demo:empty]');
  await expect(page.getByRole('alert')).toContainText('не завърши');
});

test('reflection copy is deliberate and preserves user edits', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await start(page);
  await expect(page.getByText(replies.opening)).toBeVisible();
  await page.getByRole('button', { name: 'Моята равносметка' }).click();
  await page.getByLabel('Какво съм описал', { exact: true }).fill('Моя редакция');
  await page.getByRole('button', { name: 'Копирай равносметката' }).click();
  await expect(page.getByRole('status')).toHaveText('Копирано.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Моя редакция');
});
