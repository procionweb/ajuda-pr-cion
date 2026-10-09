# Notificações com o CRM fechado

O sino do CRM oferece **Ativar / testar notificações**. Cada navegador/dispositivo precisa conceder permissão e cadastrar sua inscrição uma vez. A inscrição se renova no login; sair da conta remove a inscrição deste navegador. Fechar a aba mantém a inscrição.

No iPhone/iPad, adicionar o CRM à Tela de Início e abrir pelo ícone antes de ativar os avisos. A entrega depende da conexão e das permissões do navegador/sistema.

Todas as novas linhas de `notifications` entram na fila, incluindo convites de todos os tipos de agendamento e notificações de membros do Kanban. Atividades novas dos cartões geram avisos para os membros do quadro e seu proprietário, exceto o autor. Lembretes de agendamento são gerados no servidor 30 minutos antes para os responsáveis, criadores e convidados com dispositivos inscritos.

O cron do banco chama `/api/notifications/dispatch` a cada minuto. Um token privado autentica o servidor; chaves VAPID privadas e token permanecem em uma tabela inacessível a usuários e visitantes. A fila possui leases, novas tentativas e remoção de inscrições expiradas. Não envia o histórico anterior à inscrição.

## Validação

```powershell
node scripts/test-background-push-browser.mjs
node --env-file=.env.local scripts/test-background-push.mjs
npm run build
```

O teste SQL reverte todas as alterações, incluindo o cron. O teste do navegador/servidor simula os serviços push e não envia avisos reais.

## Ativação

Após aprovação específica para configurar o banco de produção e publicação do código:

```powershell
node --env-file=.env.local scripts/setup-background-push.mjs --activate-production
```

O script preserva chaves já existentes e registra a migration. A URL de produção configurada é `https://ajuda-pr-cion.vercel.app/api/notifications/dispatch`. Para outro domínio, atualizar a URL de despacho na configuração privada. Não colocar chaves privadas ou o token em variáveis VITE, arquivos versionados ou logs.

Depois, ativar pelo sino e conferir o aviso de teste, inclusive após fechar a aba. Conferir o retorno HTTP do despacho e a fila para distinguir aceitação pelo serviço push de exibição efetiva no dispositivo.
