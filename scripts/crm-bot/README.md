# Bot de testes do CRM

Execute `npm run bot:install` uma vez e depois `npm run bot:test`.

Copie `.env.crm-bot.example` para `.env.crm-bot.local` e preencha a conta de testes para explorar as páginas internas. Use uma conta dedicada. `DATABASE_URL` em `.env.local` ativa os testes do banco.

O relatório fica em `crm-bot-report/RESUMO.md`; o relatório visual em `crm-bot-report/html/index.html`, com capturas das falhas e motivos das etapas ignoradas. Arquivos de configuração local e relatórios não vão para o Git.

O bot testa login, proteção de acesso, páginas estáticas descobertas no código, abas acessíveis, buscas, filtros nativos, erros JavaScript e largura em desktop/tablet/mobile. No banco testa o ciclo de chamados, timeline e finalização, catálogos e permissões, conflitos de salas e notificações. Todas as criações acontecem dentro de transações revertidas, inclusive em falha; fechar a conexão também causa rollback. O ciclo de chamado confirma que seus registros desapareceram. A exploração no navegador bloqueia gravações: ações bloqueadas aparecem no relatório.

Não há exclusão geral ou restauração de snapshots. Não é necessário apagar registros manualmente. O bot não envia convites nem notificações reais.

Ainda precisam de cenários específicos: CRUD pela interface, detalhes dinâmicos, filtros personalizados, anexos, Kanban com arrastar cartões, frota completa, todas as combinações de permissões e entrega real de notificações nos dispositivos. Um teste ignorado não significa funcionalidade aprovada. Esta primeira versão não certifica todas as funcionalidades do CRM.
