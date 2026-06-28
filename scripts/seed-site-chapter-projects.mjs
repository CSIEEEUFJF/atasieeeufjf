import "dotenv/config";
import { getPrisma } from "../src/lib/db.js";

const projects = [
  {
    chapter: "CS",
    title: "Sistema Interno",
    subtitle: "Sistema para gerenciamento do Ramo",
    description:
      "Sistema Interno do Ramo Estudantil IEEE UFJF, reunindo atas, tarefas, calendário, membros e rotinas de gestão em uma única plataforma.",
    imageUrl: "/assets/ramo-ieee-ufjf-blue.svg",
    linkUrl: "https://interno.ieeeufjf.com.br/demo",
    showOnChapter: true,
    showOnHome: true,
  },
  {
    chapter: "IAS",
    title: "ENTENSE",
    subtitle: "Encontro de Tecnologias e Engenharia",
    description:
      "Evento desenvolvido pela IAS para aproximar estudantes, profissionais e empresas em torno de tecnologia, inovação e engenharia.",
    imageUrl: "/assets/projects/entense-preview.png",
    linkUrl: "https://entense.ieeeufjf.com.br",
    showOnChapter: true,
    showOnHome: true,
  },
  {
    chapter: "EdSoc",
    title: "HELPIEEE",
    subtitle: "Guia do Calouro",
    description:
      "Projeto desenvolvido pela EdSoc para apoiar estudantes ingressantes com informações úteis sobre a UFJF, cursos, rotina acadêmica e vida universitária.",
    imageUrl: "/assets/projects/helpieee-preview.png",
    linkUrl: "https://help.ieeeufjf.com.br",
    showOnChapter: true,
    showOnHome: true,
  },
  {
    chapter: "RAS",
    title: "Elevador Didático",
    description:
      "Visando um maior ensinamento da robótica, o projeto tem como principal objetivo o ensino e o desenvolvimento do estudo da robótica. É uma réplica real de sistemas industriais, compondo comunicação, programação e saídas de controle.",
  },
  {
    chapter: "RAS",
    title: "Lego NXT 2.0",
    description:
      "Várias montagens para diferentes funções, com o objetivo de incentivar crianças a ingressarem na Engenharia, levando robôs a escolas e feiras de ciências da região.",
  },
  {
    chapter: "RAS",
    title: "Braço Robótico",
    description:
      "Sistema com cinco motores DC para movimentar um braço robótico, usando Arduino UNO e comando via Bluetooth em conexão com celular, voltado a apresentações e atividades práticas.",
  },
  {
    chapter: "RAS",
    title: "Seguidor de Linha",
    description:
      "Carro autônomo de alta performance com sensores de refletância, microcontrolador e motores, desenvolvido para seguir faixas no menor tempo possível em cenários competitivos de robótica.",
  },
  {
    chapter: "IAS",
    title: "Aquecedor Solar de Baixo Custo",
    description:
      "Construção de um painel de captação solar para aquecer água de maneira sustentável, usando materiais baratos e acessíveis a pequenas comunidades e famílias de baixa renda.",
  },
  {
    chapter: "IAS",
    title: "Visitas Técnicas",
    description:
      "Visitas técnicas voltadas à interação estudantil-profissional, aproximando membros do futuro ambiente de trabalho, pesquisa e inovação.",
  },
  {
    chapter: "IAS",
    title: "Organização de eventos",
    description:
      "Participação na organização da COBEP, agregando experiência em eventos técnicos e ampliando a interação com empresas, investidores e pesquisadores da área.",
  },
  {
    chapter: "PES",
    title: "Ação Solidária de Conserto de Equipamentos",
    description:
      "Ação solidária de conserto de eletrodomésticos e eletroeletrônicos de famílias atingidas pelas chuvas em Juiz de Fora, em parceria com a TPF Soluções.",
  },
  {
    chapter: "PES",
    title: "Projeto Biodigestor",
    description:
      "Pesquisa, desenvolvimento e estudo de um biodigestor doado ao projeto após o bom resultado de equipe do Ramo no Desafio Biomassa, em parceria com o IEEE SIGHT UFJF.",
  },
  {
    chapter: "PES",
    title: "Gerador Síncrono Didático",
    description:
      "Projeto construído com sucata para tornar mais didática a explicação sobre geração de energia, demandando estudos sobre princípios de geração e grande comprometimento dos membros.",
  },
  {
    chapter: "PES",
    title: "Levitador Magnético",
    description:
      "Projeto construído no segundo período de 2017, permitindo visualizar um anel metálico levitando em torno de uma barra e exigindo estudos sobre eletromagnetismo.",
  },
  {
    chapter: "PES",
    title: "Projeto RES (Renewable Energy in Schools)",
    description:
      "Projeto global da PES para divulgar fontes renováveis de energia a estudantes do ensino básico e públicos leigos, com apresentações em escolas, feiras e estandes.",
  },
  {
    chapter: "PES",
    title: "Projeto RES 2.0",
    description:
      "Nova versão do Projeto RES, organizada em apresentações para Ensino Médio e Ensino Fundamental II, além da exibição do Kit RES em palestras e eventos.",
  },
  {
    chapter: "PES",
    title: "Smart City",
    description:
      "Construção de uma maquete de cidade inteligente movida por fontes renováveis, estudando proporções entre fontes renováveis e não renováveis e redes de distribuição.",
  },
  {
    chapter: "PES",
    title: "Projeto REC (Renewable Energy in College)",
    description:
      "Extensão do Projeto RES para graduação, abordando a situação de energias renováveis no Brasil e no mundo em aulas, palestras e apresentações na UFJF.",
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
      "Projeto em parceria com o IEEE SIGHT UFJF e extensão da UFJF desde 2018, apresentado como laboratório de ciências acessível para incentivar estudantes da educação básica nas áreas de exatas.",
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
      "Projeto voltado a incentivar meninas e meninos da engenharia por meio de eventos, palestras, treinamentos e intervenções na Faculdade de Engenharia da UFJF.",
  },
  {
    chapter: "WIE",
    title: "Mutirão Tecnológico",
    description:
      "Ações voltadas a mulheres em vulnerabilidade social, levando conhecimento técnico diretamente à sociedade em temas como instalações elétricas residenciais.",
  },
  {
    chapter: "WIE",
    title: "WIE Tech",
    description:
      "Projeto que reúne treinamentos ministrados aos membros WIE UFJF e à comunidade externa, incluindo grupo de programação, oficina de Libras e capacitações técnicas.",
  },
  {
    chapter: "SIGHT",
    title: "Projeto HumanizAÇÃO",
    description:
      "Projeto voltado a ensinar e atuar em comunidades em vulnerabilidade social, com frentes de civil, elétrica, conscientização ambiental, crianças e rodas de conversa.",
  },
  {
    chapter: "SIGHT",
    title: "Domótica",
    description:
      "Projeto em parceria com a CAS para desenvolver e aplicar tecnologias de automação residencial voltadas à autonomia de pessoas com limitações físicas.",
  },
  {
    chapter: "SIGHT",
    title: "MATLAB",
    description:
      "Projeto para capacitar membros do IEEE SIGHT UFJF a ministrarem minicursos para alunos da Faculdade de Engenharia da UFJF.",
  },
  {
    chapter: "SIGHT",
    title: "Circuito Científico",
    description:
      "Projeto em parceria com o IEEE WIE UFJF para ensinar ciências de forma divertida e dinâmica a alunos da rede básica, com laboratório itinerante de baixo custo.",
  },
  {
    chapter: "SIGHT",
    title: "Campanhas Sociais",
    description:
      "Ações sociais como Doe Futuros, com doação de materiais escolares, e Campanha do Agasalho, em parceria com a ONG Anjos da Rua de Juiz de Fora.",
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
    subtitle: project.subtitle || project.title,
    isPublic: true,
    position: index,
    showOnChapter: typeof project.showOnChapter === "boolean" ? project.showOnChapter : true,
    showOnHome: typeof project.showOnHome === "boolean" ? project.showOnHome : false,
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
console.log(`Projetos antigos do site sincronizados: ${projects.length}`);
