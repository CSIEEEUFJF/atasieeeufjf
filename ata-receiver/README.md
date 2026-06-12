# Ata Receiver

Servidor JS externo para receber PDFs do Sistema de Atas IEEE UFJF.

## Endpoint

`POST /atas/pdf`

Formato esperado: `multipart/form-data`

- `pdf`: arquivo PDF
- `metadata`: JSON opcional
- `chapter` ou `capitulo`: capitulo de destino
- `targetFolder`: caminho informativo enviado pelo sistema, como `/atas/CS`

O servidor salva sempre em:

```txt
/atas/[CAPITULO]
```

O nome do PDF usa o titulo da ata enviado em `metadata.title`. Tambem grava um
arquivo `.metadata.json` ao lado do PDF.

Para evitar copias duplicadas, o servidor usa `metadata.ataId` como chave da ata.
Se o mesmo `ataId` chegar novamente, ele reutiliza o arquivo existente: se o PDF
for identico, nao regrava; se o conteudo mudar, atualiza o mesmo arquivo.

## Rodar com Docker

```bash
docker build -t ata-receiver ./ata-receiver
docker run --rm \
  -p 3001:3001 \
  -v "$PWD/atas-recebidas:/atas" \
  -e CORS_ORIGIN="*" \
  -e RECEIVE_TOKEN="troque-este-token" \
  ata-receiver
```

## Rodar com Docker Compose

Na raiz do projeto:

```bash
ATA_RECEIVER_TOKEN="troque-este-token" docker compose up -d ata-receiver
```

Por padrão, os PDFs ficam em `./atas-recebidas/[CAPITULO]`.

No sistema principal, configure:

```env
PDF_FORWARD_URL="https://save.ieeeufjf.com.br/atas/pdf"
PDF_FORWARD_TOKEN="troque-este-token"
PDF_FORWARD_TOKEN_TTL_SECONDS="300"
```

No receiver, configure o mesmo valor em `ATA_RECEIVER_TOKEN`/`RECEIVE_TOKEN`.
O app principal usa esse segredo apenas para criar um token temporario; o PDF e enviado
direto do navegador para este servidor.

Se `RECEIVE_TOKEN` ficar vazio, o servidor aceita requisicoes sem token.

## Rodar localmente

```bash
cd ata-receiver
npm install
ATAS_DIR="$PWD/data" npm start
```

Health check:

```bash
curl http://localhost:3001/health
```
