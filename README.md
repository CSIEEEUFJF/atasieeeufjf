# Gerador Web de Atas IEEE com React, Prisma Postgres e SwiftLaTeX

Documentacao principal do projeto `Template-LaTex-ATAIEEE`.

Ultima revisao desta documentacao: `2026-04-22`

## 1. Visao geral

Este projeto implementa uma aplicacao web local para criacao, armazenamento e
geracao de atas de capitulos IEEE, com:

- interface React/Next.js para preencher atas
- autenticacao simples por nome de usuario e senha
- controle de acesso por capitulo
- banco PostgreSQL acessado via Prisma ORM para usuarios, sessoes, atas e anexos
- templates LaTeX por sociedade/capitulo em `classes/`
- compilacao de PDF no navegador com SwiftLaTeX/WebAssembly
- APIs do proprio Next.js para entregar templates, assets, persistencia e autenticacao

O ponto mais importante da arquitetura atual e que o backend nao executa
`pdflatex`. A compilacao final do documento acontece no browser, usando
SwiftLaTeX e o bundle local de pacotes TeX. O backend serve dados, templates,
assets e persistencia em Postgres.

## 2. Estado atual

Funciona hoje:

- primeiro acesso cria um usuario administrador
- login/logout por nome de usuario e senha
- troca de senha pelo proprio usuario ao clicar no nome no header
- sessoes persistidas em cookie HTTP-only
- APIs para cadastro de membros por administradores
- APIs para cadastro de novos administradores por administradores
- APIs para edicao de permissao de administrador de outros usuarios
- pagina `/membros` visivel para gestao de membros por admins
- cargo/função cadastrado por usuario
- associacao de membros a capitulos especificos
- isolamento de atas por capitulo no backend
- formulario web para criar atas
- selecao de membros cadastrados ao preencher presenca da ata
- importacao e exportacao de rascunho JSON
- upload de anexos pelo navegador
- salvamento de atas e anexos no Postgres
- nome personalizavel para atas salvas
- pagina `/atas` com biblioteca separada por capitulo
- clique em ata salva para gerar PDF diretamente quando a ata nao depende de anexos reenviados
- opcao "Abrir no gerador" para editar ata salva antes de gerar
- barra de progresso com estimativa durante a geracao de PDF
- geracao de PDF no navegador com SwiftLaTeX
- suporte aos templates atuais em `classes/`

Pontos importantes do estado atual:

- a compilacao de PDF e client-side
- a conexao do banco usa `DATABASE_URL`
- schema do banco fica em `prisma/schema.prisma` e e sincronizado por `prisma db push`
- anexos salvos ficam somente como metadados no Postgres; arquivos binarios nao sao persistidos
- o primeiro usuario criado vira admin e membro de todos os capitulos
- membros sem vinculo com um capitulo nao conseguem acessar atas daquele capitulo
- a implementacao antiga em `web_atas/` foi mantida apenas como referencia
- ainda ha um warning conhecido do Turbopack ligado a rota dinamica do bundle TeX

## 3. Stack e runtime

## 3.1 Plataforma

- Framework web: `Next.js 16`
- Interface: `React 19`
- Runtime: `Node.js 20.19+`
- Banco: `PostgreSQL`
- ORM: `Prisma`
- Driver: `pg` via `@prisma/adapter-pg`
- Compilador LaTeX no browser: `SwiftLaTeX`
- Motor usado pelo app: `PdfTeXEngine`
- Assets do motor: `public/swiftlatex/`
- Bundle TeX local: `texlive/local/pdftex/`

## 3.2 Scripts npm

Definidos em [`package.json`](./package.json):

- `npm run dev` - inicia o Next.js em modo desenvolvimento
- `npm run build` - gera Prisma Client, sincroniza o schema quando `DATABASE_URL` existe e gera build de producao
- `npm run vercel-build` - alias do build usado para Vercel
- `npm start` - inicia o servidor de producao apos build
- `npm run db:generate` - gera Prisma Client
- `npm run db:push` - sincroniza o schema Prisma no banco
- `npm run db:deploy` - alias de `prisma db push` para deploy
- `npm run db:studio` - abre Prisma Studio
- `npm run vendor:texlive` - regenera o bundle local de pacotes TeX

## 3.3 Requisitos

Ambiente esperado:

- `Node.js >= 20.19.0`
- `npm`
- banco PostgreSQL acessivel pela aplicacao
- variavel `DATABASE_URL`
- navegador moderno com suporte a WebAssembly

Nao e necessario instalar:

- `pdflatex`
- TeX Live completo no sistema

## 4. Estrutura do repositorio

Principais diretorios:

- [`classes`](./classes): classes LaTeX e imagens por capitulo/sociedade
- [`exemplos`](./exemplos): payloads JSON de exemplo
- [`public/swiftlatex`](./public/swiftlatex): runtime SwiftLaTeX/WASM servido estaticamente
- [`prisma`](./prisma): schema Prisma do banco PostgreSQL
- [`scripts`](./scripts): scripts auxiliares, incluindo vendor do TeX Live
- [`src/app`](./src/app): rotas App Router do Next.js
- [`src/components`](./src/components): componentes React principais
- [`src/lib`](./src/lib): regras de negocio, banco, auth e compilacao
- [`texlive/local`](./texlive/local): bundle local de arquivos TeX usado pelo SwiftLaTeX
- [`web_atas`](./web_atas): implementacao anterior mantida como referencia

Arquivos principais:

- [`src/components/AtaApp.jsx`](./src/components/AtaApp.jsx): gerador principal de atas
- [`src/components/SavedAtasPage.jsx`](./src/components/SavedAtasPage.jsx): biblioteca de atas salvas
- [`src/components/MembersPage.jsx`](./src/components/MembersPage.jsx): gestao visivel de membros, cargos e admins
- [`src/lib/ata.js`](./src/lib/ata.js): sociedades, renderizacao LaTeX e utilitarios herdados
- [`src/lib/auth.js`](./src/lib/auth.js): usuarios, senhas, sessoes e autorizacao
- [`src/lib/db.js`](./src/lib/db.js): cliente Prisma e conexao Postgres
- [`src/lib/saved-atas.js`](./src/lib/saved-atas.js): persistencia e controle de acesso das atas
- [`src/lib/swiftlatex-client.js`](./src/lib/swiftlatex-client.js): compilacao PDF no navegador
- [`src/app/api`](./src/app/api): rotas HTTP do backend Next.js
- [`next.config.mjs`](./next.config.mjs): configuracao do Next.js
- [`start_web.sh`](./start_web.sh): bootstrap auxiliar para ambiente web

## 5. Arquitetura de software

## 5.1 Camadas principais

- Interface React
  - renderiza formularios
  - controla estado local
  - faz chamadas para as APIs
  - executa a compilacao SwiftLaTeX no navegador

- API Next.js
  - autentica usuarios
  - entrega sociedades disponiveis
  - entrega templates LaTeX e imagens
  - salva e recupera atas
  - aplica autorizacao por capitulo
  - serve arquivos do bundle TeX local

- Banco PostgreSQL/Prisma
  - persiste usuarios
  - persiste sessoes
  - persiste associacoes usuario-capitulo
  - persiste atas
  - persiste anexos

- Templates LaTeX
  - ficam em `classes/<CAPITULO>/`
  - incluem `.cls` e pasta `imagens/`
  - sao enviados para o navegador pela API `/api/latex/project`

- Runtime SwiftLaTeX
  - fica em `public/swiftlatex/`
  - e carregado no browser
  - usa arquivos TeX sob demanda pela rota `/api/swiftlatex/texlive/...`

## 5.2 Componentes React

[`src/components/AtaApp.jsx`](./src/components/AtaApp.jsx):

- tela inicial de login/setup
- formulario completo da ata
- selecao de capitulo permitido ao usuario
- cadastro de membros presentes
- selecao de membros cadastrados com cargo preenchido automaticamente
- cadastro de pautas e resultados
- anexos opcionais
- importacao/exportacao de rascunho JSON
- salvamento da ata no banco
- abertura de ata salva via `/?ata=<id>`
- geracao de PDF pelo SwiftLaTeX

[`src/components/SavedAtasPage.jsx`](./src/components/SavedAtasPage.jsx):

- listagem de atas separadas por capitulo
- geracao de PDF ao clicar em uma ata
- botao explicito `Gerar PDF`
- link `Abrir no gerador`
- exclusao de atas

## 5.3 Bibliotecas internas

[`src/lib/ata.js`](./src/lib/ata.js):

- registra os capitulos/sociedades suportados
- lista sociedades
- normaliza nomes de arquivo
- escapa texto para LaTeX
- renderiza o conteudo `.tex`
- mantem funcoes legadas de geracao backend, sem uso principal no fluxo atual

[`src/lib/auth.js`](./src/lib/auth.js):

- cria usuarios
- normaliza nomes de usuario
- gera hash de senha com `scrypt`
- valida credenciais
- altera senha do proprio usuario apos confirmar a senha atual
- cria sessoes
- limpa sessoes expiradas
- aplica cookie HTTP-only
- lista capitulos disponiveis
- lista usuarios para admins

[`src/lib/db.js`](./src/lib/db.js):

- cria o Prisma Client sob demanda
- usa `DATABASE_URL` como string de conexao
- usa `@prisma/adapter-pg` para falar com PostgreSQL
- mantem a conexao lazy para evitar acesso ao banco durante import/build
- o schema estrutural fica em [`prisma/schema.prisma`](./prisma/schema.prisma)

[`src/lib/saved-atas.js`](./src/lib/saved-atas.js):

- normaliza payloads de atas
- processa JSON com dados da ata
- extrai e salva somente metadados de anexos
- salva, atualiza, renomeia, lista, abre e remove atas
- aplica controle de acesso por capitulo em todas as operacoes

[`src/lib/swiftlatex-client.js`](./src/lib/swiftlatex-client.js):

- carrega `PdfTeXEngine.js`
- gera/cacheia o formato `swiftlatexpdftex.fmt`
- carrega `pdftex.map` com cache-buster
- cria um worker SwiftLaTeX novo por compilacao
- escreve templates, imagens, anexos e `main.tex` no filesystem em memoria
- compila e retorna um `Blob` PDF

## 5.4 Fronteira client/server

No servidor:

- PostgreSQL via Prisma
- autenticacao
- autorizacao
- APIs REST
- leitura de arquivos do repositorio
- entrega de assets TeX e templates

No navegador:

- estado do formulario
- leitura de anexos selecionados
- reconstrucao de anexos salvos em `File`
- montagem do projeto LaTeX em memoria
- execucao do SwiftLaTeX/WebAssembly
- download do PDF gerado

## 6. Fluxos principais

## 6.1 Primeiro acesso

1. Usuario abre `http://127.0.0.1:3000`.
2. A UI chama `GET /api/auth/me`.
3. Se nao houver usuarios, a API retorna `setupRequired: true`.
4. A tela pede nome, nome de usuario e senha.
5. O frontend envia `POST /api/auth/setup`.
6. O backend cria o primeiro usuario como admin.
7. O backend associa esse admin a todos os capitulos.
8. O backend cria a sessao e envia cookie HTTP-only.
9. A UI libera o gerador.

## 6.2 Login normal

1. Usuario informa nome de usuario e senha.
2. Frontend envia `POST /api/auth/login`.
3. Backend busca `users.username`.
4. Senha e validada com `scrypt`.
5. Backend cria uma sessao em `sessions`.
6. Cookie `atas_ieee_session` e gravado no navegador.
7. `GET /api/auth/me` passa a retornar o usuario autenticado.

Parametros atuais:

- identificador: nome de usuario
- senha minima: `6` caracteres
- validade da sessao: `14 dias`
- cookie: HTTP-only, `SameSite=Lax`

## 6.3 Criacao e geracao de ata pelo gerador

1. Usuario entra no gerador em `/`.
2. A UI carrega sociedades por `GET /api/sociedades`.
3. A UI filtra os capitulos conforme `user.chapters`.
4. Usuario preenche dados da reuniao.
5. Usuario adiciona membros presentes.
6. Usuario adiciona pautas e resultados.
7. Usuario adiciona anexos opcionais.
8. Ao clicar em `Gerar PDF`, a UI valida campos obrigatorios.
9. A UI exibe uma barra de progresso com tempo estimado.
10. A UI chama `compileAtaPdfInBrowser()`.
11. O navegador busca o bundle da sociedade por `GET /api/latex/project`.
12. O navegador carrega SwiftLaTeX e arquivos TeX necessarios.
13. O navegador monta `main.tex` e anexos em memoria.
14. O SwiftLaTeX gera o PDF.
15. O download e iniciado no navegador.

## 6.4 Salvamento de ata

1. Usuario preenche ou abre uma ata.
2. Opcionalmente informa `Nome da ata`, usado na biblioteca.
3. Clica em `Salvar ata` ou `Atualizar ata`.
4. Frontend envia JSON para `/api/atas`.
5. Payload contem nome da ata, dados da ata e metadados dos anexos.
6. Arquivos binarios dos anexos nao sao enviados para salvamento.
7. Backend valida sessao.
8. Backend valida se o usuario pertence ao capitulo selecionado.
9. Backend salva a ata em `atas`.
10. Backend salva anexos em `ata_attachments`.
11. A UI informa `Ata salva com sucesso`.

## 6.5 Geracao de PDF a partir de ata salva

1. Usuario abre `/atas`.
2. A pagina lista atas agrupadas por capitulo.
3. Usuario clica no card de uma ata ou no botao `Gerar PDF`.
4. Frontend busca detalhes por `GET /api/atas/:id`.
5. Backend so retorna a ata se o usuario tiver acesso ao capitulo.
6. Frontend reconstrui anexos salvos como `File`.
7. Frontend valida campos obrigatorios.
8. Frontend chama `compileAtaPdfInBrowser()`.
9. PDF e gerado e baixado no navegador.

## 6.6 Abrir ata salva no gerador

1. Usuario clica em `Abrir no gerador`.
2. Navegador abre `/?ata=<id>`.
3. O gerador detecta o parametro `ata`.
4. A UI busca `GET /api/atas/:id`.
5. O formulario e preenchido com os dados salvos.
6. Usuario pode editar, salvar novamente ou gerar PDF.

## 6.7 APIs de membros por admin

1. Admin abre `/membros`.
2. Cliente autenticado como admin envia `POST /api/users`.
3. Backend valida que o solicitante e admin.
4. Backend cria o usuario com nome, nome de usuario, cargo/função e senha inicial.
5. Se for membro comum, backend grava associacoes em `user_chapters`.
6. Se for admin, backend associa o usuario a todos os capitulos.
7. Novo usuario passa a acessar o escopo associado ao seu perfil.
8. Admins podem editar nome, cargo, capitulos e permissao por `PATCH /api/users/:id`.
9. A API bloqueia alteracao da propria permissao de administrador.

## 6.8 Importacao e exportacao de rascunho

Exportacao:

1. Usuario clica em `Baixar rascunho`.
2. A UI monta JSON com os campos da ata.
3. O arquivo e baixado no navegador.

Importacao:

1. Usuario clica em `Importar rascunho`.
2. Seleciona um JSON.
3. A UI preenche o formulario.
4. Se houver anexos, os arquivos precisam ser reenviados antes de gerar PDF.

Observacao:

- rascunho JSON nao carrega o conteudo binario dos anexos
- atas salvas no Postgres tambem preservam somente metadados de anexos

## 7. Interface web

## 7.1 Rotas visiveis

- `/` - gerador principal de atas
- `/atas` - biblioteca de atas salvas
- `/membros` - gestao de membros, cargos, capitulos e admins

## 7.2 Gerador principal

Areas principais:

- login/setup quando nao ha sessao
- selecao de capitulo/sociedade
- dados principais da reuniao
- membros presentes, manualmente ou a partir de membros cadastrados
- pautas
- resultados
- anexos
- painel lateral de saida
- sidebar de atalhos para salvar, importar, exportar, limpar e navegar
- painel de geracao de PDF

Comportamento importante:

- capitulos indisponiveis para o usuario nao aparecem
- seletor de membros usa `GET /api/users?scope=accessible`
- ao escolher um membro cadastrado, nome e cargo/função sao preenchidos na presenca
- se uma ata e aberta via `/?ata=<id>`, o formulario carrega automaticamente
- se uma ata aberta for salva novamente, a API usa `PUT /api/atas/:id`
- se for uma nova ata, a API usa `POST /api/atas`
- `Nome da ata` define o titulo exibido na biblioteca; se ficar vazio, o nome do PDF e usado

## 7.3 Pagina de atas salvas

Areas principais:

- status da biblioteca
- agrupamento por capitulo
- cards de atas
- botao `Gerar PDF`
- link `Abrir no gerador`
- botao `Renomear`
- botao `Excluir`

Comportamento importante:

- clicar no card gera PDF
- `Abrir no gerador` nao gera PDF; apenas abre para edicao
- `Renomear` atualiza somente o titulo exibido da ata, preservando conteudo e metadados
- exclusao remove a ata e seus anexos por cascade no Postgres/Prisma
- membros comuns veem apenas seus capitulos
- admins veem todos os capitulos
- a pagina `/atas` nao exibe cadastro/listagem de membros

## 7.4 Pagina de gestao de membros

Areas principais:

- cadastro de novo membro
- campo `Cargo / função`
- controle de capitulos permitidos
- opcao para criar ou remover permissao de admin
- lista de usuarios cadastrados
- edicao de nome, cargo, capitulos e permissao de admin

Comportamento importante:

- apenas admins acessam `/membros`
- admins nao podem remover a propria permissao de administrador
- usuario admin recebe acesso a todos os capitulos
- o cargo salvo aparece no seletor de membros do gerador de atas

## 7.5 Tema visual

A interface tem tema claro/escuro:

- preferencia salva em `localStorage`
- chave: `atas-ieee-theme`
- fallback: preferencia do sistema operacional
- controle visual fica fixo no canto inferior direito

## 8. Rotas de API

Todas as rotas de API rodam no runtime `nodejs`.

## 8.1 Saude e metadados

`GET /api/health`

- retorna status basico da aplicacao
- resposta esperada: `{ "status": "ok" }`

`GET /api/sociedades`

- retorna capitulos/sociedades suportados
- usado pelo gerador para montar os cards de template

## 8.2 Autenticacao

`GET /api/auth/me`

- retorna usuario autenticado, capitulos e estado de setup
- tambem informa se ainda e necessario criar o primeiro usuario

`POST /api/auth/setup`

- cria o primeiro usuario
- so funciona se ainda nao houver usuarios
- usuario criado vira admin
- usuario criado recebe todos os capitulos

Payload:

```json
{
  "name": "Nome",
  "username": "usuario",
  "password": "123456"
}
```

`POST /api/auth/login`

- autentica por nome de usuario e senha
- cria cookie de sessao

Payload:

```json
{
  "username": "usuario",
  "password": "123456"
}
```

`POST /api/auth/logout`

- remove sessao atual
- limpa cookie de sessao

## 8.3 Usuarios e membros

`GET /api/users`

- lista usuarios
- exige usuario admin

`GET /api/users?scope=accessible`

- lista usuarios dos capitulos acessiveis ao usuario autenticado
- admins recebem todos os usuarios
- usado pelo gerador para preencher membros presentes com nome e cargo

`POST /api/users`

- cria usuario membro
- exige usuario admin
- associa o membro aos capitulos informados
- se `isAdmin` for `true`, associa o usuario a todos os capitulos
- aceita `cargo` para preencher a funcao padrao do usuario

Payload:

```json
{
  "cargo": "Secretario",
  "name": "Membro CS",
  "username": "membro.cs",
  "password": "123456",
  "chapters": ["CS"],
  "isAdmin": false
}
```

`PATCH /api/users/:id`

- edita nome, cargo, capitulos e permissao de administrador
- exige usuario admin
- recebe campos como `{ "name": "Novo nome", "cargo": "Presidente", "chapters": ["CS"], "isAdmin": true }`
- quando promove para admin, garante acesso a todos os capitulos
- bloqueia alteracao da propria permissao de administrador

## 8.4 Atas

`GET /api/atas`

- lista atas dos capitulos acessiveis ao usuario
- aceita filtro opcional `?capitulo=CS`
- retorna `403` se o usuario tentar filtrar capitulo sem acesso

`POST /api/atas`

- cria nova ata
- recebe JSON com payload da ata e metadados de anexos
- exige que o usuario pertenca ao capitulo da ata

`GET /api/atas/:id`

- retorna ata completa, incluindo metadados de anexos
- retorna `404` se a ata nao existir ou se o usuario nao tiver acesso ao capitulo

`PUT /api/atas/:id`

- atualiza ata existente
- substitui metadados de anexos anteriores pelos metadados enviados
- exige acesso ao capitulo original e ao capitulo novo informado no payload

`PATCH /api/atas/:id`

- renomeia ata existente
- recebe `{ "title": "Novo nome" }`
- preserva conteudo da ata e metadados de anexos
- exige acesso ao capitulo da ata

`DELETE /api/atas/:id`

- remove ata
- remove anexos por cascade
- exige acesso ao capitulo da ata

## 8.5 Templates e TeX

`GET /api/latex/project?sociedade=CS`

- retorna `documentclass`
- retorna `.cls`
- retorna imagens da pasta `imagens/`
- usado pelo SwiftLaTeX no navegador

`GET /api/swiftlatex/texlive/:engine/:arquivo`

- proxy local do bundle TeX
- atualmente restrito a `pdftex`
- usa `texlive/local/pdftex/manifest.json`
- possui validacao de caminho canonico
- retorna `404 no-store` para arquivo ausente

## 9. Modelo de dados

## 9.1 Banco PostgreSQL com Prisma

O banco e definido por [`prisma/schema.prisma`](./prisma/schema.prisma) e
sincronizado diretamente com `prisma db push`.

Variavel de ambiente obrigatoria:

- `DATABASE_URL` - string de conexao PostgreSQL usada pelo Prisma

Exemplo local:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
```

Comandos principais:

```bash
npm run db:generate
npm run db:push
npm run db:deploy
npm run db:studio
```

## 9.2 Tabela `users`

Responsabilidade:

- guardar membros e administradores

Campos principais:

- `id`
- `name`
- `cargo`
- `username`
- `email`
- `password_hash`
- `password_salt`
- `is_admin`
- `created_at`
- `updated_at`

Observacoes:

- a autenticacao usa `username`
- `email` foi mantido internamente como campo unico auxiliar
- novos usuarios recebem email interno no formato `<username>@local.atas-ieee`

## 9.3 Tabela `sessions`

Responsabilidade:

- guardar sessoes ativas

Campos principais:

- `id`
- `user_id`
- `token_hash`
- `expires_at`
- `created_at`
- `last_seen_at`

Observacoes:

- o token real fica apenas no cookie do navegador
- o banco guarda somente hash SHA-256 do token
- sessoes expiradas sao removidas durante verificacoes de usuario

## 9.4 Tabela `user_chapters`

Responsabilidade:

- associar usuarios a capitulos

Campos principais:

- `user_id`
- `chapter_key`
- `created_at`

Regra:

- acesso a atas e sempre filtrado por `chapter_key`
- admins criados no setup sao associados a todos os capitulos quando nenhum capitulo especifico e enviado

## 9.5 Tabela `atas`

Responsabilidade:

- guardar metadados e payload JSON das atas

Campos principais:

- `id`
- `user_id`
- `title`
- `sociedade`
- `output_name`
- `payload_json`
- `created_at`
- `updated_at`

Observacoes:

- `sociedade` funciona como chave de capitulo
- `payload_json` guarda o formulario normalizado
- a listagem e abertura dependem do capitulo da ata

## 9.6 Tabela `ata_attachments`

Responsabilidade:

- guardar anexos das atas

Campos principais:

- `id`
- `ata_id`
- `client_id`
- `legenda`
- `file_name`
- `mime_type`
- `size`
- `position`

Observacoes:

- o conteudo binario do arquivo nao e salvo no Postgres
- para gerar PDF com anexos a partir de uma ata salva, reabra no gerador e reenvie os arquivos

## 10. Capitulos e templates LaTeX

## 10.1 Capitulos suportados

Capitulos/sociedades atuais:

- `AESS`
- `APS`
- `CS`
- `EdSoc`
- `IAS`
- `MTTS`
- `PES`
- `RAS`
- `Ramo Geral`
- `VTS`

Definidos em [`src/lib/ata.js`](./src/lib/ata.js), no objeto `SOCIEDADES`.

## 10.2 Estrutura de um template

Cada capitulo fica em:

```text
classes/<CAPITULO>/
```

Arquivos esperados:

- uma classe `.cls`
- uma pasta `imagens/`
- opcionalmente exemplos `.tex`

Exemplo:

```text
classes/CS/
├── ataCS.cls
├── ata.tex
└── imagens/
```

## 10.3 Contrato do LaTeX gerado

O app gera um `main.tex` com:

- `\documentclass{...}`
- `\cabecalho`
- `\info{data_elaboracao}{autor}{data_reuniao}{local}`
- ambiente `membros`
- comandos `\membro`
- ambiente `pautas`
- comandos `\pauta`
- ambiente `resultados`
- comandos `\resultado`
- ambiente `anexos`
- comandos `\anexo`
- `\assinaturas`

As classes `.cls` precisam implementar esses comandos/ambientes.

## 10.4 Adicionar novo capitulo

Passos esperados:

1. Criar pasta em `classes/<NOVO_CAPITULO>`.
2. Adicionar `.cls` compatível com o contrato acima.
3. Adicionar `imagens/` com logos e assets necessarios.
4. Registrar o capitulo em `SOCIEDADES` em [`src/lib/ata.js`](./src/lib/ata.js).
5. Registrar o nome amigavel em `SOCIEDADE_LABELS`.
6. Testar `GET /api/latex/project?sociedade=<NOVO_CAPITULO>`.
7. Gerar PDF pelo navegador.
8. Validar salvamento e acesso por capitulo.

## 11. SwiftLaTeX e bundle TeX

## 11.1 Runtime SwiftLaTeX

Arquivos servidos de [`public/swiftlatex`](./public/swiftlatex):

- `PdfTeXEngine.js`
- `swiftlatexpdftex.js`
- `swiftlatexpdftex.wasm`
- outros runtimes mantidos como apoio

O app usa `PdfTeXEngine`.

## 11.2 Formato local

O navegador gera o formato:

```text
swiftlatexpdftex.fmt
```

Esse formato e cacheado em memoria pela pagina enquanto ela esta aberta.

## 11.3 `pdftex.map`

O app carrega `pdftex.map` explicitamente antes da compilacao.

Motivo:

- evitar falhas de fonte como `cmssbx10 not found`
- evitar cache ruim de respostas `404`
- garantir que o worker do SwiftLaTeX tenha o mapa de fontes certo

## 11.4 Bundle TeX local

Bundle atual:

```text
texlive/local/pdftex/
```

Manifest:

```text
texlive/local/pdftex/manifest.json
```

Regeneracao:

```bash
npm run vendor:texlive
```

## 11.5 Fluxo de compilacao no navegador

1. Carrega runtime SwiftLaTeX.
2. Cria novo worker `PdfTeXEngine`.
3. Injeta `swiftlatexpdftex.fmt`.
4. Injeta `pdftex.map`.
5. Baixa bundle da sociedade.
6. Escreve `.cls`, imagens e anexos no filesystem em memoria.
7. Escreve `main.tex`.
8. Define `main.tex` como arquivo principal.
9. Executa `compileLaTeX()`.
10. Fecha o worker.
11. Retorna `Blob` PDF.

## 12. Persistencia

## 12.1 O que fica no Postgres

Ficam persistidos:

- usuarios
- hashes de senha
- sessoes
- associacoes usuario-capitulo
- atas salvas
- payload JSON das atas
- metadados de anexos

Nao ficam persistidos:

- arquivos binarios dos anexos
- estado visual do formulario nao salvo
- caches SwiftLaTeX do navegador
- arquivos temporarios de build
- arquivos `.next/`

## 12.2 Rascunhos JSON

Rascunhos exportados pelo botao `Baixar rascunho` contem:

- sociedade
- nome de saida
- datas
- autor
- local
- membros
- pautas
- resultados
- metadados de anexos

Importante:

- rascunhos nao embutem os arquivos binarios dos anexos
- ao importar rascunho com anexos, o usuario deve reenviar os arquivos

## 12.3 Atas salvas

Atas salvas no banco guardam somente metadados dos anexos.

Ao gerar PDF pela pagina `/atas`:

- atas sem anexos podem ser compiladas diretamente
- atas com anexos exigem reenvio dos arquivos pelo gerador
- o compilador recebe apenas arquivos que existem na sessao atual do navegador

## 13. Seguranca

## 13.1 Autenticacao

Modelo atual:

- nome de usuario + senha
- senha com hash `scrypt`
- salt individual por usuario
- cookie HTTP-only
- token de sessao aleatorio
- hash do token salvo no banco
- troca de senha exige sessao ativa e senha atual

Regras de username:

- `3` a `40` caracteres
- letras, numeros, ponto, hifen ou underline
- normalizado para minusculas
- espacos viram ponto

## 13.2 Autorizacao por capitulo

Todas as operacoes de ata passam por autorizacao de capitulo:

- listar
- filtrar
- abrir
- criar
- atualizar
- excluir
- gerar PDF de ata salva

Comportamento:

- usuario sem acesso recebe `403` ao filtrar capitulo proibido
- usuario sem acesso recebe `404` ao tentar abrir/excluir ata especifica
- o `404` evita revelar existencia de atas de outro capitulo

## 13.3 Protecoes de API

As rotas mutantes verificam origem:

- `POST /api/auth/setup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/password`
- `POST /api/atas`
- `PUT /api/atas/:id`
- `PATCH /api/atas/:id`
- `DELETE /api/atas/:id`
- `POST /api/users`
- `PATCH /api/users/:id`

A funcao `isSameOriginRequest()` bloqueia origens diferentes quando o header
`Origin` esta presente.

## 13.4 Limitacoes atuais de seguranca

Ainda nao ha:

- recuperacao de senha
- edicao de usuario existente
- remocao de usuario pela UI
- politicas avancadas de senha
- rate limit de login
- auditoria de acoes administrativas

## 14. Desenvolvimento local

## 14.1 Instalacao

Na raiz do repositorio:

```bash
npm install
```

Criar `.env` a partir do exemplo e informar a URL do Postgres:

```bash
cp .env.example .env
```

Sincronizar o schema no banco de desenvolvimento:

```bash
npm run db:push
```

## 14.2 Modo desenvolvimento

```bash
npm run dev
```

Abrir:

- `http://127.0.0.1:3000`
- `http://127.0.0.1:3000/atas`

## 14.3 Build de producao

```bash
npm run build
npm start
```

Para deploy na Vercel, configure `DATABASE_URL` nas variaveis do projeto e use
o comando de build:

```bash
npm run vercel-build
```

Esse comando gera o Prisma Client, executa `prisma db push --accept-data-loss`
quando `DATABASE_URL` existe e entao roda o build do Next.js.

## 14.4 Bootstrap auxiliar

Script:

```bash
./start_web.sh
```

Responsabilidades:

- validar assets SwiftLaTeX
- garantir manifest TeX quando ausente
- iniciar fluxo web esperado

## 15. Build e validacao

## 15.1 Comandos principais

Build:

```bash
npm run build
```

Auditoria de dependencias:

```bash
npm audit
```

Regenerar TeX local:

```bash
npm run vendor:texlive
```

Validar schema Prisma:

```bash
npx prisma validate
```

## 15.2 Checklist rapido de validacao

Depois de mudancas importantes, validar:

1. `npm install`
2. configurar `DATABASE_URL`
3. `npm run db:push` em banco de desenvolvimento
4. `npx prisma validate`
5. `npm run build`
6. `npm audit`
7. primeira criacao de admin
8. login por nome de usuario
9. logout
10. cadastro de membro em `/membros`
11. edicao de cargo/função do membro
12. associacao de membro a um unico capitulo
13. promocao/remocao de permissao de admin para outro usuario
14. bloqueio de edicao da propria permissao de admin
15. seletor de membro cadastrado no gerador
16. bloqueio de acesso cruzado entre capitulos
17. criacao de ata no gerador
18. salvamento de ata no banco
19. nome personalizavel da ata salva
20. renomear ata em `/atas`
21. listagem em `/atas`
22. geracao de PDF clicando em ata salva sem anexos
23. barra de progresso durante geracao de PDF
24. abertura de ata salva no gerador
25. geracao de PDF pelo gerador principal
26. exclusao de ata salva
27. importacao/exportacao de rascunho JSON

## 15.3 Checklist de SwiftLaTeX

Validar ao mexer em templates, TeX ou assets:

1. `GET /api/latex/project?sociedade=CS`
2. `GET /api/swiftlatex/texlive/pdftex/11/pdftex.map`
3. geracao de PDF para `CS`
4. geracao de PDF para `PES`
5. geracao de PDF para `IAS`
6. geracao com anexo de imagem
7. geracao repetida na mesma aba
8. hard refresh e nova geracao

## 16. Arquivos importantes para manutencao

- [`src/components/AtaApp.jsx`](./src/components/AtaApp.jsx)
- [`src/components/SavedAtasPage.jsx`](./src/components/SavedAtasPage.jsx)
- [`src/components/MembersPage.jsx`](./src/components/MembersPage.jsx)
- [`src/lib/ata.js`](./src/lib/ata.js)
- [`src/lib/auth.js`](./src/lib/auth.js)
- [`src/lib/db.js`](./src/lib/db.js)
- [`src/lib/saved-atas.js`](./src/lib/saved-atas.js)
- [`src/lib/swiftlatex-client.js`](./src/lib/swiftlatex-client.js)
- [`prisma/schema.prisma`](./prisma/schema.prisma)
- [`src/app/api/atas/route.js`](./src/app/api/atas/route.js)
- [`src/app/api/atas/[id]/route.js`](./src/app/api/atas/[id]/route.js)
- [`src/app/api/auth/me/route.js`](./src/app/api/auth/me/route.js)
- [`src/app/api/auth/login/route.js`](./src/app/api/auth/login/route.js)
- [`src/app/api/auth/setup/route.js`](./src/app/api/auth/setup/route.js)
- [`src/app/api/users/route.js`](./src/app/api/users/route.js)
- [`src/app/api/users/[id]/route.js`](./src/app/api/users/%5Bid%5D/route.js)
- [`src/app/api/latex/project/route.js`](./src/app/api/latex/project/route.js)
- [`src/app/api/swiftlatex/texlive/[engine]/[...slug]/route.js`](./src/app/api/swiftlatex/texlive/%5Bengine%5D/%5B...slug%5D/route.js)
- [`scripts/vendor-texlive.mjs`](./scripts/vendor-texlive.mjs)
- [`next.config.mjs`](./next.config.mjs)

## 17. Limitacoes e cuidados

## 17.1 SwiftLaTeX

Cuidados:

- a primeira compilacao pode demorar mais
- caches antigos do navegador podem afetar assets TeX
- hard refresh pode ser necessario apos atualizar runtime/manifest
- pacotes LaTeX novos podem exigir atualizar `scripts/vendor-texlive.mjs`

## 17.2 Banco PostgreSQL/Prisma

Cuidados:

- `DATABASE_URL` deve apontar para um Postgres acessivel pelo ambiente de deploy
- o schema de producao deve ser sincronizado com `npm run db:deploy`
- backups devem ser feitos no provedor Postgres escolhido
- anexos ficam fora do banco; se for necessario persistir arquivos, considerar storage externo no futuro
- o schema fica em `prisma/schema.prisma`

## 17.3 Anexos

Cuidados:

- anexos ficam em memoria durante compilacao
- anexos salvos preservam nome, tipo MIME, tamanho e legenda
- rascunhos JSON e atas salvas nao preservam os binarios dos anexos

## 17.4 Backend legado

A pasta [`web_atas`](./web_atas) nao e o fluxo principal.

Cuidados:

- nao usar como backend de producao do app atual
- tratar como referencia historica
- manter alteracoes principais na stack Next.js da raiz

## 17.5 Warning conhecido do Turbopack

O build pode mostrar warning de tracing relacionado a:

```text
src/app/api/swiftlatex/texlive/[engine]/[...slug]/route.js
```

Estado atual:

- a build passa
- a geracao de PDF funciona
- o warning esta ligado ao rastreamento dinamico de arquivos do bundle TeX

## 18. Troubleshooting

## 18.1 `Nao foi possivel carregar pdftex.map (404)`

Possiveis causas:

- servidor Next antigo ainda rodando
- cache antigo do navegador
- `texlive/local/pdftex/manifest.json` ausente
- bundle local nao gerado

Acoes:

1. Reiniciar o servidor Next.
2. Dar hard refresh no navegador.
3. Rodar `npm run vendor:texlive`.
4. Conferir `GET /api/swiftlatex/texlive/pdftex/11/pdftex.map`.

## 18.2 `Font cmssbx10 not found`

Possiveis causas:

- `pdftex.map` nao foi carregado
- cache antigo de resposta `404`
- bundle de fontes incompleto

Acoes:

1. Reiniciar o servidor.
2. Hard refresh.
3. Regenerar bundle TeX.
4. Confirmar que `pdftex.map` retorna `200`.

## 18.3 Usuario nao ve um capitulo

Possiveis causas:

- usuario nao esta associado ao capitulo
- admin ainda nao cadastrou permissao
- sessao antiga sem dados atualizados

Acoes:

1. Entrar como admin.
2. Conferir membros por `GET /api/users`.
3. Criar ou ajustar o membro com o capitulo correto pelas APIs de usuarios.
4. Fazer logout/login do membro.

## 18.4 Ata nao gera PDF pela pagina `/atas`

Possiveis causas:

- ata salva esta incompleta
- anexos salvos nao possuem conteudo binario; reabra no gerador e reenvie os arquivos
- usuario perdeu acesso ao capitulo
- SwiftLaTeX falhou ao carregar runtime

Acoes:

1. Abrir a ata pelo link `Abrir no gerador`.
2. Conferir campos obrigatorios.
3. Reenviar anexos se necessario.
4. Salvar novamente.
5. Gerar PDF de novo.

## 18.5 Banco local com dados de teste

Para resetar ambiente local:

1. Parar o servidor Next.
2. Confirmar que `DATABASE_URL` aponta para um banco de teste.
3. Executar `npx prisma db push --force-reset`.
4. Iniciar o app novamente.
5. Criar o primeiro usuario admin.

## 19. Roadmap tecnico sugerido

Melhorias futuras naturais:

- edicao de membros
- remocao de membros
- troca de senha
- reset de senha por admin
- backups/exportacao do banco
- testes automatizados de API
- teste end-to-end com navegador para SwiftLaTeX
- tela dedicada de configuracoes
- filtros e busca em `/atas`
- download em lote de atas por capitulo
- historico/auditoria de acoes administrativas

## 20. Documentos auxiliares

Arquivos de apoio atuais:

- [`exemplos/dados_exemplo.json`](./exemplos/dados_exemplo.json): exemplo de payload
- [`start_web.sh`](./start_web.sh): bootstrap auxiliar
- [`scripts/vendor-texlive.mjs`](./scripts/vendor-texlive.mjs): geracao do bundle TeX local
- [`web_atas`](./web_atas): implementacao anterior preservada como referencia

Este `README.md` deve ser tratado como a documentacao principal e mais completa
do projeto.
