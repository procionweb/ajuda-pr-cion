import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const routes = [...new Set(fs.readdirSync('src/routes', { recursive: true }).filter((p) => String(p).endsWith('.tsx')).flatMap((p) => {
  const source = fs.readFileSync(path.join('src/routes', String(p)), 'utf8');
  return [...source.matchAll(/createFileRoute\(["']([^"']+)["']\)/g)].map((m) => m[1].replace(/\/$/, '') || '/');
}))].filter((p) => !p.includes('$') && !p.startsWith('/api') && p !== '/login' && !p.includes('convite')).sort();

async function login(page) {
  await page.goto('/login');
  await page.locator('#login-email').fill(process.env.CRM_BOT_OPERATOR!);
  await page.locator('#login-password').fill(process.env.CRM_BOT_PASSWORD!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30000 });
}
async function inspect(page, info) {
  await expect(page.locator('body')).not.toContainText(/Não foi possível carregar o conteúdo|Application error|Internal Server Error/i);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 3);
  expect(overflow, 'A página ultrapassa a largura da tela').toBe(false);
  await info.attach('pagina', { body: Buffer.from(new URL(page.url()).pathname), contentType: 'text/plain' });
}

test('Login abre sem cortar a tela', async ({ page }, info) => {
  await page.goto('/login');
  await expect(page.locator('#login-email')).toBeVisible();
  await expect(page.locator('#login-password')).toBeVisible();
  await inspect(page, info);
});
test('Chamados exige autenticação', async ({ page }) => {
  await page.goto('/chamados');
  await expect(page).toHaveURL(/\/login/, { timeout: 30000 });
});
for (const route of routes) {
  test(`Navegação, abas e filtros: ${route}`, async ({ page }, info) => {
    test.skip(!process.env.CRM_BOT_OPERATOR || !process.env.CRM_BOT_PASSWORD, 'Configure uma conta de testes em .env.crm-bot.local');
    await login(page);
    // Esta exploração não grava registros. Testes de escrita ficam nas transações do banco.
    const blocked: string[] = [];
    await page.route('**/*', async (requestRoute) => {
      const req = requestRoute.request();
      const url = new URL(req.url());
      const writes = !['GET', 'HEAD', 'OPTIONS'].includes(req.method());
      const rpc = url.pathname.match(/\/rpc\/([^/]+)/)?.[1];
      const readRpc = rpc && /^(get_|list_|search_|resolve_|support_list|support_get|crm_list|crm_get|portal_get|portal_list)/.test(rpc);
      if (writes && !readRpc) {
        blocked.push(url.pathname);
        await requestRoute.abort('blockedbyclient');
      } else await requestRoute.continue();
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message.replace(/https?:\/\/\S+/g, '[URL]')));
    const response = await page.goto(route);
    expect(response?.status() || 200).toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).not.toBeEmpty();
    if (/acesso negado|sem permissão|não autorizado/i.test(await page.locator('body').innerText())) {
      test.skip(true, 'A conta configurada não tem permissão para esta página');
    }
    await inspect(page, info);
    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    for (let i = 0; i < count; i++) {
      if (await tabs.nth(i).isVisible() && await tabs.nth(i).isEnabled()) {
        await tabs.nth(i).click();
        await inspect(page, info);
      }
    }
    for (const input of await page.locator('input[placeholder]').all()) {
      const hint = await input.getAttribute('placeholder') || '';
      if (/buscar|pesquis|filtrar|busca rápida/i.test(hint) && await input.isVisible()) {
        await input.fill('__CRM_BOT_SEM_RESULTADOS__');
        await input.press('Enter');
        await inspect(page, info);
        await input.fill('');
      }
    }
    for (const select of await page.locator('select').all()) {
      if (!await select.isVisible()) continue;
      const options = await select.locator('option').all();
      if (options.length > 1) {
        await select.selectOption({ index: 1 });
        await inspect(page, info);
        await select.selectOption({ index: 0 });
      }
    }
    // Abrir filtros personalizados sem executar ações de gravação.
    for (const box of await page.getByRole('combobox').all()) {
      if (!await box.isVisible() || !await box.isEnabled()) continue;
      await box.click();
      const options = page.getByRole('option');
      if (await options.count()) {
        const first = options.first();
        if (await first.isVisible()) await first.click();
      }
      await page.keyboard.press('Escape');
      await inspect(page, info);
    }
    // Detalhes acessíveis por links, com limite para manter cada cenário finito.
    const details = await page.locator('a[href]').evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute('href') || '').filter((href) => /^\/(clientes|chamados|kanban)\/[^/?]+/.test(href) && !/novo|editar|excluir|convite/.test(href)))]);
    for (const detail of details.slice(0, 3)) {
      await page.goto(detail);
      await inspect(page, info);
      const innerTabs = page.getByRole('tab');
      for (let i = 0; i < await innerTabs.count(); i++) {
        if (await innerTabs.nth(i).isVisible()) { await innerTabs.nth(i).click(); await inspect(page, info); }
      }
    }
    await info.attach('ações-bloqueadas', { body: Buffer.from(JSON.stringify([...new Set(blocked)])), contentType: 'application/json' });
    expect(errors, 'Erros de execução JavaScript').toEqual([]);
  });
}
