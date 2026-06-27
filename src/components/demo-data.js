export const DEMO_CHAPTERS = [
  { key: "Ramo", label: "Ramo IEEE UFJF" },
  { key: "CAS", label: "Circuits and Systems Society" },
  { key: "RAS", label: "Robotics and Automation Society" },
  { key: "CS", label: "Computer Society" },
  { key: "PES", label: "Power & Energy Society" },
];

export const DEMO_USER = {
  canManageMembers: true,
  chapters: DEMO_CHAPTERS.map((chapter) => chapter.key),
  id: "demo-user",
  isAdmin: true,
  manageableChapters: DEMO_CHAPTERS.map((chapter) => chapter.key),
  name: "Visitante",
  username: "demo",
};

export const DEMO_MEMBERS = [
  {
    cargo: "Presidente",
    chapterRoles: { Ramo: "Presidente" },
    chapters: ["Ramo"],
    id: "demo-alex",
    isAdmin: true,
    name: "Alex Demo",
    username: "alex.demo",
    usesChapterRoles: true,
  },
  {
    cargo: "Vice-Presidente",
    chapterRoles: { CAS: "Presidente", RAS: "Presidente" },
    chapters: ["CAS", "RAS"],
    id: "demo-bianca",
    isAdmin: false,
    name: "Bianca Demo",
    username: "bianca.demo",
    usesChapterRoles: true,
  },
  {
    cargo: "Secretário",
    chapterRoles: { PES: "Secretário", Ramo: "Secretário" },
    chapters: ["PES", "Ramo"],
    id: "demo-caio",
    isAdmin: false,
    name: "Caio Demo",
    username: "caio.demo",
    usesChapterRoles: true,
  },
  {
    cargo: "Membro",
    chapterRoles: { CS: "Membro", CAS: "Membro" },
    chapters: ["CS", "CAS"],
    id: "demo-daniela",
    isAdmin: false,
    name: "Daniela Demo",
    username: "daniela.demo",
    usesChapterRoles: true,
  },
];

function dateAt(dayOffset, hour, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

export function createDemoTasks() {
  return [
    {
      assignedTo: { id: "demo-bianca", name: "Bianca Demo" },
      assignedToId: "demo-bianca",
      chapter: "CAS",
      description: "Fechar o roteiro e confirmar os materiais do encontro.",
      dueDate: dateAt(2, 18),
      id: "demo-task-1",
      priority: "high",
      status: "pending",
      title: "Organizar reunião técnica da CAS",
    },
    {
      assignedTo: { id: "demo-caio", name: "Caio Demo" },
      assignedToId: "demo-caio",
      chapter: "PES",
      description: "Atualizar responsáveis e validar os horários antes da divulgação.",
      dueDate: dateAt(4, 12),
      id: "demo-task-2",
      priority: "normal",
      status: "doing",
      title: "Revisar calendário de atividades",
    },
    {
      assignedTo: { id: "demo-alex", name: "Alex Demo" },
      assignedToId: "demo-alex",
      chapter: "Ramo",
      description: "Separar os indicadores por capítulo para a próxima reunião.",
      dueDate: dateAt(-1, 17),
      id: "demo-task-3",
      priority: "low",
      status: "done",
      title: "Consolidar métricas do mês",
    },
  ];
}

export function createDemoEvents() {
  return [
    {
      chapter: "Ramo",
      description: "Alinhamento semanal da diretoria e presidentes de capítulos.",
      endTime: dateAt(0, 19),
      id: "demo-event-1",
      location: "Sala do Ramo",
      startTime: dateAt(0, 18),
      title: "Reunião da diretoria",
    },
    {
      chapter: "CAS",
      description: "Apresentação de ideias para o primeiro workshop do capítulo.",
      endTime: dateAt(0, 21),
      id: "demo-event-2",
      location: "Laboratório 3",
      startTime: dateAt(0, 20),
      title: "Planejamento CAS",
    },
    {
      chapter: "RAS",
      description: "Demonstração e revisão de tarefas do projeto de robótica.",
      endTime: dateAt(3, 17),
      id: "demo-event-3",
      location: "Maker Space",
      startTime: dateAt(3, 15),
      title: "Oficina RAS",
    },
  ];
}

export function createDemoMetrics() {
  return [
    {
      chapter: "Ramo",
      label: "Ramo IEEE UFJF",
      members: [
        { completed: 4, id: "demo-alex", name: "Alex Demo", open: 2, registered: 6 },
        { completed: 2, id: "demo-caio", name: "Caio Demo", open: 1, registered: 3 },
      ],
      totals: { completed: 6, open: 3, registered: 9 },
    },
    {
      chapter: "CAS",
      label: "Circuits and Systems Society",
      members: [
        { completed: 3, id: "demo-bianca", name: "Bianca Demo", open: 2, registered: 5 },
        { completed: 1, id: "demo-daniela", name: "Daniela Demo", open: 1, registered: 2 },
      ],
      totals: { completed: 4, open: 3, registered: 7 },
    },
    {
      chapter: "RAS",
      label: "Robotics and Automation Society",
      members: [
        { completed: 2, id: "demo-bianca", name: "Bianca Demo", open: 1, registered: 3 },
      ],
      totals: { completed: 2, open: 1, registered: 3 },
    },
  ];
}

export function createDemoAtas() {
  const createdAt = dateAt(-14, 10);
  const updatedAt = dateAt(-2, 16, 30);

  return [
    {
      attachmentCount: 0,
      attachments: [],
      createdAt,
      form: {
        anexos: [],
        autor: "Visitante Demo",
        data_elaboracao: "27/06/2026",
        data_reuniao: "25/06/2026",
        local_reuniao: "Sala do Ramo",
        membros: [
          { cargo: "Presidente", id: "demo-alex", nome: "Alex Demo" },
          { cargo: "Membro", id: "demo-daniela", nome: "Daniela Demo" },
        ],
        pautasText: "1. Planejamento de atividades\n2. Organização de tarefas",
        resultadosText: "1. Calendário aprovado\n2. Responsáveis definidos",
        sociedade: "CAS",
        titulo: "Reunião demonstrativa CAS",
      },
      id: "demo-ata-cas",
      outputName: "ata_demo_cas",
      sociedade: "CAS",
      title: "Reunião demonstrativa CAS",
      updatedAt,
    },
    {
      attachmentCount: 0,
      attachments: [],
      createdAt: dateAt(-10, 9),
      form: {
        anexos: [],
        autor: "Visitante Demo",
        data_elaboracao: "27/06/2026",
        data_reuniao: "20/06/2026",
        local_reuniao: "Sala do Ramo",
        membros: [
          { cargo: "Presidente-Ramo", id: "demo-alex", nome: "Alex Demo" },
          { cargo: "Secretário-Ramo", id: "demo-caio", nome: "Caio Demo" },
        ],
        pautasText: "1. Indicadores gerais\n2. Próximos eventos",
        resultadosText: "1. Métricas revisadas\n2. Eventos mantidos no calendário",
        sociedade: "Ramo",
        titulo: "Reunião demonstrativa do Ramo",
      },
      id: "demo-ata-ramo",
      outputName: "ata_demo_ramo",
      sociedade: "Ramo",
      title: "Reunião demonstrativa do Ramo",
      updatedAt: dateAt(-1, 11),
    },
  ];
}
