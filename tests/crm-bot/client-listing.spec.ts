import { test, expect } from "@playwright/test";

test("Clientes: filtros completos e edição separados sem gravar dados", async ({ page }, info) => {
  test.skip(
    !process.env.CRM_BOT_OPERATOR || !process.env.CRM_BOT_PASSWORD,
    "Conta de testes não configurada",
  );
  test.setTimeout(120000);
  await page.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const readRpc = url.pathname.match(/\/rpc\/([^/]+)/)?.[1];
    if (
      !["GET", "HEAD", "OPTIONS"].includes(method) &&
      !url.pathname.endsWith("/auth/v1/token") &&
      !(readRpc && /^(get_|list_|search_|resolve_|support_load_)/.test(readRpc))
    )
      return route.abort("blockedbyclient");
    await route.continue();
  });
  await page.goto("/login");
  await page.locator("#login-email").fill(process.env.CRM_BOT_OPERATOR!);
  await page.locator("#login-password").fill(process.env.CRM_BOT_PASSWORD!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30000 });
  const context = page.waitForResponse(
    (response) =>
      response.url().includes("/rpc/get_crm_client_listing_context") && response.status() === 200,
    { timeout: 60000 },
  );
  await page.goto("/clientes");
  await context;
  await expect(page.locator(".clients-list-table tbody tr").first()).toBeVisible();
  await page
    .getByRole("button", { name: /^Filtros/ })
    .first()
    .click();
  const filters = page.getByRole("dialog");
  await expect(filters.getByText("Filtros de clientes", { exact: true })).toBeVisible();
  await expect(filters.getByLabel("Criação · De")).toBeVisible();
  expect(await filters.locator("input[type=date]").count()).toBe(12);
  await filters.getByLabel("Possui boletos?").selectOption("yes");
  await filters.getByLabel("Cobrança (boletos)").fill("__CRM_BOT_SEM_RESULTADO__");
  await expect(filters.getByText("Fluxo de Caixa", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("filtros.png") });
  await filters.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page.getByText("Nenhum cliente encontrado com os filtros atuais.")).toBeVisible();
  await page
    .getByRole("button", { name: /^Filtros/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
});

// Dados e acesso simulados somente no navegador local; o banco mantém suas permissões reais.
test("Clientes: modais de cliente e empresa com dados simulados, sem gravação", async ({
  page,
}, info) => {
  test.skip(
    !process.env.CRM_BOT_OPERATOR || !process.env.CRM_BOT_PASSWORD,
    "Conta de testes não configurada",
  );
  test.setTimeout(120000);
  const fixture = {
    client: {
      id: "00000000-0000-4000-8000-000000000001",
      acronym: "BOT",
      name: "Cliente de teste",
      legal_name: "Cliente de teste LTDA",
      industry: "0",
      size: "P",
      active: true,
      source_payload: { cli_status: "1" },
    },
    companies: [
      {
        id: "00000000-0000-4000-8000-000000000002",
        company_number: 1,
        legal_name: "Empresa de teste LTDA",
        trade_name: "Empresa de teste",
        industry: "1",
        size: "P",
        source_payload: { tcl_modulos: '{"1":""}', tcl_boleto_dados: "[]" },
      },
    ],
    contacts: [],
  };
  await page.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.endsWith("/rpc/get_current_portal_access"))
      return route.fulfill({
        json: [
          { portal_profile: "s_admin", collaborator_department: "admin", operator_acronym: "BOT" },
        ],
      });
    if (url.pathname.endsWith("/rpc/get_crm_client_edit_data"))
      return route.fulfill({ json: fixture });
    const rpc = url.pathname.match(/\/rpc\/([^/]+)/)?.[1];
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method()) &&
      !url.pathname.endsWith("/auth/v1/token") &&
      !(rpc && /^(get_|list_|search_|resolve_|support_load_)/.test(rpc))
    )
      return route.abort("blockedbyclient");
    await route.continue();
  });
  await page.goto("/login");
  await page.locator("#login-email").fill(process.env.CRM_BOT_OPERATOR!);
  await page.locator("#login-password").fill(process.env.CRM_BOT_PASSWORD!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30000 });
  await page.goto("/clientes");
  const edit = page.getByRole("button", { name: /^Editar cliente / }).first();
  await expect(edit).toBeVisible({ timeout: 30000 });
  await edit.click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByLabel("Nome do cliente", { exact: true })).toHaveValue(
    "Cliente de teste",
  );
  await page.screenshot({ path: info.outputPath("editar-cliente.png") });
  await modal.getByLabel("Cadastro para editar").selectOption({ index: 1 });
  await expect(modal.getByText("Módulos e cobrança da empresa", { exact: true })).toBeVisible();
  await expect(modal.getByLabel("Razão social", { exact: true })).toHaveValue(
    "Empresa de teste LTDA",
  );
  await page.screenshot({ path: info.outputPath("editar-empresa.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 3)).toBe(
    false,
  );
  const bounds = await modal.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.height).toBeLessThanOrEqual(viewport.height);
  await modal.getByLabel("Razão social", { exact: true }).fill("Empresa de teste editada");
  await expect(modal.getByLabel("Cadastro para editar")).toBeDisabled();
  await modal.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(modal).not.toBeVisible();
});

test("Clientes: abertura imediata e listagem sem rolagem horizontal", async ({ page }) => {
  test.skip(
    !process.env.CRM_BOT_OPERATOR || !process.env.CRM_BOT_PASSWORD,
    "Conta de testes não configurada",
  );
  test.setTimeout(120000);
  await page.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const rpc = url.pathname.match(/\/rpc\/([^/]+)/)?.[1];
    if (rpc === "get_crm_client") {
      const acronym = req.postDataJSON().client_acronym;
      await new Promise((resolve) => setTimeout(resolve, 8000));
      return route.fulfill({
        json: {
          client: {
            acronym,
            name: "Teste de abertura",
            legal_name: "Teste de abertura",
            active: true,
          },
          companies: [],
          contacts: [],
        },
      });
    }
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method()) &&
      !url.pathname.endsWith("/auth/v1/token") &&
      !(rpc && /^(get_|list_|search_|resolve_|support_load_)/.test(rpc))
    )
      return route.abort("blockedbyclient");
    await route.continue();
  });
  await page.goto("/login");
  await page.locator("#login-email").fill(process.env.CRM_BOT_OPERATOR!);
  await page.locator("#login-password").fill(process.env.CRM_BOT_PASSWORD!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30000 });
  await page.goto("/clientes");
  const table = page.locator(".clients-list-table");
  await expect(table.locator("tbody tr").first()).toBeVisible();
  expect(await page.getByRole("link", { name: /^Visualizar cliente / }).count()).toBe(0);
  expect(
    await table.evaluate((t) => t.parentElement!.scrollWidth <= t.parentElement!.clientWidth + 2),
  ).toBe(true);
  await table.locator("tbody tr").first().locator('td[data-label="Nome / perfil"]').click();
  await expect(
    page.getByRole("status").filter({ hasText: "Carregando detalhes do cliente..." }),
  ).toBeVisible({ timeout: 3000 });
  await expect(
    page.getByRole("status").filter({ hasText: "Carregando detalhes do cliente..." }),
  ).not.toBeVisible({ timeout: 20000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 3)).toBe(
    true,
  );
});
