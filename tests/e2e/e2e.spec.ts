import { test, expect, Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import XLSX from 'xlsx';

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? '';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? '';
const teacherEmail = process.env.E2E_TEACHER_EMAIL ?? '';
const teacherPassword = process.env.E2E_TEACHER_PASSWORD ?? '';

const sharedState: {
  sectionId: string;
  tableId: string;
  fileId: string;
  fileName: string;
} = {
  sectionId: '',
  tableId: '',
  fileId: '',
  fileName: '',
};

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await Promise.all([
    page.waitForURL('**/'),
    page.getByRole('button', { name: 'Login' }).click(),
  ]);
}

async function createExcelFixture(testId: string, testOutputDir: string) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet([
    { name: 'Alice', score: 10 },
    { name: 'Bob', score: 20 },
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Data');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  const filePath = path.join(testOutputDir, `${testId}-import.xlsx`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

function ensureEnvVars() {
  const missing: string[] = [];
  if (!adminEmail || !adminPassword) missing.push('E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD');
  if (!teacherEmail || !teacherPassword) missing.push('E2E_TEACHER_EMAIL/E2E_TEACHER_PASSWORD');
  if (missing.length > 0) {
    throw new Error(`Missing e2e env vars: ${missing.join(', ')}`);
  }
}

const uploadFixturePath = path.join(__dirname, '../fixtures/sample-upload.txt');

ensureEnvVars();

test.describe.serial('Critical user journeys', () => {
  test('admin can create section, upload file, import excel', async ({ page }, testInfo) => {
    await login(page, adminEmail, adminPassword);

    const sectionName = `E2E Раздел ${Date.now()}`;

    const createSectionForm = page.getByTestId('create-section-form');
    await createSectionForm.locator('input[name="title"]').fill(sectionName);
    await createSectionForm.locator('input[name="orderIndex"]').fill('0');
    await Promise.all([
      page.waitForTimeout(500),
      createSectionForm.getByRole('button', { name: '+ Создать раздел' }).click(),
    ]);

    const sectionsResponse = await page.request.get('/api/sections');
    expect(sectionsResponse.ok()).toBeTruthy();
    const sectionsPayload = (await sectionsResponse.json()) as {
      sections: Array<{ id: string; title: string }>;
    };
    const createdSection = sectionsPayload.sections.find((section) => section.title === sectionName);
    expect(createdSection).toBeTruthy();
    sharedState.sectionId = createdSection!.id;

    await page.goto(`/sections/${sharedState.sectionId}`);

    const uploadForm = page.getByTestId('file-upload-form');
    await uploadForm.locator('input[type="file"]').setInputFiles(uploadFixturePath);
    await Promise.all([
      page.waitForURL(`**/sections/${sharedState.sectionId}?**`),
      uploadForm.getByRole('button', { name: 'Загрузить' }).click(),
    ]);
    await expect(page.getByText('Файл загружен')).toBeVisible();

    const filesResponse = await page.request.get(`/api/sections/${sharedState.sectionId}/files`);
    expect(filesResponse.ok()).toBeTruthy();
    const filesPayload = (await filesResponse.json()) as {
      files: Array<{ id: string; original_name: string }>;
    };
    const uploadedFile = filesPayload.files.find((file) => file.original_name === 'sample-upload.txt');
    expect(uploadedFile).toBeTruthy();
    sharedState.fileId = uploadedFile!.id;
    sharedState.fileName = uploadedFile!.original_name;

    const excelPath = await createExcelFixture(testInfo.testId, testInfo.outputDir);
    const excelForm = page.getByTestId('excel-import-form');
    await excelForm.locator('input[name="file"]').setInputFiles(excelPath);
    await Promise.all([
      page.waitForURL(`**/sections/${sharedState.sectionId}/tables/**`),
      excelForm.getByRole('button', { name: 'Импортировать' }).click(),
    ]);
    await expect(page.getByText('Строки')).toBeVisible();

    const tableUrlMatch = page.url().match(/tables\/([^/?]+)/);
    expect(tableUrlMatch).not.toBeNull();
    sharedState.tableId = tableUrlMatch![1];
  });

  test('teacher can view section, download file and view table', async ({ page }) => {
    test.skip(!sharedState.sectionId || !sharedState.tableId || !sharedState.fileId, 'Admin scenario must succeed first');

    await login(page, teacherEmail, teacherPassword);

    await page.goto(`/sections/${sharedState.sectionId}`);
    await expect(page.getByText(sharedState.fileName)).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Скачать' }).first().click();
    const download = await downloadPromise;
    expect(await download.suggestedFilename()).toContain(path.parse(sharedState.fileName).name);

    await page.goto(`/sections/${sharedState.sectionId}/tables/${sharedState.tableId}`);
    await expect(page.getByText('Строки')).toBeVisible();
  });

  test('teacher write attempts are rejected with 403', async ({ page }) => {
    test.skip(!sharedState.sectionId, 'Admin scenario must succeed first');
    await login(page, teacherEmail, teacherPassword);

    const status = await page.evaluate(async () => {
      const response = await fetch('/api/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'forbidden by e2e', orderIndex: 0 }),
      });
      return response.status;
    });

    expect(status).toBe(403);
  });
});
