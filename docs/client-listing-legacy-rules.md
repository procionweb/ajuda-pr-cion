# Listagem e edição de clientes: referência do CRM antigo

A regra foi conferida no `TabClientesController.php`, no elemento `tables/table-clientes.ctp`, no formulário `TabClientes/edit.ctp` e no widget `widgets/widget-empresa.ctp` do CRM antigo.

- A versão fica desatualizada quando a data de versão do cliente é anterior a `cvs_versions.data_alterar` da última versão cadastrada. Não existe tolerância fixa de 30/60/90 dias. A exportação disponível termina no registro 401 e informa **01/04/2026** como limite; não foi presumida outra data.
- O legado usa a data da matriz quando disponível. Versão 2.0 é identificada pelo número 2.0 ou data a partir de 28/07/2025.
- Cliente com ramo zero mostra “Ramo não preenchido”. Status bloqueado no legado tem código **9**.
- Os filtros adicionados incluem Criação, Atualização, Início de emissão NFE, Setup, Versão e Cadastro. Foram mantidos o período de cadastro e os demais filtros existentes.
- Razão social, fantasia, porte, ramo, CEP, cidade, UF, CNPJ, boletos, cobrança e módulos procuram as empresas vinculadas (`client_companies`, origem `tab_cli_empresas`). As condições empresariais precisam combinar na mesma empresa. Clientes sem empresa vinculada mantêm a busca dos campos básicos do próprio cadastro. Mais de um módulo selecionado procura qualquer um deles.
- Os códigos e nomes dos 20 módulos foram extraídos de `modulos.json` do legado.
- “Editar cliente” grava em `clients` (origem `tab_clientes`) e pode atualizar seus contatos. “Editar empresa vinculada” grava exclusivamente na empresa selecionada em `client_companies`. Campos legados complementares são preservados em `source_payload`.
- Edição restrita ao super admin ou departamentos administrativo/comercial, inclusive no banco. As consultas complementares exigem autenticação. A auditoria de edição tem RLS e não é exposta aos demais perfis.

## Validação

`node scripts/test-client-listing-rules.mjs`: limite de versão, períodos, ramo, status, boletos, módulos e combinação dos filtros na mesma empresa.

`node --env-file=.env.local scripts/test-client-listing-edit.mjs`: autorização, edição independente de cliente/empresa, preservação de campos, auditoria e rollback. `--apply` aplica a migração depois das verificações; a execução normal não deixa registros de teste.

`tests/crm-bot/client-listing.spec.ts`: filtros com a conta configurada e modais com respostas simuladas no navegador, em desktop/tablet/mobile. Todas as requisições de gravação são bloqueadas. As permissões do banco continuam reais e são verificadas no teste transacional.

## Formulários conforme as referências de edição

O editar da listagem e do cabeçalho abre somente o formulário do cliente: nome/apelido, status, grupo, aviso, mensagem Hádron, razão social, unidade de atendimento, atividades e telefones/e-mails com inclusão e remoção por canal.

O lápis em Dados da empresa e o editar da empresa vinculada abrem somente o cadastro empresarial: CNPJ e consulta, razão social, fantasia, inscrições, CNAE, ANTT, site, ramo, porte, regime, endereço, responsável/endereço, contador e aplicações web. Não há seletor para misturar os dois cadastros. Módulos, boletos e outros campos técnicos permanecem preservados no banco, mas não aparecem nesses formulários.

Aplicações web seguem o contrato da sigla do cliente, como no legado. A interface mostra apenas os tipos selecionados e o catálogo de aplicações; não expõe chaves do contrato. A gravação mantém a autorização de edição e utiliza a tabela estrangeira privada do contrato.

`node --env-file=.env.local scripts/test-separate-client-forms.mjs` testa os contatos, os campos separados, preservação, permissões e aplicações com uma tabela local substituindo a escrita MySQL durante a transação. Não altera contratos remotos no teste. `--apply` aplica somente a migração após as verificações.

## Edição: Internet, CEP e contador

O editar cliente oferece as abas Cliente e Internet. Internet altera status, quantidade de dispositivos e aplicações do contrato, sem expor chaves ou alterar outras configurações. O editar empresa mantém as aplicações e agora reutiliza o cabeçalho padrão, assim como o editar cliente. Ambos os CEPs usam 00000-000 e consultam ViaCEP ao completar oito dígitos, preservando número e complemento. O seletor de contadores cadastrados preenche nome, escritório, telefone e e-mail; mantém os dados antigos até uma seleção explícita.

## Carregamento dos detalhes

A consulta `get_crm_client` busca usuários, contratos e dispositivos diretamente pelo cliente no MySQL e normaliza somente esses registros. Preserva IDs, dados e aplicações do retorno anterior. Os logs são carregados ao abrir sua aba. Consultas temporariamente indisponíveis têm até três tentativas; erros de permissão não são repetidos. Uma falha secundária exibe aviso e permite recarregar os dados, sem derrubar os demais detalhes. A rota reaproveita o resultado por 30 segundos ao trocar abas e pode ser invalidada após edição.
