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
