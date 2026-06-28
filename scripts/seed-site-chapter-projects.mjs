import "dotenv/config";
import { getPrisma } from "../src/lib/db.js";

const projects = [
  {
    chapter: "RAS",
    title: "Elevador Didático",
    description:
      "Réplica funcional voltada ao ensino de robótica, reunindo comunicação, programação e saídas de controle em uma estrutura inspirada em sistemas industriais.",
  },
  {
    chapter: "RAS",
    title: "Lego NXT 2.0",
    description:
      "Montagens com diferentes funções para incentivar crianças a se interessarem por Engenharia em escolas e feiras de ciências.",
  },
  {
    chapter: "RAS",
    title: "Braço Robótico",
    description:
      "Sistema com motores DC, Arduino UNO e comando via Bluetooth, usado em apresentações e atividades práticas.",
  },
  {
    chapter: "RAS",
    title: "Seguidor de Linha",
    description:
      "Carro autônomo de alta performance com sensores de refletância, microcontrolador e motores, voltado ao cenário competitivo de robótica.",
  },
  {
    chapter: "IAS",
    title: "Aquecedor Solar de Baixo Custo",
    description:
      "Construção de um painel de captação solar para aquecer água de forma sustentável, usando materiais baratos e acessíveis.",
  },
  {
    chapter: "IAS",
    title: "Visitas Técnicas",
    description:
      "Atividades de integração estudantil-profissional, aproximando membros de ambientes reais de trabalho e pesquisa.",
  },
  {
    chapter: "IAS",
    title: "Organização de Eventos",
    description:
      "Participação na organização de eventos técnicos, como a COBEP, ampliando contato com empresas, investidores e pesquisadores.",
  },
  {
    chapter: "PES",
    title: "Ação Solidária de Conserto de Equipamentos",
    description:
      "Ação de reparo de eletrodomésticos e eletroeletrônicos para famílias atingidas por chuvas em Juiz de Fora, em parceria com a TPF Soluções.",
  },
  {
    chapter: "PES",
    title: "Projeto Biodigestor",
    description:
      "Pesquisa e desenvolvimento de biodigestor em parceria com o IEEE SIGHT UFJF, a partir de resultados no Desafio Biomassa.",
  },
  {
    chapter: "PES",
    title: "Projeto RES",
    description:
      "Iniciativa para divulgar fontes renováveis de energia a estudantes do ensino básico e públicos leigos, usando kits didáticos de energia solar, eólica e eletrólise.",
  },
  {
    chapter: "PES",
    title: "Smart City",
    description:
      "Maquete de cidade inteligente movida por fontes renováveis, usada para estudar distribuição e proporções entre fontes renováveis e não renováveis.",
  },
  {
    chapter: "CS",
    title: "Projetos de software",
    description:
      "Desenvolvimento de sistemas e ferramentas digitais para o Ramo e para a comunidade acadêmica.",
  },
  {
    chapter: "CS",
    title: "Pesquisa aplicada",
    description:
      "Iniciativas em tecnologias emergentes, engenharia de software, sistemas embarcados e redes de computadores.",
  },
  {
    chapter: "WIE",
    title: "Circuito Científico",
    description:
      "Laboratório de ciências acessível, em parceria com o IEEE SIGHT UFJF, que estimula estudantes da educação básica a se interessarem por exatas.",
  },
  {
    chapter: "WIE",
    title: "De Engenheira para Futura Engenheira",
    description:
      "Divulgação de histórias de mulheres graduandas e graduadas em Engenharia, mostrando trajetórias, obstáculos e possibilidades de carreira.",
  },
  {
    chapter: "WIE",
    title: "Motiva WIE",
    description:
      "Eventos, palestras, treinamentos e intervenções de incentivo para meninas e meninos da engenharia.",
  },
  {
    chapter: "WIE",
    title: "Mutirão Tecnológico",
    description:
      "Ações voltadas a mulheres em vulnerabilidade social, levando conhecimento técnico diretamente à sociedade.",
  },
  {
    chapter: "SIGHT",
    title: "Projeto HumanizAÇÃO",
    description:
      "Iniciativa em comunidades vulneráveis com frentes de civil, elétrica, conscientização ambiental, atividades para crianças e rodas de conversa com adolescentes.",
  },
  {
    chapter: "SIGHT",
    title: "Domótica",
    description:
      "Projeto em parceria com a CAS para desenvolver aplicações de automação residencial voltadas à autonomia de pessoas com limitações físicas.",
  },
  {
    chapter: "SIGHT",
    title: "MATLAB",
    description:
      "Capacitação de membros para ministrar minicursos e apoiar alunos de graduação no domínio da ferramenta.",
  },
  {
    chapter: "SIGHT",
    title: "Campanhas Sociais",
    description:
      "Campanhas como Doe Futuros e Campanha do Agasalho, arrecadando materiais escolares e roupas para pessoas em vulnerabilidade.",
  },
];

const prisma = getPrisma();

for (const [index, project] of projects.entries()) {
  const existing = await prisma.siteProject.findFirst({
    where: {
      chapter: project.chapter,
      title: project.title,
    },
  });

  const data = {
    ...project,
    subtitle: project.title,
    isPublic: true,
    position: index,
    showOnChapter: true,
    showOnHome: false,
  };

  if (existing) {
    await prisma.siteProject.update({
      data,
      where: { id: existing.id },
    });
    continue;
  }

  await prisma.siteProject.create({ data });
}

await prisma.$disconnect();
console.log(`Projetos de capítulos sincronizados: ${projects.length}`);
