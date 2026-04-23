from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


PACKAGE_DIR = Path(__file__).resolve().parent
ROOT_DIR = PACKAGE_DIR.parents[1]

SOCIEDADES: dict[str, dict[str, Path | str]] = {
    "AESS": {
        "folder": ROOT_DIR / "classes" / "AESS",
        "documentclass": "ataAESS",
    },
    "APS": {
        "folder": ROOT_DIR / "classes" / "APS",
        "documentclass": "ataAPS",
    },
    "CS": {
        "folder": ROOT_DIR / "classes" / "CS",
        "documentclass": "ataCS",
    },
    "EdSoc": {
        "folder": ROOT_DIR / "classes" / "EdSoc",
        "documentclass": "ataEdSoc",
    },
    "IAS": {
        "folder": ROOT_DIR / "classes" / "IAS",
        "documentclass": "ataIAS",
    },
    "MTTS": {
        "folder": ROOT_DIR / "classes" / "MTTS",
        "documentclass": "ataMTTS",
    },
    "PES": {
        "folder": ROOT_DIR / "classes" / "PES",
        "documentclass": "ataPES",
    },
    "RAS": {
        "folder": ROOT_DIR / "classes" / "RAS",
        "documentclass": "ataRAS",
    },
    "Ramo": {
        "folder": ROOT_DIR / "classes" / "Ramo Geral",
        "documentclass": "ataIEEE",
    },
    "VTS": {
        "folder": ROOT_DIR / "classes" / "VTS",
        "documentclass": "ataVTS",
    },
}

SOCIEDADE_ALIASES = {
    "Ramo Geral": "Ramo",
    "Ramo Geral IEEE": "Ramo",
}

AUXILIARY_SUFFIXES = (
    ".aux",
    ".fdb_latexmk",
    ".fls",
    ".log",
    ".synctex.gz",
)


def normalizar_sociedade(value: Any) -> str:
    sociedade = str(value or "").strip()
    canonical = SOCIEDADE_ALIASES.get(sociedade, sociedade)
    return canonical if canonical in SOCIEDADES else "CS"


@dataclass
class MembroData:
    nome: str = ""
    cargo: str = ""


@dataclass
class AnexoData:
    legenda: str = ""
    arquivo: str = ""


@dataclass
class AtaData:
    sociedade: str = "CS"
    arquivo_saida: str = "ata_preenchida"
    data_elaboracao: str = ""
    autor: str = ""
    data_reuniao: str = ""
    local_reuniao: str = ""
    membros: list[MembroData] = field(default_factory=list)
    pautas: list[str] = field(default_factory=list)
    resultados: list[str] = field(default_factory=list)
    anexos: list[AnexoData] = field(default_factory=list)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "AtaData":
        membros = [
            MembroData(
                nome=str(item.get("nome", "")).strip(),
                cargo=str(item.get("cargo", "")).strip(),
            )
            for item in raw.get("membros", [])
            if isinstance(item, dict)
        ]
        anexos = [
            AnexoData(
                legenda=str(item.get("legenda", "")).strip(),
                arquivo=str(item.get("arquivo", "")).strip(),
            )
            for item in raw.get("anexos", [])
            if isinstance(item, dict)
        ]
        return cls(
            sociedade=normalizar_sociedade(raw.get("sociedade", "CS")),
            arquivo_saida=str(raw.get("arquivo_saida", "ata_preenchida")).strip()
            or "ata_preenchida",
            data_elaboracao=str(raw.get("data_elaboracao", "")).strip(),
            autor=str(raw.get("autor", "")).strip(),
            data_reuniao=str(raw.get("data_reuniao", "")).strip(),
            local_reuniao=str(raw.get("local_reuniao", "")).strip(),
            membros=membros,
            pautas=[
                str(item).strip()
                for item in raw.get("pautas", [])
                if str(item).strip()
            ],
            resultados=[
                str(item).strip()
                for item in raw.get("resultados", [])
                if str(item).strip()
            ],
            anexos=anexos,
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def cleaned(self) -> "AtaData":
        return AtaData(
            sociedade=normalizar_sociedade(self.sociedade),
            arquivo_saida=self.arquivo_saida,
            data_elaboracao=self.data_elaboracao.strip(),
            autor=self.autor.strip(),
            data_reuniao=self.data_reuniao.strip(),
            local_reuniao=self.local_reuniao.strip(),
            membros=[
                MembroData(m.nome.strip(), m.cargo.strip())
                for m in self.membros
                if m.nome.strip() or m.cargo.strip()
            ],
            pautas=[item.strip() for item in self.pautas if item.strip()],
            resultados=[item.strip() for item in self.resultados if item.strip()],
            anexos=[
                AnexoData(a.legenda.strip(), a.arquivo.strip())
                for a in self.anexos
                if a.legenda.strip() or a.arquivo.strip()
            ],
        )


def carregar_dados_json(caminho: Path) -> AtaData:
    conteudo = json.loads(caminho.read_text(encoding="utf-8"))
    if not isinstance(conteudo, dict):
        raise ValueError("O arquivo JSON precisa conter um objeto na raiz.")
    return AtaData.from_dict(conteudo)


def salvar_dados_json(dados: AtaData, caminho: Path) -> None:
    caminho.write_text(
        json.dumps(dados.to_dict(), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def normalizar_nome_saida(nome: str) -> str:
    nome_limpo = nome.strip() or "ata_preenchida"
    nome_limpo = re.sub(r"[^0-9A-Za-z._-]+", "_", nome_limpo)
    nome_limpo = nome_limpo.strip("._-") or "ata_preenchida"
    if nome_limpo.lower() == "ata":
        return "ata_preenchida"
    return nome_limpo


def normalizar_nome_arquivo(nome: str) -> str:
    stem = Path(nome).stem
    sufixo = Path(nome).suffix.lower()
    stem = re.sub(r"[^0-9A-Za-z-]+", "-", stem).strip("-") or "anexo"
    sufixo = re.sub(r"[^.0-9A-Za-z]+", "", sufixo) or ".bin"
    return f"{stem}{sufixo}"


def escapar_latex(texto: str) -> str:
    substituicoes = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    texto = texto.replace("\r\n", "\n").replace("\r", "\n")
    linhas = texto.split("\n")
    linhas_escapadas = []
    for linha in linhas:
        linha_escapada = "".join(substituicoes.get(char, char) for char in linha)
        linhas_escapadas.append(linha_escapada)
    return r" \\ ".join(linhas_escapadas)


def resolver_arquivo(
    caminho: str,
    base_dir: Path,
    *,
    allow_outside_base: bool = True,
) -> Path:
    base_dir_resolvida = base_dir.resolve()
    arquivo = Path(caminho).expanduser()
    origem = arquivo.resolve() if arquivo.is_absolute() else (base_dir_resolvida / arquivo).resolve()

    if allow_outside_base:
        return origem

    try:
        origem.relative_to(base_dir_resolvida)
    except ValueError as exc:
        raise ValueError("O anexo precisa estar dentro do diretório permitido.") from exc

    return origem


def preparar_anexos(
    dados: AtaData,
    pasta_sociedade: Path,
    base_dir: Path,
    nome_saida: str,
    *,
    allow_outside_base: bool = True,
) -> list[tuple[str, str]]:
    pasta_anexos = pasta_sociedade / "anexos_gerados"
    pasta_anexos.mkdir(exist_ok=True)
    anexos_preparados: list[tuple[str, str]] = []

    for indice, anexo in enumerate(dados.anexos, start=1):
        legenda = anexo.legenda.strip()
        arquivo = anexo.arquivo.strip()
        if not legenda and not arquivo:
            continue
        if not legenda or not arquivo:
            raise ValueError(
                "Cada anexo precisa ter legenda e arquivo selecionado."
            )

        origem = resolver_arquivo(
            arquivo,
            base_dir,
            allow_outside_base=allow_outside_base,
        )
        if not origem.exists():
            raise FileNotFoundError(f"Anexo não encontrado: {origem}")

        nome_destino = (
            f"{normalizar_nome_saida(nome_saida)}-"
            f"{indice:02d}-"
            f"{normalizar_nome_arquivo(origem.name)}"
        )
        destino = pasta_anexos / nome_destino
        shutil.copy2(origem, destino)
        anexos_preparados.append(
            (legenda, (Path("anexos_gerados") / nome_destino).as_posix())
        )

    return anexos_preparados


def renderizar_tex(dados: AtaData, anexos_preparados: list[tuple[str, str]]) -> str:
    if dados.sociedade not in SOCIEDADES:
        raise ValueError(
            "Sociedade inválida. Escolha uma das opções disponíveis na interface web."
        )

    documentclass = str(SOCIEDADES[dados.sociedade]["documentclass"])
    linhas = [
        f"\\documentclass{{{documentclass}}}",
        "",
        "\\begin{document}",
        "",
        "\\cabecalho",
        "",
        (
            "\\info"
            f"{{{escapar_latex(dados.data_elaboracao)}}}"
            f"{{{escapar_latex(dados.autor)}}}"
            f"{{{escapar_latex(dados.data_reuniao)}}}"
            f"{{{escapar_latex(dados.local_reuniao)}}}"
        ),
        "",
        "\\begin{membros}",
    ]

    for indice, membro in enumerate(dados.membros, start=1):
        linhas.append(
            "    \\membro"
            f"{{{indice}}}"
            f"{{{escapar_latex(membro.nome)}}}"
            f"{{{escapar_latex(membro.cargo)}}}"
        )

    linhas.extend(
        [
            "\\end{membros}",
            "\\newpage",
            "",
            "\\begin{pautas}",
        ]
    )

    for pauta in dados.pautas:
        linhas.append(f"    \\pauta{{{escapar_latex(pauta)}}}")

    linhas.extend(
        [
            "\\end{pautas}",
            "",
            "\\begin{resultados}",
        ]
    )

    for resultado in dados.resultados:
        linhas.append(f"    \\resultado{{{escapar_latex(resultado)}}}")

    linhas.extend(
        [
            "\\end{resultados}",
            "",
            "\\begin{anexos}",
        ]
    )

    for legenda, caminho in anexos_preparados:
        linhas.append(f"    \\anexo{{{escapar_latex(legenda)}}}{{{caminho}}}")

    linhas.extend(
        [
            "\\end{anexos}",
            "\\assinaturas",
            "",
            "\\end{document}",
            "",
        ]
    )
    return "\n".join(linhas)


def limpar_arquivos_auxiliares(caminho_tex: Path) -> None:
    for sufixo in AUXILIARY_SUFFIXES:
        alvo = caminho_tex.with_suffix(sufixo)
        if alvo.exists():
            alvo.unlink()


def compilar_pdf(caminho_tex: Path) -> Path:
    if shutil.which("pdflatex") is None:
        raise RuntimeError("O comando 'pdflatex' não está disponível no sistema.")

    comando = [
        "pdflatex",
        "-interaction=nonstopmode",
        "-halt-on-error",
        caminho_tex.name,
    ]
    resultado = subprocess.run(
        comando,
        cwd=caminho_tex.parent,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if resultado.returncode != 0:
        mensagem = resultado.stderr.strip() or resultado.stdout.strip()
        raise RuntimeError(
            "Falha ao compilar o PDF.\n\n"
            f"Comando: {' '.join(comando)}\n\n"
            f"Saída:\n{mensagem[-2500:]}"
        )

    limpar_arquivos_auxiliares(caminho_tex)
    return caminho_tex.with_suffix(".pdf")


def gerar_ata(
    dados: AtaData,
    *,
    allow_outside_base: bool = True,
    compilar: bool = False,
    base_dir: Path | None = None,
    output_dir: Path | None = None,
) -> dict[str, Path]:
    dados_limpos = dados.cleaned()
    if dados_limpos.sociedade not in SOCIEDADES:
        raise ValueError("Sociedade inválida.")

    pasta_sociedade = output_dir or Path(SOCIEDADES[dados_limpos.sociedade]["folder"])
    nome_saida = normalizar_nome_saida(dados_limpos.arquivo_saida)
    base_dir_resolvida = base_dir or ROOT_DIR

    anexos_preparados = preparar_anexos(
        dados_limpos,
        pasta_sociedade,
        base_dir_resolvida,
        nome_saida,
        allow_outside_base=allow_outside_base,
    )
    conteudo_tex = renderizar_tex(dados_limpos, anexos_preparados)

    caminho_tex = pasta_sociedade / f"{nome_saida}.tex"
    caminho_tex.write_text(conteudo_tex, encoding="utf-8")

    saidas = {"tex": caminho_tex}
    if compilar:
        saidas["pdf"] = compilar_pdf(caminho_tex)
    return saidas


def construir_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Gera atas IEEE a partir de um arquivo JSON amigável."
    )
    parser.add_argument(
        "--dados",
        type=Path,
        required=True,
        help="Arquivo JSON com os dados da ata.",
    )
    parser.add_argument(
        "--pdf",
        action="store_true",
        help="Compila o PDF após gerar o arquivo .tex.",
    )
    return parser


def main() -> int:
    parser = construir_parser()
    args = parser.parse_args()

    try:
        dados = carregar_dados_json(args.dados)
        saidas = gerar_ata(
            dados,
            allow_outside_base=True,
            compilar=args.pdf,
            base_dir=args.dados.parent.resolve(),
        )
    except Exception as exc:  # noqa: BLE001
        print(f"Erro: {exc}", file=sys.stderr)
        return 1

    print(f".tex gerado em: {saidas['tex']}")
    if "pdf" in saidas:
        print(f".pdf gerado em: {saidas['pdf']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
