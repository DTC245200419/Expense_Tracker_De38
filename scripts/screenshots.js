'use strict';
// Chup anh minh chung cho bao cao bang headless Chrome (Puppeteer) chay trong container.
// Chay:  sh scripts/screenshots.sh   (xem file .sh de biet cach mount va bien moi truong)
// Ket qua: docs/evidence/images/*.png

const puppeteer = require('puppeteer');
const fs = require('fs');

const HOST = process.env.TARGET_HOST || 'host.docker.internal';
const OUT = process.env.OUT_DIR || '/work/docs/evidence/images';
const WEB = process.env.WEB_BASE || `https://${HOST}:8443`;
const PROM = `http://${HOST}:9090`;
const GRAF = `http://${HOST}:3000`;
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const GRAFANA_PASSWORD = process.env.GRAFANA_ADMIN_PASSWORD || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'https://github.com/DTC245200419/Expense_Tracker_De38';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, opts = {}) {
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, fullPage: Boolean(opts.fullPage) });
  console.log('saved', file);
}

async function goto(page, url, waitMs = 1500) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(waitMs);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN || '/usr/bin/chromium-browser',
    headless: true,
    ignoreHTTPSErrors: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--ignore-certificate-errors', '--lang=vi-VN'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 820, deviceScaleFactor: 1.5 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8' });

  // 1. So do kien truc (file HTML trong docs/report)
  await page.setViewport({ width: 1260, height: 730, deviceScaleFactor: 2 });
  await goto(page, 'file:///work/docs/report/architecture.html', 500);
  await shot(page, 'h1-1-kien-truc');
  await page.setViewport({ width: 1366, height: 820, deviceScaleFactor: 1.5 });

  // 2. GitHub
  try {
    await goto(page, GITHUB_REPO, 2500);
    await shot(page, 'h2-1-github-repo');
    await goto(page, `${GITHUB_REPO}/commits/main`, 2500);
    await shot(page, 'h2-2-github-commits');
  } catch (e) { console.log('github skipped:', e.message); }

  // 3. Website: login, dashboard, transactions, reports, categories
  await goto(page, `${WEB}/login`);
  await shot(page, 'h2-4-web-login');
  if (ADMIN_PASSWORD) {
    await page.type('input[name="username"]', ADMIN_USER);
    await page.type('input[name="password"]', ADMIN_PASSWORD);
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), page.click('button[type="submit"]')]);
    await sleep(800);
    await shot(page, 'h2-3-web-dashboard');
    await goto(page, `${WEB}/transactions`);
    await shot(page, 'h2-5-web-transactions');
    await goto(page, `${WEB}/reports`);
    await shot(page, 'h2-6-web-reports', { fullPage: true });
    await goto(page, `${WEB}/categories`);
    await shot(page, 'h2-7-web-categories');
  } else {
    console.log('ADMIN_PASSWORD trong, bo qua cac trang sau dang nhap');
  }

  // 4. Prometheus targets
  await goto(page, `${PROM}/targets`, 2500);
  await shot(page, 'h4-1-prometheus-targets', { fullPage: true });

  // 5. Grafana: login, dashboard, Explore Loki x3
  if (GRAFANA_PASSWORD) {
    await goto(page, `${GRAF}/login`);
    await page.type('input[name="user"]', 'admin');
    await page.type('input[name="password"]', GRAFANA_PASSWORD);
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), page.click('button[type="submit"]')]);
    await sleep(1500);

    await page.setViewport({ width: 1366, height: 1480, deviceScaleFactor: 1.5 });
    await goto(page, `${GRAF}/d/de38-expense/expense-tracker?orgId=1&from=now-1h&to=now&kiosk`, 8000);
    await shot(page, 'h4-2-grafana-dashboard');

    await page.setViewport({ width: 1366, height: 1250, deviceScaleFactor: 1.5 });
    const queries = [
      ['h4-4-logql-nginx', '{job="nginx"}'],
      ['h4-5-logql-status-400', '{job="nginx"} | json | status >= 400'],
      ['h4-6-logql-login-failed', '{job="app"} | json | event="login_failed"'],
    ];
    for (const [name, expr] of queries) {
      const panes = {
        a: {
          datasource: 'loki',
          queries: [{ refId: 'A', expr, datasource: { type: 'loki', uid: 'loki' } }],
          range: { from: 'now-24h', to: 'now' },
        },
      };
      const url = `${GRAF}/explore?schemaVersion=1&orgId=1&panes=${encodeURIComponent(JSON.stringify(panes))}`;
      await goto(page, url, 5000);
      await shot(page, name);
    }
  } else {
    console.log('GRAFANA_ADMIN_PASSWORD trong, bo qua Grafana');
  }

  await browser.close();
  console.log('Xong.');
})().catch((err) => {
  console.error('Loi:', err);
  process.exit(1);
});
