#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/web_atas/frontend"
VENV_DIR="$ROOT_DIR/.venv"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "Erro: Python nao encontrado." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Erro: npm nao encontrado. Instale Node.js antes de continuar." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Erro: curl nao encontrado. Instale curl antes de continuar." >&2
  exit 1
fi

if [ ! -d "$VENV_DIR" ]; then
  echo "Criando ambiente virtual em .venv..."
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

if ! python - <<'PY' >/dev/null 2>&1
import fastapi
import uvicorn
import multipart
PY
then
  echo "Instalando dependencias do backend..."
  pip install -r "$ROOT_DIR/web_atas/backend/requirements.txt"
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "Instalando dependencias do frontend..."
  (
    cd "$FRONTEND_DIR"
    npm install
  )
fi

if ! command -v pdflatex >/dev/null 2>&1; then
  echo "Aviso: pdflatex nao encontrado. O site vai abrir, mas a geracao de PDF vai falhar." >&2
fi

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  local exit_code=$?

  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi

  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi

  wait >/dev/null 2>&1 || true
  exit "$exit_code"
}

trap cleanup INT TERM EXIT

echo "Subindo backend em http://127.0.0.1:$BACKEND_PORT ..."
(
  cd "$ROOT_DIR"
  python -m uvicorn web_atas.backend.main:app --reload --host 127.0.0.1 --port "$BACKEND_PORT"
) &
BACKEND_PID=$!

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$BACKEND_PORT/api/health" >/dev/null 2>&1; then
    break
  fi

  if ! kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    echo "Erro: backend encerrou antes de responder." >&2
    exit 1
  fi

  sleep 1
done

if ! curl -fsS "http://127.0.0.1:$BACKEND_PORT/api/health" >/dev/null 2>&1; then
  echo "Erro: backend nao respondeu em http://127.0.0.1:$BACKEND_PORT." >&2
  exit 1
fi

echo "Subindo frontend em http://127.0.0.1:$FRONTEND_PORT ..."
(
  cd "$FRONTEND_DIR"
  npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT"
) &
FRONTEND_PID=$!

sleep 2

if ! kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
  echo "Erro: frontend encerrou ao iniciar." >&2
  exit 1
fi

cat <<EOF

Tudo pronto.

- Frontend: http://127.0.0.1:$FRONTEND_PORT
- Backend:  http://127.0.0.1:$BACKEND_PORT

Pressione Ctrl+C neste terminal para encerrar os dois servicos.

EOF

wait
