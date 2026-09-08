# CRM Prócion

Portal interno da Prócion para suporte, relacionamento comercial, gestão de clientes e acompanhamento do ERP Hádron. Esta aplicação moderniza os principais fluxos do CRM legado `prcweb`, preservando suas regras de negócio e seus dados históricos sem reproduzir a arquitetura antiga.

## Visão geral

O CRM reúne em uma única interface:

- atendimento e acompanhamento de chamados;
- agenda de suporte e comercial;
- cadastro completo de clientes, empresas, contatos e ambientes;
- prospecção com dados públicos de CNPJ;
- opções, ocorrências, releases e documentação do Hádron;
- base de conhecimento;
- quadros Kanban;
- frota e reservas de veículos;
- indicadores operacionais;
- administração de colaboradores, acessos, contratos, dispositivos e aplicativos.

O sistema antigo, localizado em `prcweb`, foi usado como referência funcional para nomes, relações e fluxos. A implementação atual é independente e utiliza uma arquitetura web moderna.

## Módulos

### Dashboard

Visão resumida das atividades do portal, com acesso aos principais módulos e informações operacionais.

### Suporte

- **Chamados:** abertura, pesquisa, ocupação, transferência, mensagens, anexos e finalização.
- **Agendamentos:** compromissos da equipe de suporte e seus detalhes.
- **Calendário:** visão consolidada de eventos, responsáveis, origens e notificações.
- **Frota:** veículos, reservas, abastecimentos, despesas e histórico de utilização.

### Comercial

- **Contatos:** empresas e pessoas em acompanhamento, com etapa e histórico comercial.
- **Atividades:** ligações, reuniões, visitas e demais interações.
- **Agendamentos:** agenda da equipe comercial.
- **Prospecção:** busca de empresas por cidade, UF, abertura, CNAE, porte e regime tributário, com seleção de colunas e enriquecimento de contatos.

### Hádron

Central de informações do ERP, inspirada no domínio CVS do CRM antigo:

- opções e formulários;
- ocorrências, soluções, revisões e aprovações;
- releases e versões;
- módulos e submódulos;
- checklists e parâmetros;
- artigos e números de série.

As ocorrências históricas são vinculadas às opções por `cvs_options_id`. O banco atual contém 20.427 ocorrências importadas, relacionadas a 1.573 opções.

### Base de conhecimento

Artigos técnicos do Hádron organizados por categorias e tags, incluindo conteúdo migrado do portal de ajuda antigo.

### Kanban

Quadros compartilhados, colunas, cartões, membros, comentários, checklists, anexos e fundos personalizados. Há suporte à importação de quadros do Trello.

### Clientes

Consulta centralizada de clientes e empresas vinculadas, incluindo contatos, parâmetros, contratos, aplicativos, dispositivos, números de série, logs, chamados, calendário e informações do Hádron.

### Configurações

Área administrativa para colaboradores, perfis de acesso, aplicativos, empresas, dispositivos, contratos e logs de autenticação.

## Perfis de acesso

O acesso é autenticado pelo Supabase Auth. O login aceita e-mail ou sigla do operador, desde que o colaborador esteja cadastrado e provisionado.

| Perfil | Acesso atual |
| --- | --- |
| `s_admin` | Todos os módulos e configurações |
| `admin` | Módulos de `prc` mais a área Comercial |
| `prc` | Dashboard, Chamados, Kanban, Base de conhecimento e Hádron |

Os perfis são administrados em **Configurações > Colaboradores**. As permissões de interface são complementadas por políticas RLS e funções SQL no Supabase.

## Arquitetura

| Camada | Tecnologia |
| --- | --- |
| Interface | React 19, TypeScript e Tailwind CSS 4 |
| Rotas e SSR | TanStack Router e TanStack Start |
| Componentes | Radix UI e Lucide React |
| Dados e autenticação | Supabase/PostgreSQL |
| Estado remoto | TanStack Query e APIs do Supabase |
| Gráficos | Recharts |
| Mapas | Leaflet e React Leaflet |
| Build | Vite 8 e Nitro |
| Produção | Worker compatível com Cloudflare |

O banco é evoluído por migrações versionadas. Funções RPC concentram consultas mais complexas e as políticas de Row Level Security limitam o acesso aos dados.

## Estrutura do projeto

```text
src/
  assets/              imagens e recursos visuais
  components/          componentes de interface e componentes de domínio
  lib/                 acesso a dados, autenticação, stores e utilitários
  routes/              páginas e rotas do TanStack Router
scripts/               importadores, sincronizações e provisionamento
supabase/
  functions/           Edge Functions
  migrations/          estrutura, políticas, índices e funções SQL
  sql/                 consultas SQL auxiliares e históricas
public/                 arquivos públicos
docs/                   documentação complementar
```

## Requisitos

- Node.js 20 ou superior;
- npm;
- projeto Supabase configurado;
- PostgreSQL acessível para migrações e importações administrativas;
- Supabase CLI para trabalhar com as migrações localmente ou no projeto remoto.

## Configuração local

1. Instale as dependências:

```bash
npm install
```

2. Crie `.env.local` com base em `.env.example`.

3. Preencha, no mínimo:

```dotenv
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
DATABASE_URL=postgresql://usuario:senha@host:5432/postgres
```

4. Inicie o ambiente de desenvolvimento:

```bash
npm run dev
```

O Vite exibirá no terminal o endereço local da aplicação.

Nunca exponha `DATABASE_URL`, chaves de serviço ou credenciais privadas em variáveis com prefixo `VITE_`. Variáveis `VITE_*` são incorporadas ao código entregue ao navegador.

## Banco de dados

As migrações em `supabase/migrations` são a fonte de verdade para a estrutura atual. Elas abrangem:

- autenticação, colaboradores e perfis;
- chamados, mensagens, eventos e anexos;
- clientes e relações importadas do CRM antigo;
- calendário e notificações;
- Kanban;
- frota;
- comercial e prospecção;
- Hádron e ocorrências;
- configurações e auditoria.

Para aplicar as migrações com o Supabase CLI:

```bash
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

Revise sempre o SQL antes de aplicá-lo em produção e mantenha um backup atualizado.

## Importação de dados legados

Os scripts em `scripts/` migram os dados exportados do CRM antigo para o modelo atual. Entre os conjuntos suportados estão:

- clientes, empresas e relacionamentos;
- usuários, colaboradores e logs;
- chamados e calendário;
- parâmetros, módulos e informações do Hádron;
- catálogos CVS, opções e ocorrências;
- dados de prospecção da Receita Federal;
- quadros do Trello.

Alguns comandos disponíveis:

```bash
npm run import:crm-clients
npm run import:crm-collaborators
npm run import:crm-tickets
npm run import:crm-calendar
npm run import:cvs-catalogs
npm run import:company-leads
npm run import:trello
```

O importador de ocorrências do Hádron recebe explicitamente o arquivo JSON:

```bash
node --env-file=.env.local scripts/import-cvs-occurrences.mjs "C:\caminho\cvs_occurrences.json"
```

Antes de executar uma importação, confira o cabeçalho do script correspondente. Alguns importadores geram migrações ou arquivos intermediários; outros gravam diretamente no PostgreSQL por meio de `DATABASE_URL`.

## Prospecção e fontes externas

A prospecção trabalha com Dados Abertos do CNPJ e pode usar serviços externos para busca e enriquecimento.

Variáveis opcionais:

```dotenv
LEADS_API_URL=https://provedor/v1/cnpj/search
LEADS_API_KEY=sua-chave-privada
GOOGLE_PLACES_API_KEY=sua-chave-privada
FISCAL_API_KEY=sua-chave-privada
```

Para atualizar a base de empresas:

```bash
npm run sync:company-leads
```

Para enriquecer contatos já importados:

```bash
npm run enrich:company-lead-contacts
```

Dados oficiais da Receita são preservados; o enriquecimento complementa telefone, site e e-mail sem substituir a origem pública.

## Qualidade e build

Execute antes de publicar:

```bash
npm run lint
npm run build
```

Para visualizar localmente o resultado compilado:

```bash
npm run preview
```

## Relação com o CRM antigo

O `prcweb` legado foi construído com CakePHP 3.7, PHP 7 e quatro schemas MySQL separados:

- `procionw_auth`: autenticação, contratos, aplicativos e dispositivos;
- `procionw_prcsac`: suporte, clientes, colaboradores e agendamentos;
- `procionw_prccom`: contatos e histórico comercial;
- `procionw_prccvs`: opções, ocorrências, releases e conteúdo do Hádron.

No CRM atual, esses domínios foram consolidados em PostgreSQL/Supabase, com relacionamentos explícitos, funções RPC, autenticação central e RLS. O código legado deve ser consultado para compreender regras históricas e formatos de dados, mas não é dependência de execução deste projeto.

## Cuidados de manutenção

- Não versione arquivos `.env`, senhas ou chaves privadas.
- Toda mudança estrutural do banco deve receber uma nova migração.
- Preserve os IDs legados usados na ligação entre dados importados.
- Prefira relações exatas por ID; não relacione registros históricos apenas por texto.
- Teste perfis e políticas RLS ao criar uma nova página ou operação.
- Importações grandes devem usar lotes, ser idempotentes e registrar a quantidade processada.
- Não altere dados oficiais da Receita durante o enriquecimento comercial.

## Estado do projeto

O CRM está em desenvolvimento ativo. Parte do conteúdo é histórico e parte já é criada diretamente na aplicação nova. Ao alterar um fluxo migrado, valide tanto os registros novos quanto os dados importados do `prcweb`.
