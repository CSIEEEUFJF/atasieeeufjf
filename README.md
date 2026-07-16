# Sistema Interno IEEE UFJF

Documentação principal do projeto `atasieeeufjf`.

Última revisão desta documentação: `2026-06-28`

## 1. Visão geral

Este repositório implementa o **Sistema Interno IEEE UFJF**, publicado em
`interno.ieeeufjf.com.br`.

O projeto começou como sistema de geração e banco de atas, mas hoje é a
plataforma interna do Ramo Estudantil IEEE UFJF. Ele centraliza:

- autenticação de usuários;
- homepage interna com atalhos dos módulos;
- geração, salvamento e consulta de atas;
- tarefas internas por capítulo;
- calendário interno com eventos recorrentes;
- área de diretoria;
- métricas de tarefas por membro;
- cadastro e gestão de membros;
- administração do conteúdo do site público;
- modo demo aberto para visitantes;
- notificações por e-mail;
- sincronização de tarefas e eventos com Firebase;
- módulo de arquivos pessoais, atualmente configur?vel/desabilit?vel.

O sistema foi desenhado para manter as funções originais de atas e, ao mesmo
tempo, permitir a gestão interna do Ramo e dos capítulos.

## 2. Estado atual

Funciona hoje:

- login em `/login`;
- redirecionamento automático de usuários deslogados para login;
- homepage interna em `/`;
- modo demo público em `/demo`;
- hub de atas em `/atas`;
- banco de atas salvas em `/atas/banco`;
- criação de nova ata em `/atas/nova`;
- geração de PDF no navegador com SwiftLaTeX;
- templates de ata para Ramo e capítulos;
- salvamento de atas e metadados de anexos no PostgreSQL;
- página de tarefas em `/tarefas`;
- página de calendário em `/calendario`;
- página de membros em `/membros`;
- área restrita de diretoria em `/diretoria`;
- subrotas de diretoria para membros, métricas e site;
- administração de membros publicados no site;
- administração de projetos publicados no site;
- administração de fotos da homepage do site;
- administração e importação de fotos históricas do site;
- APIs públicas para o site `SiteRamo`;
- notificações via Resend;
- sincronização com Firebase;
- proteções de login, sessão, permissão e rate limit.

Pontos importantes:

- a antiga rota pública `/admin` foi removida;
- a administração do site fica dentro de `/diretoria/site`;
- o sistema de atas continua existindo, mas agora é um módulo do Sistema Interno;
- o banco PostgreSQL é a fonte primária de dados;
- o Firebase é usado para sincronização com o aplicativo;
- o módulo de arquivos pode ser desabilitado com `INTERNAL_FILES_STORAGE_MODE=disabled`;
- o modo demo não deve gravar dados reais nem enviar PDF ao servidor.

## 3. Tecnologias

Principais tecnologias:

- Next.js 16;
- React 19;
- Prisma 7;
- PostgreSQL;
- Resend;
- SwiftLaTeX/WebAssembly;
- templates LaTeX por capítulo;
- Firebase para sincronização com o aplicativo;
- DeepL para tradução automática de biografias;
- CSS global em `src/app/globals.css`.

Scripts principais:

```bash
npm run dev
npm run build
npm run start
npm run db:generate
npm run db:push
npm run db:studio
```

Scripts auxiliares:

```bash
npm run members:import-contacts
npm run site-projects:seed-chapters
npm run vendor:texlive
```

## 4. Estrutura do repositório

Principais diretórios:

- [`src/app`](./src/app): rotas App Router, páginas e APIs.
- [`src/components`](./src/components): telas e componentes React.
- [`src/lib`](./src/lib): regras de negócio, banco, auth, atas, e-mails e integrações.
- [`prisma`](./prisma): schema Prisma do banco PostgreSQL.
- [`classes`](./classes): templates LaTeX por capítulo.
- [`public`](./public): logos, fontes, fotos, SwiftLaTeX e assets.
- [`scripts`](./scripts): scripts de manutenção, importação e build.
- [`ata-receiver`](./ata-receiver): serviço auxiliar para recebimento externo de arquivos/PDFs.
- [`texlive`](./texlive): arquivos TeX locais usados pelo SwiftLaTeX.

Arquivos mais importantes:

- [`middleware.js`](./middleware.js): proteção de rotas e redirecionamento para login.
- [`src/app/layout.jsx`](./src/app/layout.jsx): layout raiz e metadados.
- [`src/app/globals.css`](./src/app/globals.css): tema visual do sistema.
- [`prisma/schema.prisma`](./prisma/schema.prisma): modelos de dados.
- [`src/lib/auth.js`](./src/lib/auth.js): autenticação, usuários, sessões e permissões.
- [`src/lib/ata.js`](./src/lib/ata.js): templates, sociedades e renderização LaTeX.
- [`src/lib/saved-atas.js`](./src/lib/saved-atas.js): banco de atas salvas.
- [`src/lib/internal.js`](./src/lib/internal.js): tarefas, calendário e métricas.
- [`src/lib/email-notifications.js`](./src/lib/email-notifications.js): e-mails do sistema.
- [`src/lib/firebase-sync.js`](./src/lib/firebase-sync.js): sincronização com Firebase.
- [`src/lib/site-members.js`](./src/lib/site-members.js): membros do site público.
- [`src/lib/site-projects.js`](./src/lib/site-projects.js): projetos do site público.
- [`src/lib/site-home-photos.js`](./src/lib/site-home-photos.js): fotos da home do site.
- [`src/lib/site-history-photos.js`](./src/lib/site-history-photos.js): fotos históricas do site.
- [`src/lib/internal-files.js`](./src/lib/internal-files.js): arquivos pessoais.

## 5. Páginas do sistema

## 5.1 `/login`

Página de autenticação.

Funções:

- exibir o formulário de login;
- permitir acesso ao modo demo;
- redirecionar usuário autenticado para a homepage;
- usar layout em tela cheia com identidade visual do Ramo.

Rotas de API relacionadas:

- `POST /api/auth/login`
- `POST /api/auth/setup`
- `GET /api/auth/me`

## 5.2 `/`

Homepage interna.

Funções:

- saudar o usuário;
- exibir slideshow/fotos do Ramo quando configurado;
- oferecer atalhos para atas, tarefas, calendário e diretoria;
- mostrar o botão de diretoria apenas para usuários autorizados;
- permitir altern?ncia de tema.

## 5.3 `/atas`

Hub do módulo de atas.

Funções:

- perguntar se o usuário quer consultar banco de atas ou criar nova ata;
- direcionar para `/atas/banco` ou `/atas/nova`;
- manter o fluxo de atas separado da homepage.

## 5.4 `/atas/nova`

Gerador de atas.

Funções:

- escolher template visual por capítulo;
- preencher dados da reunião;
- adicionar membros presentes;
- adicionar pautas;
- adicionar resultados;
- adicionar anexos;
- salvar ata;
- gerar PDF no navegador;
- abrir rascunhos;
- importar/exportar JSON.

Comportamento importante:

- o cargo dos membros é calculado conforme o capítulo da ata;
- atas do Ramo mostram cargos no formato `CARGO-Cap?tulo`;
- atas de capítulo mostram diretoria do capítulo apenas com o cargo;
- presidente de outro capítulo aparece como `Presidente-Cap?tulo`;
- demais membros aparecem como `Membro`.

## 5.5 `/atas/banco`

Banco de atas salvas.

Funções:

- listar atas por capítulo;
- respeitar capítulos visíveis ao usuário;
- abrir ata no gerador;
- gerar PDF de ata salva;
- renomear ata;
- excluir ata.

## 5.6 `/tarefas`

Módulo de tarefas internas.

Funções:

- listar tarefas abertas e concluídas;
- filtrar por capítulo;
- criar tarefa por popup;
- escolher prioridade, prazo, status e responsável;
- criar tarefa para um usuário específico ou para o capítulo;
- editar tarefa;
- concluir tarefa;
- excluir tarefa;
- sincronizar com Firebase;
- enviar notificações por e-mail quando habilitado.

## 5.7 `/calendario`

Módulo de calendário.

Funções:

- listar eventos;
- exibir calendário do dia;
- mostrar horários agendados;
- criar evento por popup;
- editar evento;
- excluir evento;
- excluir série recorrente;
- criar eventos recorrentes;
- usar datas/horas em BRT;
- sincronizar com Firebase;
- enviar e-mail de notificação quando habilitado.

## 5.8 `/membros`

Lista de membros visíveis.

Funções:

- pesquisar membros;
- listar membros por escopo permitido;
- apoiar o preenchimento de atas;
- mostrar cargos e capítulos.

## 5.9 `/diretoria`

Painel restrito de diretoria.

Funções:

- centralizar atalhos de gestão;
- abrir cadastro de membros;
- abrir métricas de tarefas;
- abrir administração do site;
- mostrar acesso negado para usuários sem permissão.

## 5.10 `/diretoria/membros`

Cadastro e gestão de usuários.

Funções:

- criar novo usuário/membro;
- informar e-mail;
- definir capítulos;
- definir cargos por capítulo;
- editar membros existentes;
- controlar permissão de administrador quando o usuário atual pode;
- enviar e-mail de boas-vindas quando habilitado.

## 5.11 `/diretoria/tarefas`

Métricas de tarefas.

Funções:

- exibir tarefas registradas por membro;
- exibir tarefas concluídas por membro;
- separar dados por capítulo;
- restringir visualização conforme cargo.

Regras:

- diretoria do Ramo vê todos os capítulos;
- presidente/diretoria de capítulo vê apenas o próprio capítulo.

## 5.12 `/diretoria/site`

Administração do conteúdo do site público.

Funções:

- cadastrar membros exibidos no site;
- cadastrar projetos exibidos no site;
- cadastrar fotos da homepage;
- cadastrar fotos históricas;
- importar fotos históricas a partir de pasta pública do Google Drive;
- controlar se um projeto aparece na home, no capítulo, ou em ambos;
- configurar fotos, zoom e posição;
- preencher/traduzir biografias.

## 5.13 `/arquivos`

Módulo de armazenamento pessoal.

Estado atual:

- pode ficar desabilitado;
- quando desabilitado, o usuário deve ver página/estado de indisponibilidade;
- quando habilitado, separa arquivos por usuário.

Funções previstas/implementadas:

- upload de arquivos permitidos;
- download do próprio arquivo;
- exclusão do próprio arquivo;
- uso de armazenamento local ou serviço remoto.

## 5.14 `/offline`

Página de indisponibilidade do serviço de dados.

Uso:

- indicar que o serviço externo de arquivos/dados está fora do ar;
- manter o padrão visual do sistema;
- oferecer retorno para a homepage.

## 5.15 `/demo`

Modo demonstração.

Funções:

- apresentar o sistema para visitantes externos;
- demonstrar atas, tarefas, calendário e diretoria;
- usar dados fictícios;
- não gravar dados reais;
- não enviar PDF ao servidor;
- exibir contato comercial quando o visitante quiser implementar o sistema.

## 6. Módulos internos

## 6.1 Autenticação e sessões

Arquivo principal:

- [`src/lib/auth.js`](./src/lib/auth.js)

Responsabilidades:

- criar o primeiro usuário;
- autenticar credenciais;
- criar sessões;
- destruir sessões;
- validar usuário atual;
- aplicar rate limit;
- bloquear tentativas inválidas;
- validar política de senha;
- definir permissões por capítulo.

Regras principais:

- cookie: `atas_ieee_session`;
- senha mínima: 10 caracteres;
- senha exige maiúscula, minúscula e número;
- limite de sessões por usuário: 5;
- lockout após falhas de login;
- sessões expiradas são removidas automaticamente.

## 6.2 Usuários, capítulos e cargos

Modelos:

- `User`
- `UserChapter`

Regras:

- todo usuário precisa estar ligado a pelo menos um capítulo;
- cargo padrão é `Membro`;
- cargos de diretoria ficam em `chapterRoles`;
- `isAdmin` libera acesso global;
- diretoria de capítulo gerencia apenas seus capítulos;
- diretoria do Ramo tem visão ampla.

## 6.3 Atas e LaTeX

Arquivos:

- [`src/lib/ata.js`](./src/lib/ata.js)
- [`src/lib/saved-atas.js`](./src/lib/saved-atas.js)
- [`src/lib/swiftlatex-client.js`](./src/lib/swiftlatex-client.js)

Responsabilidades:

- registrar capítulos suportados;
- carregar classes LaTeX;
- renderizar `.tex`;
- escapar texto para LaTeX;
- montar projeto no navegador;
- compilar com SwiftLaTeX;
- salvar ata e metadados.

## 6.4 Tarefas e eventos

Arquivo:

- [`src/lib/internal.js`](./src/lib/internal.js)

Responsabilidades:

- listar tarefas;
- criar tarefas;
- editar tarefas;
- excluir tarefas;
- listar eventos;
- criar eventos;
- editar eventos;
- excluir eventos;
- criar recorrências;
- calcular métricas.

## 6.5 Notificações por e-mail

Arquivo:

- [`src/lib/email-notifications.js`](./src/lib/email-notifications.js)

Responsabilidades:

- e-mail de boas-vindas;
- e-mail de nova tarefa;
- e-mail de novo evento;
- personalização por destinatário;
- limite de 10 e-mails por segundo;
- filtro para não enviar a `@local.atas-ieee`.

## 6.6 Conteúdo do site público

Arquivos:

- [`src/lib/site-members.js`](./src/lib/site-members.js)
- [`src/lib/site-projects.js`](./src/lib/site-projects.js)
- [`src/lib/site-home-photos.js`](./src/lib/site-home-photos.js)
- [`src/lib/site-history-photos.js`](./src/lib/site-history-photos.js)

Responsabilidades:

- CRUD de membros do site;
- CRUD de projetos do site;
- CRUD de fotos da home;
- CRUD e importação de fotos históricas;
- normalização de links do Google Drive;
- exposição de APIs públicas para o site.

## 6.7 Firebase

Arquivo:

- [`src/lib/firebase-sync.js`](./src/lib/firebase-sync.js)

Responsabilidades:

- sincronizar tarefas;
- excluir tarefas no Firebase;
- sincronizar eventos;
- excluir eventos no Firebase.

O PostgreSQL continua sendo a fonte primária. Firebase é uma integração para o aplicativo do Ramo.

## 6.8 Arquivos pessoais

Arquivo:

- [`src/lib/internal-files.js`](./src/lib/internal-files.js)

Responsabilidades:

- validar arquivos;
- bloquear extensões perigosas;
- separar arquivos por usuário;
- operar em modo local, remoto ou desabilitado;
- controlar download e exclusão.

## 7. APIs principais

## 7.1 Autenticação

- `GET /api/auth/me`
- `POST /api/auth/setup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/password`

## 7.2 Usuários

- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/[id]`

## 7.3 Atas

- `GET /api/atas`
- `POST /api/atas`
- `GET /api/atas/[id]`
- `PUT /api/atas/[id]`
- `PATCH /api/atas/[id]`
- `DELETE /api/atas/[id]`

## 7.4 Tarefas

- `GET /api/internal/tasks`
- `POST /api/internal/tasks`
- `PATCH /api/internal/tasks/[id]`
- `DELETE /api/internal/tasks/[id]`
- `GET /api/internal/task-metrics`

## 7.5 Eventos

- `GET /api/internal/events`
- `POST /api/internal/events`
- `PATCH /api/internal/events/[id]`
- `DELETE /api/internal/events/[id]`

## 7.6 Site público

Leitura pública:

- `GET /api/site-members`
- `GET /api/site-projects`
- `GET /api/site-home-photos`
- `GET /api/site-history-photos`

Gerenciamento:

- `GET/POST /api/site-members/manage`
- `PATCH/DELETE /api/site-members/manage/[id]`
- `GET/POST /api/site-projects/manage`
- `PATCH/DELETE /api/site-projects/manage/[id]`
- `GET/POST /api/site-home-photos/manage`
- `PATCH/DELETE /api/site-home-photos/manage/[id]`
- `GET/POST /api/site-history-photos/manage`
- `PATCH/DELETE /api/site-history-photos/manage/[id]`
- `POST /api/site-history-photos/manage/import`

## 7.7 Arquivos

- `GET /api/internal/files`
- `POST /api/internal/files`
- `DELETE /api/internal/files/[id]`
- `GET /api/internal/files/[id]/download`

## 7.8 PDF e LaTeX

- `GET /api/latex/project`
- `GET /api/swiftlatex/texlive/[engine]/[...slug]`
- `POST /api/pdf-forward/session`
- `POST /api/pdf-forward`

## 8. Modelo de dados

Modelos principais em [`prisma/schema.prisma`](./prisma/schema.prisma):

- `User`: usuário do sistema.
- `Session`: sessão autenticada.
- `UserChapter`: relação usuário-capítulo.
- `Ata`: ata salva.
- `AtaAttachment`: metadados dos anexos da ata.
- `InternalTask`: tarefa interna.
- `InternalEvent`: evento interno.
- `InternalFile`: arquivo pessoal.
- `SiteMember`: membro publicado no site.
- `SiteProject`: projeto publicado no site.
- `SiteHomePhoto`: foto do slideshow da homepage do site.
- `SiteHistoryPhoto`: foto histórica do site.
- `MemberContact`: contatos importados da base de membros.

## 9. Capítulos suportados

Capítulos/sociedades registrados:

- AESS
- APS
- CAS
- CS
- EdSoc
- IAS
- MTTS
- PES
- RAS
- Ramo
- SIGHT
- VTS
- WIE

Cada capítulo com template de ata deve ter pasta em `classes/<CAPITULO>` com `.cls` compatível com o contrato do gerador.

## 10. Variáveis de ambiente

Banco:

```env
DATABASE_URL=
POSTGRES_URL=
PRISMA_DATABASE_URL=
```

E-mail:

```env
EMAIL_NOTIFICATIONS_ENABLED=true
RESEND_API_KEY=
EMAIL_FROM=
SITE_INTEREST_RECIPIENT=ramo.ieeeufjf@gmail.com
SITE_INTEREST_API_TOKEN=
```

`POST /api/site-interest` recebe manifestações de interesse do site público e envia a
mensagem ao endereço configurado em `SITE_INTEREST_RECIPIENT`. O token é opcional,
mas, quando definido, deve ser enviado pelo proxy do site como `Bearer` e mantido
com o mesmo valor nos dois projetos.

Firebase:

```env
FIREBASE_SERVICE_ACCOUNT=
FIREBASE_PROJECT_ID=
```

DeepL:

```env
DEEPL_API_KEY=
DEEPL_API_URL=
```

Arquivos:

```env
INTERNAL_FILES_STORAGE_MODE=disabled
INTERNAL_STORAGE_DIR=
INTERNAL_STORAGE_MAX_BYTES=
INTERNAL_STORAGE_RECEIVER_URL=
INTERNAL_STORAGE_RECEIVER_TOKEN=
INTERNAL_STORAGE_RECEIVER_TIMEOUT_MS=
```

PDF forward:

```env
PDF_FORWARD_URL=
PDF_FORWARD_TOKEN=
PDF_FORWARD_MAX_BYTES=
```

## 11. Desenvolvimento local

Instalar dependências:

```bash
npm install
```

Configurar `.env`:

```bash
cp .env.example .env
```

Gerar Prisma Client:

```bash
npm run db:generate
```

Sincronizar schema em banco de teste:

```bash
npm run db:push
```

Rodar localmente:

```bash
npm run dev
```

Abrir:

- `http://127.0.0.1:3000`
- `http://127.0.0.1:3000/login`
- `http://127.0.0.1:3000/demo`

## 12. Build e deploy

Build:

```bash
npm run build
```

Start de produção:

```bash
npm start
```

Build na Vercel:

```bash
npm run vercel-build
```

Observações:

- `postinstall` executa `prisma generate`;
- `npm run build` usa `scripts/build.mjs`;
- o deploy precisa das variáveis de ambiente configuradas;
- o banco deve estar sincronizado antes do uso em produção.

## 13. Segurança

Controles atuais:

- senha com hash `scrypt`;
- salt individual;
- cookie HTTP-only;
- `sameSite=lax`;
- `secure` em produção;
- rate limit em login, troca de senha e setup;
- lockout temporário após falhas;
- validação de origem em mutações sensíveis;
- permissão por capítulo;
- escopo de arquivos por usuário;
- bloqueio de extensões perigosas;
- validação básica de magic bytes de PDF, PNG e JPG;
- sanitização de URLs;
- limite de envio de e-mails por segundo;
- modo demo sem gravação real.

Cuidados:

- nunca versionar `.env`;
- nunca expor `DATABASE_URL`;
- nunca expor tokens Firebase, Resend ou receptor de arquivos;
- revisar rotas novas que aceitem upload;
- manter `/diretoria/site` restrito;
- manter o módulo de arquivos desabilitado enquanto o serviço remoto não estiver pronto.

## 14. Checklist de validação

Depois de mudanças importantes:

1. `npm run build`.
2. Login em `/login`.
3. Redirecionamento de usuário deslogado.
4. Homepage interna `/`.
5. Modo demo `/demo`.
6. Criar ata em `/atas/nova`.
7. Salvar ata.
8. Abrir banco em `/atas/banco`.
9. Gerar PDF.
10. Criar tarefa.
11. Atualizar status de tarefa.
12. Criar evento simples.
13. Criar evento recorrente.
14. Editar evento.
15. Excluir série recorrente.
16. Acessar diretoria com usuário autorizado.
17. Confirmar acesso negado para usuário sem permissão.
18. Criar membro.
19. Pesquisar membro.
20. Ver métricas.
21. Criar projeto do site.
22. Publicar membro do site.
23. Importar fotos históricas do Google Drive.
24. Consumir `/api/site-projects` pelo site público.
25. Testar e-mail com notificações habilitadas.
26. Testar arquivos com `INTERNAL_FILES_STORAGE_MODE=disabled`.

## 15. Documentação complementar

Documentação mais detalhada dos módulos:

- [`DOCUMENTACAO_MODULOS.md`](./DOCUMENTACAO_MODULOS.md)

Este `README.md` deve ser tratado como a documentação principal do sistema atual.
