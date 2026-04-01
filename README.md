# Template de Atas IEEE

Projeto para geracao de atas do IEEE-UFJF com identidade visual por sociedade.

O projeto esta organizado em duas camadas:

- camada visual em LaTeX: cada sociedade possui sua propria classe `.cls`, com cabecalho, cores, logos e assinatura
- camada de preenchimento web: o usuario informa os dados no navegador, o backend gera o `.tex`, compila o PDF e devolve o arquivo para download

O objetivo e permitir que pessoas sem experiencia com LaTeX consigam preencher atas com seguranca, mantendo o layout institucional centralizado nas classes.

## Sumario

- [Visao Geral](#visao-geral)
- [Funcionalidades](#funcionalidades)
- [Sociedades Suportadas](#sociedades-suportadas)
- [Arquitetura](#arquitetura)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Requisitos](#requisitos)
- [Instalacao](#instalacao)
- [Uso Web](#uso-web)
- [API HTTP](#api-http)
- [Geracao por JSON no Terminal](#geracao-por-json-no-terminal)
- [Uso Manual em LaTeX](#uso-manual-em-latex)
- [Como os Arquivos Sao Gerados](#como-os-arquivos-sao-gerados)
- [Manutencao e Customizacao](#manutencao-e-customizacao)
- [Como Adicionar uma Nova Sociedade](#como-adicionar-uma-nova-sociedade)
- [Troubleshooting](#troubleshooting)

## Visao Geral

O fluxo principal do projeto e web:

1. o usuario abre a interface no navegador
2. escolhe a sociedade
3. preenche dados da reuniao
4. adiciona membros, pautas, resultados e anexos
5. clica em gerar
6. o backend monta um arquivo `.tex` em uma pasta temporaria
7. o backend compila com `pdflatex`
8. o PDF pronto e retornado para download

As classes `.cls` continuam sendo a fonte unica da identidade visual. Isso significa que alteracoes de layout, cores, logos e elementos graficos devem ser feitas nas classes, e nao no frontend ou no gerador.

## Funcionalidades

- interface web moderna para preenchimento das atas
- escolha visual da sociedade
- cadastro de membros presentes
- campos separados para informacoes da reuniao
- edicao de pautas e resultados
- upload de anexos
- exportacao de rascunho em `.json`
- importacao de rascunho em `.json`
- geracao automatica de `.tex`
- compilacao automatica de `.pdf`
- modo local por JSON para testes, integracoes e manutencao
- modo manual em LaTeX para quem quiser editar diretamente os templates

## Sociedades Suportadas

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

Cada sociedade possui:

- um arquivo `ata.tex` de exemplo
- uma classe `ata<sociedade>.cls`
- uma pasta `imagens/` com os logos usados pela classe

## Arquitetura

### Frontend

- stack: `React` + `Vite`
- responsabilidade: coletar os dados do usuario, montar a interface, exportar/importar rascunhos e enviar a requisicao para o backend

### Backend

- stack: `FastAPI` + `uvicorn`
- responsabilidade: validar entrada, preparar arquivos temporarios, gerar o `.tex`, compilar o PDF e devolver o binario ao frontend

### Gerador

- arquivo principal: `web_atas/backend/gerador.py`
- responsabilidade: transformar dados estruturados em LaTeX usando as classes da pasta `classes/`

### Classes LaTeX

- local: `classes/<sociedade>/`
- responsabilidade: identidade visual da ata

Em resumo:

- frontend coleta dados
- backend orquestra
- gerador monta LaTeX
- classes definem o visual

## Estrutura do Projeto

```text
Template-LaTex-ATAIEEE/
├── classes/
│   ├── AESS/
│   ├── APS/
│   ├── CS/
│   ├── EdSoc/
│   ├── IAS/
│   ├── MTTS/
│   ├── PES/
│   ├── RAS/
│   ├── Ramo Geral/
│   └── VTS/
├── exemplos/
│   └── dados_exemplo.json
├── web_atas/
│   ├── backend/
│   │   ├── __init__.py
│   │   ├── gerador.py
│   │   ├── main.py
│   │   └── requirements.txt
│   └── frontend/
│       ├── dist/
│       ├── index.html
│       ├── package.json
│       ├── package-lock.json
│       ├── src/
│       │   ├── App.jsx
│       │   ├── main.jsx
│       │   └── styles.css
│       └── vite.config.js
├── .gitignore
└── README.md
```

### O que fica em cada area

#### `classes/`

Contem a camada visual do projeto.

Dentro de cada sociedade, o padrao e:

- `ata.tex`: exemplo minimo de uso
- `ata<sociedade>.cls`: definicoes visuais e comandos da ata
- `imagens/`: logos e imagens referenciadas pela classe
- `anexos_gerados/`: anexos copiados pelo gerador quando a ata e produzida localmente

#### `web_atas/frontend/`

Contem a interface web:

- selecao da sociedade
- formulario da reuniao
- cadastro de membros
- gerenciamento de anexos
- importacao/exportacao de rascunhos
- disparo da geracao do PDF

#### `web_atas/backend/`

Contem a API e o gerador:

- `main.py`: endpoints HTTP, integracao com frontend e fluxo de compilacao
- `gerador.py`: logica para montar o `.tex` e compilar o PDF
- `requirements.txt`: dependencias Python do backend

#### `exemplos/`

Arquivos de referencia para teste do gerador via terminal.

## Requisitos

- `Python 3`
- `Node.js 20+`
- `pdflatex`

Dependencias Python usadas no backend:

- `fastapi==0.135.2`
- `uvicorn[standard]==0.42.0`
- `python-multipart==0.0.22`

Dependencias JavaScript do frontend:

- `react`
- `react-dom`
- `vite`
- `@vitejs/plugin-react`

Se o objetivo for apenas editar os templates em Overleaf, basta ter suporte a LaTeX e enviar a pasta correspondente com as imagens.

## Instalacao

### 1. Criar ambiente Python

Na raiz do projeto:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r web_atas/backend/requirements.txt
```

### 2. Instalar dependencias do frontend

```bash
cd web_atas/frontend
npm install
cd ../..
```

### 3. Garantir que o `pdflatex` esta disponivel

Teste:

```bash
pdflatex --version
```

Se esse comando falhar, o backend nao conseguira gerar o PDF.

## Uso Web

Esse e o fluxo principal para os usuarios.

### Modo app unico

Nesse modo, o backend serve tanto a API quanto o frontend compilado.

#### Compilar o frontend

```bash
cd web_atas/frontend
npm run build
cd ../..
```

#### Subir o backend

```bash
source .venv/bin/activate
uvicorn web_atas.backend.main:app --reload
```

#### Acessar

Abra:

```text
http://127.0.0.1:8000
```

Se o frontend compilado existir em `web_atas/frontend/dist`, o backend servira automaticamente a interface.

### Modo desenvolvimento

Nesse modo, backend e frontend rodam separados.

#### Terminal 1: backend

```bash
source .venv/bin/activate
uvicorn web_atas.backend.main:app --reload
```

#### Terminal 2: frontend

```bash
cd web_atas/frontend
npm run dev
```

#### Acessar

Abra:

```text
http://127.0.0.1:5173
```

O Vite encaminha automaticamente as rotas `/api` para `http://127.0.0.1:8000`.

### Fluxo de uso da interface

Na interface web, o usuario pode:

- escolher a sociedade
- preencher:
  - data da elaboracao
  - autor
  - data da reuniao
  - local da reuniao
- adicionar membros individualmente
- escrever pautas e resultados
- adicionar anexos
- baixar um rascunho `.json`
- importar um rascunho `.json`
- gerar o PDF final

### Importacao e exportacao de rascunho

O frontend permite:

- `Baixar rascunho`
- `Importar rascunho`

Observacao importante:

- os rascunhos exportados nao embutem os arquivos anexos
- ao importar um rascunho com anexos, os arquivos precisam ser enviados novamente antes da geracao do PDF

Essa restricao existe porque o JSON guarda apenas os metadados do anexo, e nao o binario do arquivo.

## API HTTP

O backend expoe uma API simples.

### `GET /api/health`

Verifica se a API esta respondendo.

Resposta esperada:

```json
{
  "status": "ok"
}
```

### `GET /api/sociedades`

Retorna a lista de sociedades disponiveis para o frontend.

Exemplo de resposta:

```json
{
  "sociedades": [
    { "chave": "CS", "nome": "CS - Computer Society" },
    { "chave": "PES", "nome": "PES - Power & Energy Society" }
  ]
}
```

### `POST /api/atas/pdf`

Gera uma ata e devolve o PDF.

Tipo da requisicao:

- `multipart/form-data`

Campos esperados:

- `payload`: JSON em texto
- `anexo-0`, `anexo-1`, ...: arquivos opcionais enviados no mesmo form

Estrutura do `payload`:

```json
{
  "sociedade": "CS",
  "arquivo_saida": "ata_cs_01-04-2026",
  "data_elaboracao": "01/04/2026",
  "autor": "Nome do autor",
  "data_reuniao": "01/04/2026",
  "local_reuniao": "Sala do RE IEEE-UFJF",
  "membros": [
    { "nome": "Fulano da Silva", "cargo": "Presidente CS" }
  ],
  "pautas": [
    "Definicao de cronograma"
  ],
  "resultados": [
    "Cronograma aprovado"
  ],
  "anexos": [
    { "legenda": "Foto da reuniao", "upload_key": "anexo-0" }
  ]
}
```

#### Exemplo com `curl`

Sem anexos:

```bash
curl -X POST http://127.0.0.1:8000/api/atas/pdf \
  -F 'payload={
    "sociedade":"CS",
    "arquivo_saida":"ata_cs_01-04-2026",
    "data_elaboracao":"01/04/2026",
    "autor":"Arthur Araujo",
    "data_reuniao":"01/04/2026",
    "local_reuniao":"Sala do RE IEEE-UFJF",
    "membros":[{"nome":"Fulano da Silva","cargo":"Presidente CS"}],
    "pautas":["Definicao de atividades"],
    "resultados":["Plano aprovado"],
    "anexos":[]
  }' \
  --output ata.pdf
```

Com anexo:

```bash
curl -X POST http://127.0.0.1:8000/api/atas/pdf \
  -F 'payload={
    "sociedade":"CS",
    "arquivo_saida":"ata_cs_01-04-2026",
    "data_elaboracao":"01/04/2026",
    "autor":"Arthur Araujo",
    "data_reuniao":"01/04/2026",
    "local_reuniao":"Sala do RE IEEE-UFJF",
    "membros":[{"nome":"Fulano da Silva","cargo":"Presidente CS"}],
    "pautas":["Definicao de atividades"],
    "resultados":["Plano aprovado"],
    "anexos":[{"legenda":"Registro da reuniao","upload_key":"anexo-0"}]
  }' \
  -F 'anexo-0=@/caminho/para/imagem.png' \
  --output ata.pdf
```

### Resposta do `POST /api/atas/pdf`

Quando tudo da certo:

- status `200`
- corpo da resposta com o binario do PDF
- header `Content-Disposition` com o nome do arquivo
- header `X-Generated-Filename` com o nome sugerido

Em caso de erro:

- status `400`
- JSON com `detail`

## Geracao por JSON no Terminal

Esse modo e util para:

- testes
- integracao com scripts
- automacoes
- manutencao

O exemplo atual esta em:

- [exemplos/dados_exemplo.json](exemplos/dados_exemplo.json)

### Gerar apenas o `.tex`

```bash
python -m web_atas.backend.gerador --dados exemplos/dados_exemplo.json
```

### Gerar `.tex` e `.pdf`

```bash
python -m web_atas.backend.gerador --dados exemplos/dados_exemplo.json --pdf
```

### Campos esperados no JSON local

- `sociedade`
- `arquivo_saida`
- `data_elaboracao`
- `autor`
- `data_reuniao`
- `local_reuniao`
- `membros`
- `pautas`
- `resultados`
- `anexos`

### Exemplo completo

```json
{
  "sociedade": "CS",
  "arquivo_saida": "ata_preenchida",
  "data_elaboracao": "30/03/2026",
  "autor": "Arthur Araujo",
  "data_reuniao": "30/03/2026",
  "local_reuniao": "Sala do RE IEEE-UFJF",
  "membros": [
    { "nome": "Fulano da Silva", "cargo": "Presidente CS" },
    { "nome": "Ciclano Souza", "cargo": "Vice-presidente CS" }
  ],
  "pautas": [
    "Definicao de calendario",
    "Planejamento das atividades"
  ],
  "resultados": [
    "Calendario aprovado",
    "Responsabilidades distribuidas"
  ],
  "anexos": [
    { "legenda": "Foto da reuniao", "arquivo": "./foto.png" }
  ]
}
```

### Regras dos anexos no JSON local

No modo local, cada anexo precisa ter:

- `legenda`
- `arquivo`

O campo `arquivo` pode ser:

- caminho absoluto
- caminho relativo ao diretorio do JSON usado no comando

Exemplo:

```json
{
  "legenda": "Registro da reuniao",
  "arquivo": "./imagens/reuniao.png"
}
```

## Uso Manual em LaTeX

Quem quiser continuar usando o template manualmente pode editar os arquivos `ata.tex` dentro da pasta da sociedade desejada.

Exemplos:

- [classes/CS/ata.tex](classes/CS/ata.tex)
- [classes/PES/ata.tex](classes/PES/ata.tex)
- [classes/Ramo Geral/ata.tex](classes/Ramo%20Geral/ata.tex)
- [classes/MTTS/ata.tex](classes/MTTS/ata.tex)

### Comandos principais das classes

- `\cabecalho`
- `\info{data_elaboracao}{autor}{data_reuniao}{local}`
- ambiente `membros`
- comando `\membro{numero}{nome}{cargo}`
- ambiente `pautas`
- comando `\pauta{texto}`
- ambiente `resultados`
- comando `\resultado{texto}`
- ambiente `anexos`
- comando `\anexo{legenda}{arquivo}`
- `\assinaturas`

### Exemplo minimo

```latex
\documentclass{ataCS}

\begin{document}

\cabecalho

\info{01/04/2026}{Nome do Autor}{01/04/2026}{Sala do RE IEEE-UFJF}

\begin{membros}
    \membro{1}{Fulano da Silva}{Presidente CS}
    \membro{2}{Ciclano Souza}{Vice-presidente CS}
\end{membros}

\newpage

\begin{pautas}
    \pauta{Definicao de novos projetos}
\end{pautas}

\begin{resultados}
    \resultado{Projeto aprovado para a proxima gestao}
\end{resultados}

\begin{anexos}
\end{anexos}

\assinaturas

\end{document}
```

### Compilacao manual

O jeito mais simples e compilar de dentro da pasta da sociedade:

```bash
cd classes/CS
pdflatex -interaction=nonstopmode -halt-on-error ata.tex
```

Se preferir usar Overleaf:

- envie a pasta da sociedade junto com a pasta `imagens/`
- ou envie o projeto inteiro compactado

## Como os Arquivos Sao Gerados

### No fluxo web

No fluxo web, o backend:

1. cria uma pasta temporaria
2. copia a classe `.cls` e a pasta `imagens/` da sociedade escolhida
3. grava os uploads recebidos
4. gera o `.tex`
5. executa o `pdflatex`
6. devolve apenas o PDF ao navegador

Nesse fluxo, os templates originais em `classes/` nao sao modificados.

### No fluxo local por JSON

No fluxo local via `python -m web_atas.backend.gerador`, o gerador escreve os arquivos diretamente na pasta da sociedade correspondente.

Exemplo:

- `classes/CS/ata_preenchida.tex`
- `classes/CS/ata_preenchida.pdf`
- `classes/CS/anexos_gerados/...`

Os nomes sao normalizados automaticamente para evitar caracteres invalidos.

## Manutencao e Customizacao

### Onde mexer para alterar o visual

Se a alteracao for visual, o lugar certo e:

- `classes/<sociedade>/ata<sociedade>.cls`

Ali ficam:

- cores
- logos
- cabecalho
- caixas
- estilos
- assinaturas
- comandos LaTeX da ata

### Onde nao mexer para alterar o visual

Normalmente, nao altere o visual em:

- `web_atas/frontend/src/App.jsx`
- `web_atas/backend/main.py`
- `web_atas/backend/gerador.py`

Esses arquivos devem cuidar de dados, fluxo e compilacao, nao da identidade visual.

### Onde mexer para alterar o fluxo web

- frontend: `web_atas/frontend/src/App.jsx`
- estilos da interface: `web_atas/frontend/src/styles.css`
- endpoints e logica HTTP: `web_atas/backend/main.py`
- geracao do `.tex`: `web_atas/backend/gerador.py`

### Observacoes importantes de manutencao

- a interface web apenas coleta os dados
- o visual final continua sendo responsabilidade das classes `.cls`
- anexos adicionados pelo gerador local sao copiados para `anexos_gerados/`
- o backend web trabalha em pasta temporaria
- arquivos de build e artefatos gerados estao cobertos pelo `.gitignore`

## Como Adicionar uma Nova Sociedade

Para incluir uma nova sociedade no projeto:

1. crie uma nova pasta em `classes/`
2. adicione a classe `.cls`
3. adicione um `ata.tex` de exemplo
4. adicione a pasta `imagens/` com os logos necessarios
5. registre a sociedade em `web_atas/backend/gerador.py`
6. registre o nome amigavel em `web_atas/backend/main.py`
7. registre a opcao de fallback em `web_atas/frontend/src/App.jsx`
8. teste:
   - compilacao manual da classe
   - geracao local via JSON
   - geracao via interface web

### Checklist recomendado

- a classe compila com `pdflatex`
- o logo aparece corretamente
- as cores estao corretas
- o nome da sociedade aparece certo no frontend
- `GET /api/sociedades` retorna a nova opcao
- `POST /api/atas/pdf` gera PDF valido

## Troubleshooting

### O backend sobe, mas a interface nao abre em `:8000`

Possivel causa:

- o frontend nao foi compilado

Solucao:

```bash
cd web_atas/frontend
npm install
npm run build
```

Depois suba o backend novamente.

### O frontend em `:5173` nao consegue falar com a API

Possivel causa:

- backend nao esta rodando na porta `8000`

Solucao:

```bash
source .venv/bin/activate
uvicorn web_atas.backend.main:app --reload
```

### O PDF nao gera

Possiveis causas:

- `pdflatex` nao esta instalado
- erro em algum anexo
- classe da sociedade com problema
- payload invalido

Verifique:

```bash
pdflatex --version
```

E confira tambem a mensagem retornada pela API no campo `detail`.

### Importei um rascunho e os anexos sumiram

Isso e esperado.

Os rascunhos JSON guardam apenas os nomes dos anexos, nao os arquivos binarios. Depois de importar, e necessario reenviar os anexos antes de gerar o PDF.

### A classe compila manualmente, mas falha no backend

Verifique:

- se a sociedade esta registrada em `web_atas/backend/gerador.py`
- se os arquivos da pasta `imagens/` realmente existem
- se o nome da classe esta correto no mapa `SOCIEDADES`

### Quero apenas mexer no layout

Edite somente a classe `.cls` da sociedade correspondente.

### Quero mudar a interface do site

Edite:

- `web_atas/frontend/src/App.jsx`
- `web_atas/frontend/src/styles.css`

## Estado Atual do Projeto

No estado atual:

- o fluxo principal recomendado e o web
- o backend pode servir o frontend compilado
- o frontend pode rodar separado em modo desenvolvimento
- o projeto ainda suporta uso manual em LaTeX
- o gerador local por JSON continua disponivel para testes e integracoes

Se voce mantiver essa separacao entre visual nas classes e fluxo na aplicacao web, o projeto continua facil de evoluir sem perder consistencia grafica.
