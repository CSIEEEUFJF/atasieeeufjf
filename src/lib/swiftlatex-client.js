const SWIFTLATEX_SCRIPTS = [
  "/swiftlatex/PdfTeXEngine.js",
];

let runtimePromise;
let formatBytesPromise;
let pdftexMapBytesPromise;
const societyBundleCache = new Map();
const SWIFTLATEX_CACHE_BUSTER = Date.now().toString(36);
const ATTACHMENT_EXTENSION_BY_MIME = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

function splitLines(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function texto(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizarNomeSaida(nome) {
  const nomeLimpo = (texto(nome, "ata_preenchida") || "ata_preenchida")
    .replace(/[^0-9A-Za-z._-]+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "");

  if (!nomeLimpo || nomeLimpo.toLowerCase() === "ata") {
    return "ata_preenchida";
  }

  return nomeLimpo;
}

function normalizarNomeArquivo(nome, mimeType = "") {
  const partes = String(nome || "").match(/^(.*?)(\.[^.]+)?$/);
  const stem = (partes?.[1] || "anexo")
    .replace(/[^0-9A-Za-z-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const normalizedMimeType = String(mimeType || "").trim().toLowerCase();
  const suffix = (
    ATTACHMENT_EXTENSION_BY_MIME[normalizedMimeType]
    || partes?.[2]
    || ".bin"
  ).toLowerCase().replace(/[^.0-9A-Za-z]+/g, "");
  return `${stem || "anexo"}${suffix || ".bin"}`;
}

function escaparLatex(textoBruto) {
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
    "ª": "\\textsuperscript{a}",
    "º": "\\textsuperscript{o}",
  };

  return String(textoBruto ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((linha) => [...linha].map((char) => substituicoes[char] ?? char).join(""))
    .join(" \\\\ ");
}

function dividirCargoCapitulo(cargo) {
  const match = texto(cargo).match(/^(.+?)-([A-Za-z0-9]+)$/);
  if (!match) {
    return null;
  }

  return {
    cargo: match[1].trim(),
    capitulo: match[2].trim(),
  };
}

function ehCargoDiretoria(cargo) {
  const cargoLimpo = texto(cargo);
  return Boolean(cargoLimpo && cargoLimpo !== "Membro");
}

function ehPresidenteDeOutroCapitulo(cargo, capitulo, sociedade) {
  return texto(cargo) === "Presidente" && texto(capitulo) && capitulo !== sociedade && capitulo !== "Ramo";
}

function ehDiretoriaDoCapituloAtual(cargo, capitulo, sociedade) {
  return ehCargoDiretoria(cargo) && texto(capitulo) === sociedade && sociedade !== "Ramo";
}

function formatarCargoCapitulo(cargo, capitulo) {
  const cargoLimpo = texto(cargo);
  const capituloLimpo = texto(capitulo);

  if (!cargoLimpo || cargoLimpo === "Membro" || !capituloLimpo) {
    return cargoLimpo;
  }

  return `${cargoLimpo}-${capituloLimpo}`;
}

function prioridadeMembroAta(membro, sociedade) {
  const cargoDividido = dividirCargoCapitulo(membro.cargo);
  const capitulo = texto(membro.boardChapter) || cargoDividido?.capitulo || (ehCargoDiretoria(membro.cargo) ? sociedade : "");

  if (sociedade !== "Ramo") {
    if (ehDiretoriaDoCapituloAtual(cargoDividido?.cargo || membro.cargo, capitulo, sociedade)) return 1;
    return ehPresidenteDeOutroCapitulo(cargoDividido?.cargo || membro.cargo, capitulo, sociedade) ?1 : 2;
  }

  if (capitulo === "Ramo") {
    return 0;
  }

  if (cargoDividido || ehCargoDiretoria(membro.cargo) || membro.isBoardRole) {
    return 1;
  }

  return 2;
}

function normalizarMembroAta(membro, sociedade) {
  const cargoDividido = dividirCargoCapitulo(membro.cargo);

  if (cargoDividido) {
    if (sociedade !== "Ramo" && ehDiretoriaDoCapituloAtual(cargoDividido.cargo, cargoDividido.capitulo, sociedade)) {
      return {
        ...membro,
        cargo: cargoDividido.cargo,
      };
    }

    if (sociedade !== "Ramo" && !ehPresidenteDeOutroCapitulo(cargoDividido.cargo, cargoDividido.capitulo, sociedade)) {
      return {
        ...membro,
        cargo: "Membro",
      };
    }

    return {
      ...membro,
      cargo: formatarCargoCapitulo(cargoDividido.cargo, cargoDividido.capitulo),
    };
  }

  if (ehCargoDiretoria(membro.cargo) || membro.isBoardRole) {
    const capitulo = texto(membro.boardChapter) || sociedade;
    if (sociedade !== "Ramo" && ehDiretoriaDoCapituloAtual(membro.cargo, capitulo, sociedade)) {
      return {
        ...membro,
        cargo: texto(membro.cargo),
      };
    }

    if (sociedade !== "Ramo" && !ehPresidenteDeOutroCapitulo(membro.cargo, capitulo, sociedade)) {
      return {
        ...membro,
        cargo: "Membro",
      };
    }

    return {
      ...membro,
      cargo: formatarCargoCapitulo(membro.cargo, capitulo),
    };
  }

  return {
    ...membro,
    cargo: "Membro",
  };
}

function prepararMembrosAta(membros, sociedade) {
  return Array.isArray(membros)
    ?membros
      .map((membro) => ({
        ...normalizarMembroAta(membro, sociedade),
        nome: texto(membro.nome),
      }))
      .filter((membro) => membro.nome || texto(membro.cargo))
      .sort((membroA, membroB) => {
        const prioridade = prioridadeMembroAta(membroA, sociedade) - prioridadeMembroAta(membroB, sociedade);
        if (prioridade !== 0) {
          return prioridade;
        }

        return texto(membroA.nome).localeCompare(texto(membroB.nome), "pt-BR");
      })
    : [];
}

function renderizarTex(documentclass, dados, anexosPreparados) {
  const membros = prepararMembrosAta(dados.membros, dados.sociedade);
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

  for (const [indice, membro] of membros.entries()) {
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

  for (const [legenda, caminho] of anexosPreparados) {
    linhas.push(`    \\anexo{${escaparLatex(legenda)}}{${caminho}}`);
  }

  linhas.push("\\end{anexos}", "\\assinaturas", "", "\\end{document}", "");
  return linhas.join("\n");
}

function getFolderSegments(filePath) {
  const parts = filePath.split("/").slice(0, -1).filter(Boolean);
  const folders = [];

  for (let index = 0; index < parts.length; index += 1) {
    folders.push(parts.slice(0, index + 1).join("/"));
  }

  return folders;
}

function ensureScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-swiftlatex="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }

      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Falha ao carregar ${src}.`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.swiftlatex = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Falha ao carregar ${src}.`)), {
      once: true,
    });
    document.head.appendChild(script);
  });
}

async function ensureRuntimeLoaded() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      for (const script of SWIFTLATEX_SCRIPTS) {
        await ensureScript(script);
      }

      if (
        typeof window === "undefined"
        || typeof window.PdfTeXEngine !== "function"
      ) {
        throw new Error("SwiftLaTeX não ficou disponível no navegador.");
      }
    })().catch((error) => {
      runtimePromise = undefined;
      throw error;
    });
  }

  return runtimePromise;
}

async function createPdftexEngine() {
  await ensureRuntimeLoaded();
  const pdftex = new window.PdfTeXEngine();
  await pdftex.loadEngine();
  return pdftex;
}

function normalizarMensagemSwiftlatex(error, fallback) {
  if (!error) {
    return fallback;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error.log === "string" && error.log.trim()) {
    return error.log;
  }

  return fallback;
}

function decodeBase64(content) {
  const binary = window.atob(content);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function fetchSocietyBundle(sociedade) {
  if (!societyBundleCache.has(sociedade)) {
    societyBundleCache.set(
      sociedade,
      (async () => {
        const response = await fetch(
          `/api/latex/project?sociedade=${encodeURIComponent(sociedade)}`,
          { cache: "force-cache" },
        );

        if (!response.ok) {
          let detail = `Não foi possível carregar o template da sociedade (${response.status}).`;
          try {
            const payload = await response.json();
            detail = payload.detail || detail;
          } catch {
            // ignore
          }
          throw new Error(detail);
        }

        return response.json();
      })().catch((error) => {
        societyBundleCache.delete(sociedade);
        throw error;
      }),
    );
  }

  return societyBundleCache.get(sociedade);
}

async function ensurePdftexMapBytes() {
  if (!pdftexMapBytesPromise) {
    pdftexMapBytesPromise = (async () => {
      const urls = [
        `/swiftlatex/pdftex.map?v=${SWIFTLATEX_CACHE_BUSTER}`,
        `/api/swiftlatex/texlive/pdftex/11/pdftex.map?v=${SWIFTLATEX_CACHE_BUSTER}`,
      ];
      const failures = [];

      for (const url of urls) {
        const response = await fetch(url, { cache: "no-store" });
        if (response.ok) {
          return new Uint8Array(await response.arrayBuffer());
        }

        failures.push(`${url}: ${response.status}`);
      }

      throw new Error(`Não foi possível carregar pdftex.map (${failures.join("; ")}).`);
    })().catch((error) => {
      pdftexMapBytesPromise = undefined;
      throw new Error(normalizarMensagemSwiftlatex(error, "Falha ao carregar pdftex.map."));
    });
  }

  return pdftexMapBytesPromise;
}

export async function preloadSwiftLatexForSociety(sociedade) {
  await Promise.all([
    fetchSocietyBundle(sociedade),
    ensurePdftexFormatBytes(),
    ensurePdftexMapBytes(),
  ]);
}

async function ensurePdftexFormatBytes() {
  if (!formatBytesPromise) {
    formatBytesPromise = (async () => {
      const pdftex = await createPdftexEngine();
      try {
        const formatResult = await pdftex.compileFormat();
        if (formatResult.status !== 0 || !formatResult.pdf) {
          throw new Error(formatResult.log || "Falha ao gerar o formato local do PdfTeX.");
        }

        return new Uint8Array(formatResult.pdf);
      } finally {
        pdftex.closeWorker();
      }
    })().catch((error) => {
      formatBytesPromise = undefined;
      throw new Error(normalizarMensagemSwiftlatex(error, "Falha ao preparar o formato do PdfTeX."));
    });
  }

  return formatBytesPromise;
}

async function createReadyPdftexEngine() {
  const [pdftex, formatBytes, pdftexMapBytes] = await Promise.all([
    createPdftexEngine(),
    ensurePdftexFormatBytes(),
    ensurePdftexMapBytes(),
  ]);
  pdftex.writeMemFSFile("swiftlatexpdftex.fmt", formatBytes);
  pdftex.writeMemFSFile("pdftex.map", pdftexMapBytes);
  return pdftex;
}

async function writeProjectFiles(engine, files) {
  const folders = new Set();

  for (const file of files) {
    for (const folder of getFolderSegments(file.path)) {
      folders.add(folder);
    }
  }

  for (const folder of folders) {
    engine.makeMemFSFolder(folder);
  }

  for (const file of files) {
    engine.writeMemFSFile(
      file.path,
      file.encoding === "base64" ?decodeBase64(file.content) : file.content,
    );
  }
}

async function prepararArquivosDeAnexo(anexos, outputName) {
  const nomeBase = normalizarNomeSaida(outputName);
  const anexosPreparados = [];
  const arquivos = [];

  for (const [indice, anexo] of anexos.entries()) {
    const mimeType = String(anexo.file?.type || anexo.mimeType || "").trim().toLowerCase();
    if (mimeType && !ATTACHMENT_EXTENSION_BY_MIME[mimeType]) {
      throw new Error("Use anexos em PNG, JPG ou PDF.");
    }

    const nomeArquivo = normalizarNomeArquivo(
      anexo.fileName || anexo.file?.name || "anexo",
      mimeType,
    );
    const caminho = `anexos_gerados/${nomeBase}-${String(indice + 1).padStart(2, "0")}-${nomeArquivo}`;
    const buffer = await anexo.file.arrayBuffer();

    anexosPreparados.push([anexo.legenda.trim(), caminho]);
    arquivos.push({
      content: new Uint8Array(buffer),
      path: caminho,
    });
  }

  return { anexosPreparados, arquivos };
}

export async function compileAtaPdfInBrowser({ form, outputName }) {
  const [{ documentclass, files: societyFiles }, pdftex] = await Promise.all([
    fetchSocietyBundle(form.sociedade),
    createReadyPdftexEngine(),
  ]);

  const dados = {
    autor: form.autor,
    data_elaboracao: form.data_elaboracao,
    data_reuniao: form.data_reuniao,
    local_reuniao: form.local_reuniao,
    sociedade: form.sociedade,
    membros: form.membros.map(({ boardChapter, cargo, isBoardRole, nome }) => ({
      boardChapter,
      cargo,
      isBoardRole,
      nome,
    })),
    pautas: splitLines(form.pautasText),
    resultados: splitLines(form.resultadosText),
  };

  const { anexosPreparados, arquivos } = await prepararArquivosDeAnexo(form.anexos, outputName);
  const tex = renderizarTex(documentclass, dados, anexosPreparados);
  const projectFiles = [
    ...societyFiles,
    ...arquivos.map((file) => ({ ...file, encoding: "binary" })),
    {
      content: tex,
      encoding: "utf8",
      path: "main.tex",
    },
  ];

  try {
    await writeProjectFiles(pdftex, projectFiles);
    pdftex.setEngineMainFile("main.tex");

    const pdfResult = await pdftex.compileLaTeX();
    if (pdfResult.status !== 0 || !pdfResult.pdf) {
      throw new Error(pdfResult.log || "Falha ao compilar a ata com PdfTeX.");
    }

    return {
      fileName: `${normalizarNomeSaida(outputName)}.pdf`,
      log: pdfResult.log || "",
      pdf: new Blob([pdfResult.pdf], { type: "application/pdf" }),
    };
  } finally {
    pdftex.closeWorker();
  }
}
