import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto('http://localhost:8080/login');
  await page.waitForTimeout(2000);
  
  // Fill par sélecteur CSS
  await page.fill('input[type="email"]', 'admin@esono.app');
  await page.fill('input[type="password"]', 'EsonoAdmin2026!');
  
  // Trouver et cliquer le bouton submit
  const buttons = await page.locator('button[type="submit"], button:has-text("connecter")').all();
  console.log('Buttons found:', buttons.length);
  if (buttons.length > 0) await buttons[0].click();
  
  await page.waitForTimeout(3000);
  console.log('1. After login:', page.url());
  const isOnDashboard = page.url().includes('dashboard');
  console.log('2. Login success:', isOnDashboard ? 'YES' : 'NO');

  if (isOnDashboard) {
    const orgText = await page.locator('text=ESONO Legacy').count();
    console.log('3. Org switcher visible:', orgText > 0 ? 'YES' : 'NO');

    const adminTitle = await page.locator('text=Administration').count();
    console.log('4. SuperAdmin dashboard:', adminTitle > 0 ? 'YES' : 'NO');

    await page.goto('http://localhost:8080/admin/organizations');
    await page.waitForTimeout(2000);
    const orgCount = await page.locator('table tbody tr').count();
    console.log('5. Organizations in table:', orgCount);

    await page.goto('http://localhost:8080/admin/metering');
    await page.waitForTimeout(2000);
    const meteringTitle = await page.locator('text=Metering').count();
    console.log('6. Metering page:', meteringTitle > 0 ? 'YES' : 'NO');
  }

  await page.goto('http://localhost:8080/invitation/fake-token');
  await page.waitForTimeout(3000);
  const content = await page.content();
  console.log('7. Invitation error page:', content.includes('invalide') || content.includes('Invalid') ? 'YES' : 'NO');

  console.log('\nAll tests done!');
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await browser.close();
}
