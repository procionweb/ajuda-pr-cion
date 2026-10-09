import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadEnvFile } from 'node:process';
for (const file of ['.env.local', '.env.crm-bot.local']) if (fs.existsSync(file)) loadEnvFile(file);
fs.mkdirSync('crm-bot-report', { recursive: true });
const results = [];
function run(name, args, command = process.execPath) {
  const diagnosticFile = `failure-${results.length}.txt`;
  const result = spawnSync(command, args, { encoding: 'utf8', env: process.env, timeout: 1800000 });
  const secrets = Object.entries(process.env).filter(([key, value]) => value && /PASSWORD|TOKEN|SECRET|DATABASE_URL|KEY/.test(key)).map(([, value]) => value);
  let diagnostic = (result.stderr || result.error?.message || '').replace(/https?:\/\/[^\s]+/g, '[URL]').replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[DATABASE_URL]');
  for (const secret of secrets) diagnostic = diagnostic.split(secret).join('[REDACTED]');
  if (diagnostic) fs.writeFileSync(`crm-bot-report/${diagnosticFile}`, diagnostic);
  results.push({ name, status: result.status === 0 ? 'passou' : 'falhou', exitCode: result.status, diagnostic: diagnostic ? diagnosticFile : undefined });
  console.log(`${name}: ${results.at(-1).status}`);
}
for (const [name, file, database] of [
  ['Chamados e timeline', 'scripts/crm-bot/ticket-lifecycle.mjs', true],
  ['Catálogos: criar, editar, excluir, restaurar e permissões', 'scripts/test-crm-catalog-database.mjs', true],
  ['Reserva e conflito de salas', 'scripts/test-room-availability.mjs', true],
  ['Notificações: banco e fila', 'scripts/test-background-push.mjs', true],
  ['Notificações com navegador fechado', 'scripts/test-background-push-browser.mjs', false],
]) {
  if (database && !process.env.DATABASE_URL) results.push({ name, status: 'pendente', reason: 'DATABASE_URL ausente' });
  else run(name, [file]);
}
run('Navegador desktop, tablet e mobile', ['node_modules/@playwright/test/cli.js', 'test']);
let browser;
try { browser = JSON.parse(fs.readFileSync('crm-bot-report/browser.json', 'utf8')).stats; } catch {}
if (browser?.skipped && results.at(-1).status === 'passou') { results.at(-1).status = 'parcial'; results.at(-1).reason = `${browser.skipped} cenários pendentes`; }
const report = { generatedAt: new Date().toISOString(), results, browser, cleanup: 'Todas as escritas são transacionais e revertidas. A exploração no navegador bloqueia requisições de escrita.', limitations: ['CRUD pela interface, arrastar cartões, anexos, convites reais e todos os perfis ainda não possuem cenários específicos.', 'Testes autenticados exigem uma conta de testes. Páginas sem permissão são marcadas como pendentes.'] };
fs.writeFileSync('crm-bot-report/summary.json', JSON.stringify(report, null, 2));
fs.writeFileSync('crm-bot-report/RESUMO.md', `# Relatório do bot CRM\n\n${results.map((r) => `- ${r.name}: ${r.status}${r.reason ? ` (${r.reason})` : ''}`).join('\n')}\n\nNavegador: ${JSON.stringify(browser || 'relatório indisponível')}\n\n${report.cleanup}\n\n## Cobertura pendente\n\n${report.limitations.map((x) => `- ${x}`).join('\n')}\n`);
console.log('Relatórios: crm-bot-report/RESUMO.md e crm-bot-report/html/index.html');
process.exitCode = results.some((r) => r.status === 'falhou') ? 1 : 0;
