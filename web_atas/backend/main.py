from __future__ import annotations

import json
import shutil
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError
from starlette.datastructures import UploadFile

from .gerador import (
    AtaData,
    AnexoData,
    MembroData,
    SOCIEDADES,
    gerar_ata,
    normalizar_nome_arquivo,
    normalizar_nome_saida,
)


ROOT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIST_DIR = ROOT_DIR / "web_atas" / "frontend" / "dist"

SOCIEDADE_LABELS = {
    "AESS": "AESS - Aerospace and Electronic Systems Society",
    "APS": "APS - Antennas and Propagation Society",
    "CS": "CS - Computer Society",
    "EdSoc": "EdSoc - Education Society",
    "IAS": "IAS - Industry Applications Society",
    "MTTS": "MTT-S - Microwave Theory and Technology Society",
    "PES": "PES - Power & Energy Society",
    "RAS": "RAS - Robotics and Automation Society",
    "Ramo Geral": "Ramo Geral IEEE",
    "VTS": "VTS - Vehicular Technology Society",
}


class MembroPayload(BaseModel):
    nome: str = ""
    cargo: str = ""


class AnexoPayload(BaseModel):
    legenda: str = ""
    upload_key: str | None = None


class AtaPayload(BaseModel):
    sociedade: str = "CS"
    arquivo_saida: str = "ata_preenchida"
    data_elaboracao: str = ""
    autor: str = ""
    data_reuniao: str = ""
    local_reuniao: str = ""
    membros: list[MembroPayload] = Field(default_factory=list)
    pautas: list[str] = Field(default_factory=list)
    resultados: list[str] = Field(default_factory=list)
    anexos: list[AnexoPayload] = Field(default_factory=list)


app = FastAPI(
    title="Atas IEEE Web",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if (FRONTEND_DIST_DIR / "assets").exists():
    app.mount(
        "/assets",
        StaticFiles(directory=FRONTEND_DIST_DIR / "assets"),
        name="frontend-assets",
    )


def copiar_recursos_sociedade(sociedade: str, destino: Path) -> None:
    origem = Path(SOCIEDADES[sociedade]["folder"])
    destino.mkdir(parents=True, exist_ok=True)

    for item in origem.iterdir():
        if item.is_dir() and item.name == "imagens":
            shutil.copytree(item, destino / item.name, dirs_exist_ok=True)
        elif item.is_file() and item.suffix == ".cls":
            shutil.copy2(item, destino / item.name)


def montar_dados(payload: AtaPayload, upload_map: dict[str, UploadFile], uploads_dir: Path) -> AtaData:
    membros = [
        MembroData(nome=item.nome.strip(), cargo=item.cargo.strip())
        for item in payload.membros
    ]
    anexos: list[AnexoData] = []

    for item in payload.anexos:
        legenda = item.legenda.strip()
        upload_key = (item.upload_key or "").strip()
        if not legenda and not upload_key:
            continue
        if not legenda or not upload_key:
            raise HTTPException(
                status_code=400,
                detail="Cada anexo precisa ter legenda e arquivo.",
            )

        upload = upload_map.get(upload_key)
        if upload is None or not upload.filename:
            raise HTTPException(
                status_code=400,
                detail="Um dos anexos enviados não foi encontrado no upload.",
            )

        nome_arquivo = normalizar_nome_arquivo(upload.filename)
        destino = uploads_dir / f"{upload_key}-{nome_arquivo}"
        with destino.open("wb") as arquivo_destino:
            shutil.copyfileobj(upload.file, arquivo_destino)

        anexos.append(AnexoData(legenda=legenda, arquivo=str(destino)))

    return AtaData(
        sociedade=payload.sociedade,
        arquivo_saida=payload.arquivo_saida,
        data_elaboracao=payload.data_elaboracao,
        autor=payload.autor,
        data_reuniao=payload.data_reuniao,
        local_reuniao=payload.local_reuniao,
        membros=membros,
        pautas=payload.pautas,
        resultados=payload.resultados,
        anexos=anexos,
    )


@app.get("/api/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/sociedades")
def listar_sociedades() -> dict[str, list[dict[str, str]]]:
    return {
        "sociedades": [
            {"chave": chave, "nome": SOCIEDADE_LABELS.get(chave, chave)}
            for chave in SOCIEDADES
        ]
    }


def frontend_disponivel() -> bool:
    return (FRONTEND_DIST_DIR / "index.html").exists()


def resolver_arquivo_frontend(caminho_relativo: str) -> Path | None:
    if not frontend_disponivel():
        return None

    caminho_base = FRONTEND_DIST_DIR.resolve()
    candidato = (caminho_base / caminho_relativo).resolve()
    try:
        candidato.relative_to(caminho_base)
    except ValueError:
        return None

    if candidato.is_file():
        return candidato
    return None


@app.get("/", include_in_schema=False, response_model=None)
def servir_index() -> Response:
    index = FRONTEND_DIST_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return Response(
        content=(
            "Frontend não compilado. Rode 'npm install && npm run build' "
            "em web_atas/frontend ou use o modo dev com Vite."
        ),
        media_type="text/plain; charset=utf-8",
    )


@app.post("/api/atas/pdf")
async def gerar_pdf(request: Request) -> Response:
    form = await request.form()
    payload_raw = form.get("payload")
    if not isinstance(payload_raw, str):
        raise HTTPException(status_code=400, detail="Payload ausente.")

    try:
        payload = AtaPayload.model_validate(json.loads(payload_raw))
    except (json.JSONDecodeError, ValidationError) as exc:
        raise HTTPException(status_code=400, detail=f"Payload inválido: {exc}") from exc

    if payload.sociedade not in SOCIEDADES:
        raise HTTPException(status_code=400, detail="Sociedade inválida.")

    uploads = {
        chave: valor
        for chave, valor in form.multi_items()
        if isinstance(valor, UploadFile)
    }

    nome_saida = normalizar_nome_saida(payload.arquivo_saida)

    try:
        with TemporaryDirectory(prefix="atas-ieee-web-") as raiz_temporaria:
            workspace = Path(raiz_temporaria) / "workspace"
            uploads_dir = Path(raiz_temporaria) / "uploads"
            uploads_dir.mkdir(parents=True, exist_ok=True)

            copiar_recursos_sociedade(payload.sociedade, workspace)
            dados = montar_dados(payload, uploads, uploads_dir)
            saidas = gerar_ata(
                dados,
                compilar=True,
                base_dir=uploads_dir,
                output_dir=workspace,
            )

            pdf_bytes = saidas["pdf"].read_bytes()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Não foi possível gerar o PDF: {exc}",
        ) from exc

    headers = {
        "Content-Disposition": f'attachment; filename="{nome_saida}.pdf"',
        "X-Generated-Filename": f"{nome_saida}.pdf",
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


@app.get("/{full_path:path}", include_in_schema=False, response_model=None)
def servir_frontend(full_path: str) -> Response:
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Rota não encontrada.")

    arquivo = resolver_arquivo_frontend(full_path)
    if arquivo is not None:
        return FileResponse(arquivo)

    index = FRONTEND_DIST_DIR / "index.html"
    if index.exists():
        return FileResponse(index)

    raise HTTPException(
        status_code=404,
        detail=(
            "Frontend não compilado. Rode 'npm install && npm run build' "
            "em web_atas/frontend."
        ),
    )
