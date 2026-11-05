const { expect } = require('@playwright/test');

const REQUIRED_LINE = 'This project demonstrates the automation of a large distributed system';
const AUTHOR = 'Subramanian Meenakshi';
const MAILTO = 'mailto:Subramanian.Meenakshi@Sandhata.com';

async function gotoAbout(page) {
  await page.goto('/about');
}

async function expectAboutContent(page) {
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
  await expect(page.getByText(REQUIRED_LINE)).toBeVisible();
  await expect(page.getByText(AUTHOR)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Subramanian.Meenakshi@Sandhata.com' })).toHaveAttribute('href', MAILTO);
}

module.exports = { gotoAbout, expectAboutContent, REQUIRED_LINE, AUTHOR, MAILTO };
