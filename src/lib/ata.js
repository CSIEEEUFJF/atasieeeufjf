import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const { access, copyFile, cp, mkdir, mkdtemp, readdir, readFile, rm, unlink, writeFile } = fs;

const ROOT_DIR = process.cwd();

export const SOCIEDADES = {
  AESS: {
    folder: path.join(ROOT_DIR, "classes", "AESS"),
    documentclass: "ataAESS",
  },
  APS: {
    folder: path.join(ROOT_DIR, "classes", "APS"),
    documentclass: "ataAPS",
  },
  CS: {
    folder: path.join(ROOT_DIR, "classes", "CS"),
    documentclass: "ataCS",
  },
  EdSoc: {
    folder: path.join(ROOT_DIR, "classes", "EdSoc"),
    documentclass: "ataEdSoc",
  },
  IAS: {
    folder: path.join(ROOT_DIR, "classes", "IAS"),
    documentclass: "ataIAS",
  },
  MTTS: {
    folder: path.join(ROOT_DIR, "classes", "MTTS"),
    documentclass: "ataMTTS",
  },
  PES: {
    folder: path.join(ROOT_DIR, "classes", "PES"),
    documentclass: "ataPES",
  },
  RAS: {
    folder: path.join(ROOT_DIR, "classes", "RAS"),
    documentclass: "ataRAS",
  },
  Ramo: {
    folder: path.join(ROOT_DIR, "classes", "Ramo Geral"),
    documentclass: "ataIEEE",
  },
  VTS: {
    folder: path.join(ROOT_DIR, "classes", "VTS"),
    documentclass: "ataVTS",
  },
};

export const SOCIEDADE_LABELS = {
  AESS: "AESS - Aerospace and Electronic Systems Society",
  APS: "APS - Antennas and Propagation Society",
  CS: "CS - Computer Society",
  EdSoc: "EdSoc - Education Society",
  IAS: "IAS - Industry Applications Society",
  MTTS: "MTT-S - Microwave Theory and Technology Society",
  PES: "PES - Power & Energy Society",
  RAS: "RAS - Robotics and Automation Society",
  Ramo: "Ramo",
  VTS: "VTS - Vehicular Technology Society",
};

export const SOCIEDADE_ALIASES = {
  "Ramo Geral": "Ramo",
  "Ramo Geral IEEE": "Ramo",
};

const AUXILIARY_SUFFIXES = [
  ".aux",
  ".fdb_latexmk",
  ".fls",
  ".log",
  ".synctex.gz",
];

function texto(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

export function normalizarSociedadeChave(value, fallback = "CS") {
  const cleanValue = texto(value);
  const canonical = SOCIEDADE_ALIASES[cleanValue] || cleanValue;
  return SOCIEDADES[canonical] ? canonical : fallback;
}

export function expandirSociedadesParaBusca(chaves) {
  const requested = Array.isArray(chaves) ? chaves : [chaves];
  const normalized = requested
    .map((chave) => normalizarSociedadeChave(chave, ""))
    .filter(Boolean);
  const expanded = new Set(normalized);

  for (const [alias, canonical] of Object.entries(SOCIEDADE_ALIASES)) {
    if (expanded.has(canonical)) {
      expanded.add(alias);
    }
  }

  return [...expanded];
}

function listaStrings(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function listaObjetos(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

export function listarSociedades() {
  return Object.keys(SOCIEDADES).map((chave) => ({
    chave,
    nome: SOCIEDADE_LABELS[chave] ?? chave,
  }));
}

export function normalizarPayload(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("O payload precisa ser um objeto JSON.");
  }

  return {
    sociedade: normalizarSociedadeChave(raw.sociedade),
    arquivo_saida: texto(raw.arquivo_saida, "ata_preenchida") || "ata_preenchida",
    data_elaboracao: texto(raw.data_elaboracao),
    autor: texto(raw.autor),
    data_reuniao: texto(raw.data_reuniao),
    local_reuniao: texto(raw.local_reuniao),
    membros: listaObjetos(raw.membros).map((item) => ({
      nome: texto(item.nome),
      cargo: texto(item.cargo),
    })),
    pautas: listaStrings(raw.pautas),
    resultados: listaStrings(raw.resultados),
    anexos: listaObjetos(raw.anexos).map((item) => ({
      legenda: texto(item.legenda),
      upload_key: texto(item.upload_key),
    })),
  };
}

export function normalizarNomeSaida(nome) {
  const nomeLimpo = (texto(nome, "ata_preenchida") || "ata_preenchida")
    .replace(/[^0-9A-Za-z._-]+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "");

  if (!nomeLimpo || nomeLimpo.toLowerCase() === "ata") {
    return "ata_preenchida";
  }

  return nomeLimpo;
}

export function normalizarNomeArquivo(nome) {
  const parsed = path.parse(String(nome || ""));
  const stem = (parsed.name || "anexo").replace(/[^0-9A-Za-z-]+/g, "-").replace(/^-+|-+$/g, "");
  const suffix = (parsed.ext || ".bin").toLowerCase().replace(/[^.0-9A-Za-z]+/g, "");
  return `${stem || "anexo"}${suffix || ".bin"}`;
}

export function escaparLatex(textoBruto) {
  const substituicoes = {
    "\\": "\\textbackslash{}",
    "&": "\\&",
    "%": "\\%",
    "$": "\\$",
    "#": "\\#",
    "_": "\\_",
    "{": "\\{",
    "}": "\\}",
    "~": "\\textasciitilde{}",
    "^": "\\textasciicircum{}",
  };

  return String(textoBruto ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((linha) => [...linha].map((char) => substituicoes[char] ?? char).join(""))
    .join(" \\\\ ");
}

function resolverArquivo(caminhoArquivo, baseDir) {
  if (path.isAbsolute(caminhoArquivo)) {
    return caminhoArquivo;
  }

  return path.resolve(baseDir, caminhoArquivo);
}

function limparDados(dados) {
  return {
    sociedade: normalizarSociedadeChave(dados.sociedade),
    arquivo_saida: texto(dados.arquivo_saida, "ata_preenchida") || "ata_preenchida",
    data_elaboracao: texto(dados.data_elaboracao),
    autor: texto(dados.autor),
    data_reuniao: texto(dados.data_reuniao),
    local_reuniao: texto(dados.local_reuniao),
    membros: listaObjetos(dados.membros).filter((item) => texto(item.nome) || texto(item.cargo)),
    pautas: listaStrings(dados.pautas),
    resultados: listaStrings(dados.resultados),
    anexos: listaObjetos(dados.anexos).filter((item) => texto(item.legenda) || texto(item.arquivo)),
  };
}

export async function copiarRecursosSociedade(sociedade, destino) {
  const origem = SOCIEDADES[normalizarSociedadeChave(sociedade, "")]?.folder;
  if (!origem) {
    throw new Error("Sociedade invalida.");
  }

  await mkdir(destino, { recursive: true });
  const itens = await readdir(origem, { withFileTypes: true });

  for (const item of itens) {
    const origemItem = path.join(origem, item.name);
    const destinoItem = path.join(destino, item.name);

    if (item.isDirectory() && item.name === "imagens") {
      await cp(origemItem, destinoItem, { force: true, recursive: true });
    } else if (item.isFile() && item.name.endsWith(".cls")) {
      await copyFile(origemItem, destinoItem);
    }
  }
}

export async function montarDados(payload, uploadMap, uploadsDir) {
  const membros = listaObjetos(payload.membros).map((item) => ({
    nome: texto(item.nome),
    cargo: texto(item.cargo),
  }));
  const anexos = [];
  await mkdir(uploadsDir, { recursive: true });

  for (const item of listaObjetos(payload.anexos)) {
    const legenda = texto(item.legenda);
    const uploadKey = texto(item.upload_key);

    if (!legenda && !uploadKey) {
      continue;
    }

    if (!legenda || !uploadKey) {
      throw new Error("Cada anexo precisa ter legenda e arquivo.");
    }

    const upload = uploadMap.get(uploadKey);
    if (!upload || typeof upload.arrayBuffer !== "function") {
      throw new Error("Um dos anexos enviados nao foi encontrado no upload.");
    }

    const nomeArquivo = normalizarNomeArquivo(upload.name || "anexo.bin");
    const destino = path.join(uploadsDir, `${uploadKey}-${nomeArquivo}`);
    const conteudo = Buffer.from(await upload.arrayBuffer());
    await writeFile(destino, conteudo);

    anexos.push({
      legenda,
      arquivo: destino,
    });
  }

  return {
    sociedade: payload.sociedade,
    arquivo_saida: payload.arquivo_saida,
    data_elaboracao: payload.data_elaboracao,
    autor: payload.autor,
    data_reuniao: payload.data_reuniao,
    local_reuniao: payload.local_reuniao,
    membros,
    pautas: payload.pautas,
    resultados: payload.resultados,
    anexos,
  };
}

async function prepararAnexos(dados, pastaSociedade, baseDir, nomeSaida) {
  const pastaAnexos = path.join(pastaSociedade, "anexos_gerados");
  await mkdir(pastaAnexos, { recursive: true });
  const anexosPreparados = [];

  for (const [indice, anexo] of dados.anexos.entries()) {
    const legenda = texto(anexo.legenda);
    const arquivo = texto(anexo.arquivo);

    if (!legenda && !arquivo) {
      continue;
    }

    if (!legenda || !arquivo) {
      throw new Error("Cada anexo precisa ter legenda e arquivo selecionado.");
    }

    const origem = resolverArquivo(arquivo, baseDir);
    await access(origem);

    const nomeDestino = [
      normalizarNomeSaida(nomeSaida),
      String(indice + 1).padStart(2, "0"),
      normalizarNomeArquivo(path.basename(origem)),
    ].join("-");
    const destino = path.join(pastaAnexos, nomeDestino);
    await copyFile(origem, destino);

    anexosPreparados.push([
      legenda,
      path.posix.join("anexos_gerados", nomeDestino),
    ]);
  }

  return anexosPreparados;
}

export function renderizarTex(dados, anexosPreparados) {
  if (!SOCIEDADES[dados.sociedade]) {
    throw new Error("Sociedade invalida. Escolha uma opcao disponivel.");
  }

  const documentclass = SOCIEDADES[dados.sociedade].documentclass;
  const linhas = [
    `\\documentclass{${documentclass}}`,
    "",
    "\\begin{document}",
    "",
    "\\cabecalho",
    "",
    "\\info"
      + `{${escaparLatex(dados.data_elaboracao)}}`
      + `{${escaparLatex(dados.autor)}}`
      + `{${escaparLatex(dados.data_reuniao)}}`
      + `{${escaparLatex(dados.local_reuniao)}}`,
    "",
    "\\begin{membros}",
  ];

  for (const [indice, membro] of dados.membros.entries()) {
    linhas.push(
      "    \\membro"
      + `{${indice + 1}}`
      + `{${escaparLatex(membro.nome)}}`
      + `{${escaparLatex(membro.cargo)}}`,
    );
  }

  linhas.push("\\end{membros}", "\\newpage", "", "\\begin{pautas}");

  for (const pauta of dados.pautas) {
    linhas.push(`    \\pauta{${escaparLatex(pauta)}}`);
  }

  linhas.push("\\end{pautas}", "", "\\begin{resultados}");

  for (const resultado of dados.resultados) {
    linhas.push(`    \\resultado{${escaparLatex(resultado)}}`);
  }

  linhas.push("\\end{resultados}", "", "\\begin{anexos}");

  for (const [legenda, caminhoArquivo] of anexosPreparados) {
    linhas.push(`    \\anexo{${escaparLatex(legenda)}}{${caminhoArquivo}}`);
  }

  linhas.push("\\end{anexos}", "\\assinaturas", "", "\\end{document}", "");
  return linhas.join("\n");
}

async function limparArquivosAuxiliares(caminhoTex) {
  await Promise.all(
    AUXILIARY_SUFFIXES.map(async (sufixo) => {
      const alvo = caminhoTex.replace(/\.tex$/i, sufixo);
      try {
        await unlink(alvo);
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw error;
        }
      }
    }),
  );
}

export async function compilarPdf(caminhoTex) {
  const comando = [
    "-interaction=nonstopmode",
    "-halt-on-error",
    path.basename(caminhoTex),
  ];

  const resultado = spawnSync("pdflatex", comando, {
    cwd: path.dirname(caminhoTex),
    encoding: "utf8",
  });

  if (resultado.error) {
    throw new Error("O comando 'pdflatex' nao esta disponivel no sistema.");
  }

  if (resultado.status !== 0) {
    const mensagem = (resultado.stderr || resultado.stdout || "").trim();
    throw new Error(
      "Falha ao compilar o PDF.\n\n"
      + `Comando: pdflatex ${comando.join(" ")}\n\n`
      + `Saida:\n${mensagem.slice(-2500)}`,
    );
  }

  await limparArquivosAuxiliares(caminhoTex);
  return caminhoTex.replace(/\.tex$/i, ".pdf");
}

export async function gerarAta(dados, options = {}) {
  const dadosLimpos = limparDados(dados);
  if (!SOCIEDADES[dadosLimpos.sociedade]) {
    throw new Error("Sociedade invalida.");
  }

  const pastaSociedade = options.outputDir || SOCIEDADES[dadosLimpos.sociedade].folder;
  const nomeSaida = normalizarNomeSaida(dadosLimpos.arquivo_saida);
  const baseDir = options.baseDir || ROOT_DIR;
  const anexosPreparados = await prepararAnexos(dadosLimpos, pastaSociedade, baseDir, nomeSaida);
  const conteudoTex = renderizarTex(dadosLimpos, anexosPreparados);
  const caminhoTex = path.join(pastaSociedade, `${nomeSaida}.tex`);

  await writeFile(caminhoTex, conteudoTex, "utf8");

  const saidas = { tex: caminhoTex };
  if (options.compilar) {
    saidas.pdf = await compilarPdf(caminhoTex);
  }

  return saidas;
}

export async function criarDiretorioTemporario() {
  return mkdtemp(path.join(os.tmpdir(), "atas-ieee-web-"));
}

export async function removerDiretorio(diretorio) {
  if (!diretorio) {
    return;
  }

  await rm(diretorio, { force: true, recursive: true });
}

export async function lerArquivo(caminhoArquivo) {
  return readFile(caminhoArquivo);
}
