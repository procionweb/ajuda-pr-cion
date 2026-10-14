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
test("Clientes: cliente e empresa têm campos separados, com gravação simulada", async ({
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
      active: true,
      source_payload: { cli_status: "1", empresa_id_emp: "1", cli_obs: "Atividades do cliente" },
    },
    companies: [
      {
        id: "00000000-0000-4000-8000-000000000002",
        company_number: 1,
        legal_name: "Empresa de teste LTDA",
        trade_name: "Empresa de teste",
        document: "12345678000190",
        industry: "1",
        size: "P",
        responsible_name: "Responsável de teste",
        source_payload: {
          tcl_responsavel: '{"cli_res_rg":"12345","cli_res_cidade":"São Carlos"}',
          tcl_contador: '{"cli_ctd_nome":"Escritório de teste","cli_ctd_res":"Contador de teste"}',
          tcl_modulos: '{"1":""}',
        },
      },
    ],
    contacts: [],
    internet: { status: 1, devices: 2 },
    webApps: ["MOB", "WEB"],
  };
  const saved: any[] = [];
  await page.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const rpc = url.pathname.match(/\/rpc\/([^/]+)/)?.[1];
    if (url.hostname === "viacep.com.br")
      return route.fulfill({
        json: {
          logradouro: "Rua CEP automático",
          localidade: "São Carlos",
          uf: "SP",
          bairro: "Centro",
        },
      });
    if (url.pathname.endsWith("/crm_accountants"))
      return route.fulfill({
        json: [
          {
            id: "00000000-0000-4000-8000-000000000009",
            name: "Contador cadastrado",
            office: "Escritório cadastrado",
            phone: "16999999999",
            email: "contador@example.invalid",
          },
        ],
      });
    if (rpc === "get_current_portal_access")
      return route.fulfill({
        json: [
          { portal_profile: "s_admin", collaborator_department: "admin", operator_acronym: "BOT" },
        ],
      });
    if (rpc === "get_crm_client_edit_data_v2") return route.fulfill({ json: fixture });
    if (rpc === "save_crm_client_edit_v3") {
      saved.push(req.postDataJSON());
      return route.fulfill({ json: null });
    }
    if (rpc === "get_crm_client") {
      const acronym = req.postDataJSON().client_acronym;
      return route.fulfill({
        json: {
          client: { ...fixture.client, acronym },
          contacts: [],
          companies: fixture.companies.map((c) => ({ ...c, client_acronym: acronym })),
        },
      });
    }
    if (rpc === "get_crm_client_logs")
      return route.fulfill({ json: { authorized: true, logs: [], external_logs: [] } });
    if (rpc === "get_crm_client_ticket_activity")
      return route.fulfill({ json: { tickets: [], activities: [] } });
    if (rpc?.startsWith("get_crm_client_") && rpc !== "get_crm_client_listing_context")
      return route.fulfill({ json: [] });
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
  const modal = page.getByRole("dialog", { name: /^Editar (cliente|empresa)/ });
  await expect(modal.getByLabel("Nome (apelido)", { exact: true })).toHaveValue("Cliente de teste");
  expect(await modal.getByLabel("CNPJ", { exact: true }).count()).toBe(0);
  expect(await modal.getByLabel("Cadastro para editar").count()).toBe(0);
  expect(await modal.getByText("Aplicações web", { exact: true }).count()).toBe(0);
  await expect(modal.getByLabel("Atividades")).toHaveValue("Atividades do cliente");
  await modal.getByLabel("Campinas", { exact: true }).check();
  await modal.getByRole("button", { name: "Adicionar telefone", exact: true }).click();
  await modal.getByLabel("Telefone 1", { exact: true }).fill("11999999999");
  await modal.getByLabel("Contato do telefone 1", { exact: true }).fill("Contato bot");
  await modal.getByRole("button", { name: "Adicionar e-mail", exact: true }).click();
  await modal.getByLabel("E-mail 1", { exact: true }).fill("fixture@example.invalid");
  await modal.getByRole("button", { name: "Remover e-mail 1", exact: true }).click();
  await modal.getByRole("tab", { name: "Internet", exact: true }).click();
  await expect(modal.getByLabel("Quantidade de dispositivos")).toHaveValue("2");
  await modal.getByLabel("Quantidade de dispositivos").fill("5");
  await modal.getByLabel("Status da Internet").selectOption("2");
  await page.screenshot({ path: info.outputPath("editar-cliente.png") });
  await modal.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(modal).not.toBeVisible();
  expect(saved[0].p_company_id).toBeNull();
  expect(saved[0].p_internet).toEqual({ status: 2, devices: 5 });
  expect(saved[0].p_source_patch.empresa_id_emp).toBe("25");
  expect(saved[0].p_contacts.some((c: any) => c.phone === "11999999999")).toBe(true);
  await page
    .locator(".clients-list-table tbody tr")
    .first()
    .locator('td[data-label="Nome / perfil"]')
    .click();
  const companyEdit = page.getByRole("button", { name: "Editar dados da empresa", exact: true });
  await expect(companyEdit).toBeVisible({ timeout: 30000 });
  await companyEdit.click();
  await expect(modal.getByLabel("CNPJ", { exact: true })).toHaveValue("12345678000190");
  await expect(modal.getByLabel("RG do responsável", { exact: true })).toHaveValue("12345");
  await expect(modal.getByLabel("Escritório de contabilidade", { exact: true })).toHaveValue(
    "Escritório de teste",
  );
  expect(await modal.getByLabel("Nome (apelido)", { exact: true }).count()).toBe(0);
  expect(await modal.getByText("Módulos e cobrança da empresa", { exact: true }).count()).toBe(0);
  await expect(modal.getByRole("checkbox", { name: "Hádron Mobile", exact: true })).toBeChecked();
  await modal.getByRole("checkbox", { name: "Hádron Web", exact: true }).uncheck();
  await modal.getByLabel("CEP", { exact: true }).fill("13560001");
  await expect(modal.getByLabel("CEP", { exact: true })).toHaveValue("13560-001");
  await expect(modal.getByLabel("Endereço", { exact: true })).toHaveValue("Rua CEP automático");
  await modal.getByRole("combobox").filter({ hasText: "Contador de teste" }).click();
  await page.getByRole("button", { name: /Contador cadastrado.*Escritório cadastrado/ }).click();
  await expect(modal.getByLabel("Contador responsável", { exact: true })).toHaveValue(
    "Contador cadastrado",
  );
  await page.screenshot({ path: info.outputPath("editar-empresa.png") });
  const bounds = await modal.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.height).toBeLessThanOrEqual(viewport.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 3)).toBe(
    true,
  );
  await modal.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(modal).not.toBeVisible();
  expect(saved[1].p_company_id).toBe(fixture.companies[0].id);
  expect(saved[1].p_contacts).toBeNull();
  expect(saved[1].p_web_apps).toEqual(["MOB"]);
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

test("Clientes: recupera falhas temporárias e isola abas indisponíveis", async ({ page }) => {
  test.skip(
    !process.env.CRM_BOT_OPERATOR || !process.env.CRM_BOT_PASSWORD,
    "Conta não configurada",
  );
  test.setTimeout(120000);
  let coreCalls = 0,
    logsCalls = 0;
  await page.route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      rpc = url.pathname.match(/\/rpc\/([^/]+)/)?.[1];
    if (rpc === "get_crm_client") {
      coreCalls++;
      if (coreCalls <= 2)
        return route.fulfill({
          status: 503,
          json: { code: "PGRST001", message: "Temporary connection failure" },
        });
      return route.fulfill({
        json: {
          client: {
            acronym: req.postDataJSON().client_acronym,
            name: "Cliente recuperado",
            legal_name: "Cliente recuperado",
            active: true,
          },
          contacts: [],
          companies: [],
        },
      });
    }
    if (rpc === "get_crm_client_params")
      return route.fulfill({ status: 500, json: { code: "57014", message: "statement timeout" } });
    if (rpc === "get_crm_client_logs") {
      logsCalls++;
      if (logsCalls === 1)
        return route.fulfill({
          status: 503,
          json: { code: "PGRST001", message: "Temporary connection failure" },
        });
      return route.fulfill({ json: { authorized: true, logs: [], external_logs: [] } });
    }
    if (rpc?.startsWith("get_crm_client_") && rpc !== "get_crm_client_listing_context")
      return route.fulfill({ json: [] });
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
  await page
    .locator(".clients-list-table tbody tr")
    .first()
    .locator('td[data-label="Nome / perfil"]')
    .click();
  await expect(page.getByRole("alert").filter({ hasText: "Parte dos dados" })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("Cliente recuperado", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Erro ao carregar cliente", { exact: true })).not.toBeVisible();
  expect(coreCalls).toBe(3);
  expect(logsCalls).toBe(0);
  await page.getByRole("tab", { name: "Logs", exact: true }).click();
  await expect(page.getByText("Carregando logs...", { exact: true })).not.toBeVisible({
    timeout: 10000,
  });
  expect(logsCalls).toBe(2);
  await page.getByRole("tab", { name: "Cliente", exact: true }).click();
  expect(coreCalls).toBe(3);
});
