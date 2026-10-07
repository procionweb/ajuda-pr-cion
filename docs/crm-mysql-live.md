# Integração direta com a base MySQL de autenticação

## Estado e validação

Integração ativada e validada em 07/10/2026, após autorização explícita para substituir as cópias e usar TLS sem validação do certificado. Três conexões PostgreSQL autenticadas independentes confirmaram a inicialização do conector e os dados ao vivo. Os 217 eventos históricos criados exclusivamente no portal foram preservados; não foram encontrados vínculos quebrados nos parâmetros de usuários.

Os testes executaram a migração em transações revertidas e confirmaram:

- 203 usuários, 89 contratos, 5 aplicativos e 535 dispositivos diretamente do MySQL.
- Resolução de login, perfil do portal, operador e detalhes de clientes.
- Logs paginados, filtros sem resultados e ordenação por operador.
- Criação, edição e exclusão de um aplicativo no MySQL.
- Gravação e leitura de um log de opção no MySQL.
- Recusa de acesso anônimo à listagem de logs.

Os registros isolados dos testes de escrita foram excluídos usando marcadores únicos. Foram criados quatro índices no MySQL para data, controller, cliente e operador, com `ALGORITHM=INPLACE, LOCK=NONE`.

## O que muda na ativação

As cópias locais de `auth_usuarios`, `auth_contratos`, `auth_aplicativos` e `mob_dispositivos` são substituídas por views com os mesmos nomes, consultando o MySQL. Views não armazenam as linhas dessas tabelas. Os UUIDs atuais são preservados por uma tabela privada que guarda apenas a correspondência dos identificadores.

A cópia de `auth_logs` é removida. Os filtros, ordenação, contagem e paginação são executados no MySQL por RPCs. Somente os eventos históricos criados exclusivamente no portal são preservados em `crm_mysql.portal_logs`; novos eventos são gravados no MySQL.

`auth.users`, sessões, clientes, colaboradores e parâmetros permanecem no Supabase. Chaves estrangeiras para as antigas cópias são removidas preservando os valores; os vínculos são resolvidos pelos identificadores estáveis.

Os scripts antigos de importação de autenticação e internet recusam importar cópias depois da ativação. Os pontos de entrada do CRM mantêm suas assinaturas.

## Conexão e TLS

A conexão fica no Supabase Vault, com nome `crm_auth_mysql_connection`. Senhas, hashes de senha, tokens e campos de segredo não são expostos pelas views nem adicionados ao repositório.

O conector instalado precisa inicializar o provedor Rustls em cada backend PostgreSQL. `crm_mysql.ensure_tls()` faz isso planejando (`EXPLAIN` sem `ANALYZE`) uma tabela Redis privada. Nenhuma conexão Redis é executada. Esse contorno depende do comportamento da versão instalada do Wrappers e precisa ser revalidado em atualizações da extensão.

TLS permanece obrigatório. O certificado MySQL atual é autoassinado e não identifica o host da conexão. O script usa validação de certificado por padrão; `--allow-unverified-certificate` desativa explicitamente a verificação da CA e identidade, mantendo a criptografia. Nesse modo não há confirmação criptográfica da identidade do servidor.

## Provisionamento

Defina `DATABASE_URL` e `MYSQL_CONNECTION_URL` no ambiente, ou use `MYSQL_CONFIG_FILE` apontando para um arquivo JSON privado com `host`, `port`, `user`, `password` e `database`. Não versione o arquivo de credenciais.

Validação com rollback:

```powershell
node --env-file=.env.local scripts/provision-crm-mysql.mjs --allow-unverified-certificate
```

Ativação, depois da autorização específica:

```powershell
node --env-file=.env.local scripts/provision-crm-mysql.mjs --apply --allow-unverified-certificate
```

Antes de ativar, preserve um backup atualizado das cinco tabelas e das definições das funções. A migração é transacional no PostgreSQL. As escritas no MySQL por FDW não participam do rollback do PostgreSQL; não use rollback local como forma de desfazer operações remotas.

Se o certificado do servidor for corrigido, execute o provisionamento sem `--allow-unverified-certificate` para exigir validação de CA e identidade. A disponibilidade das telas integradas passa a depender da disponibilidade do MySQL.
