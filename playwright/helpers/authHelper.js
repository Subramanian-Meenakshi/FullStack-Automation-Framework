const { users } = require('../data/users');

async function loginUi(page, role) {
  const u = users[role];
  await page.goto('/login');
  await page.getByLabel('Username').fill(u.username);
  await page.getByLabel('Password').fill(u.password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
}

async function logoutUi(page) {
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.waitForURL(/\/login/);
}

module.exports = { loginUi, logoutUi };
