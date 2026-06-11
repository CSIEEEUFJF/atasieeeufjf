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

Tambem grava um arquivo `.metadata.json` ao lado do PDF.

## Rodar com Docker

```bash
docker build -t ata-receiver ./ata-receiver
docker run --rm \
  -p 3001:3001 \
  -v "$PWD/atas-recebidas:/atas" \
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
```

Se `RECEIVE_TOKEN` ficar vazio, o servidor aceita requisições sem token.

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
