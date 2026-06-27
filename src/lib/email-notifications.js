import { Resend } from "resend";

import { expandirSociedadesParaBusca, SOCIEDADE_LABELS } from "./ata";
import { getPrisma } from "./db";

const BRT_TIME_ZONE = "America/Sao_Paulo";
const GLOBAL_CHAPTER = "Todos";
const MAX_EMAIL_RECIPIENTS = 200;

let resendClient = null;

function emailNotificationsEnabled() {
  return process.env.EMAIL_NOTIFICATIONS_ENABLED === "true"
    && Boolean(process.env.RESEND_API_KEY)
    && Boolean(process.env.EMAIL_FROM);
}

function getResendClient() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
}

function isDeliverableEmail(email) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    && !cleanEmail.endsWith("@local.atas-ieee");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(value) {
  if (!value) {
    return "Sem prazo definido";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: BRT_TIME_ZONE,
    year: "numeric",
  }).format(value).replace(",", "");
}

function chapterLabel(chapter) {
  if (chapter === GLOBAL_CHAPTER) {
    return "Todos os capítulos";
  }

  return SOCIEDADE_LABELS[chapter] ?`${chapter} - ${SOCIEDADE_LABELS[chapter]}` : chapter;
}

async function listChapterNotificationRecipients(chapter) {
  const userWhere = chapter === GLOBAL_CHAPTER
    ?{}
    :{
        chapters: {
          some: {
            chapterKey: { in: expandirSociedadesParaBusca([chapter]) },
          },
        },
      };

  const [users, contacts] = await Promise.all([
    getPrisma().user.findMany({
      orderBy: { name: "asc" },
      select: { email: true, name: true },
      take: MAX_EMAIL_RECIPIENTS,
      where: userWhere,
    }),
    getPrisma().memberContact.findMany({
      orderBy: { name: "asc" },
      select: { chapters: true, email: true, name: true },
      take: MAX_EMAIL_RECIPIENTS,
    }),
  ]);

  const recipients = new Map();
  users.forEach((user) => {
    const email = String(user.email || "").trim().toLowerCase();
    if (isDeliverableEmail(email)) {
      recipients.set(email, {
        email,
        name: user.name || email,
      });
    }
  });

  contacts.forEach((contact) => {
    const chapters = Array.isArray(contact.chapters) ?contact.chapters : [];
    if (chapter !== GLOBAL_CHAPTER && !chapters.includes(chapter)) {
      return;
    }

    const email = String(contact.email || "").trim().toLowerCase();
    if (isDeliverableEmail(email)) {
      recipients.set(email, {
        email,
        name: contact.name || email,
      });
    }
  });

  return [...recipients.values()];
}

function taskEmailHtml({ creator, task }) {
  const safeTitle = escapeHtml(task.title);
  const safeDescription = escapeHtml(task.description || "Sem descrição.");
  const safeChapter = escapeHtml(chapterLabel(task.chapter));
  const safeCreator = escapeHtml(creator?.name || "Sistema Interno IEEE UFJF");
  const safeDueDate = escapeHtml(formatDateTime(task.dueDate));

  return `
    <div style="font-family: Arial, sans-serif; color: #17233c; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Nova tarefa cadastrada</h1>
      <p style="margin: 0 0 16px;">Uma nova tarefa foi criada no Sistema Interno IEEE UFJF.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tr><td style="padding: 8px 0; font-weight: 700;">Título</td><td style="padding: 8px 0;">${safeTitle}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: 700;">Capítulo</td><td style="padding: 8px 0;">${safeChapter}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: 700;">Prazo</td><td style="padding: 8px 0;">${safeDueDate}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: 700;">Criada por</td><td style="padding: 8px 0;">${safeCreator}</td></tr>
      </table>
      <p style="margin: 16px 0 0;"><strong>Descrição:</strong><br>${safeDescription}</p>
      <p style="margin: 20px 0 0;">
        <a href="https://interno.ieeeufjf.com.br/tarefas" style="color: #00629B; font-weight: 700;">Abrir tarefas</a>
      </p>
    </div>
  `;
}

function taskEmailText({ creator, task }) {
  return [
    "Nova tarefa cadastrada no Sistema Interno IEEE UFJF.",
    "",
    `Título: ${task.title}`,
    `Capítulo: ${chapterLabel(task.chapter)}`,
    `Prazo: ${formatDateTime(task.dueDate)}`,
    `Criada por: ${creator?.name || "Sistema Interno IEEE UFJF"}`,
    "",
    `Descrição: ${task.description || "Sem descrição."}`,
    "",
    "Acesse: https://interno.ieeeufjf.com.br/tarefas",
  ].join("\n");
}

function welcomeEmailHtml({ initialPassword, user }) {
  const safeName = escapeHtml(user.name);
  const safeUsername = escapeHtml(user.username);
  const safePassword = escapeHtml(initialPassword);

  return `
    <div style="font-family: Arial, sans-serif; color: #17233c; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Bem-vindo ao Sistema Interno IEEE UFJF</h1>
      <p style="margin: 0 0 16px;">Olá, ${safeName}. Seu acesso ao sistema interno foi criado.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tr><td style="padding: 8px 0; font-weight: 700;">Usuário</td><td style="padding: 8px 0;">${safeUsername}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: 700;">Senha inicial</td><td style="padding: 8px 0;">${safePassword}</td></tr>
      </table>
      <p style="margin: 16px 0 0;">Por segurança, troque sua senha no primeiro acesso clicando no seu nome no canto superior do sistema.</p>
      <p style="margin: 20px 0 0;">
        <a href="https://interno.ieeeufjf.com.br/login" style="color: #00629B; font-weight: 700;">Acessar o sistema</a>
      </p>
    </div>
  `;
}

function welcomeEmailText({ initialPassword, user }) {
  return [
    "Bem-vindo ao Sistema Interno IEEE UFJF.",
    "",
    `Olá, ${user.name}. Seu acesso ao sistema interno foi criado.`,
    "",
    `Usuário: ${user.username}`,
    `Senha inicial: ${initialPassword}`,
    "",
    "Por segurança, troque sua senha no primeiro acesso clicando no seu nome no canto superior do sistema.",
    "",
    "Acesse: https://interno.ieeeufjf.com.br/login",
  ].join("\n");
}

function recurrenceLabel(event) {
  if (!event.recurrenceSeriesId && Number(event.recurrenceCount || 0) <= 1) {
    return "";
  }

  const labels = {
    biweekly: "quinzenal",
    daily: "diária",
    monthly: "mensal",
    weekly: "semanal",
  };

  return `Evento recorrente: frequência ${labels[event.recurrenceFrequency] || "recorrente"}, ${event.recurrenceCount || 1} ocorrência(s).`;
}

function eventEmailHtml({ creator, event }) {
  const safeTitle = escapeHtml(event.title);
  const safeDescription = escapeHtml(event.description || "Sem descrição.");
  const safeLocation = escapeHtml(event.location || "Local não informado");
  const safeChapter = escapeHtml(chapterLabel(event.chapter));
  const safeCreator = escapeHtml(creator?.name || "Sistema Interno IEEE UFJF");
  const safeStartTime = escapeHtml(formatDateTime(event.startTime));
  const safeEndTime = escapeHtml(formatDateTime(event.endTime));
  const recurrence = recurrenceLabel(event);

  return `
    <div style="font-family: Arial, sans-serif; color: #17233c; line-height: 1.5;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Novo evento no calendário</h1>
      <p style="margin: 0 0 16px;">Um novo evento foi agendado no Sistema Interno IEEE UFJF.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tr><td style="padding: 8px 0; font-weight: 700;">Evento</td><td style="padding: 8px 0;">${safeTitle}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: 700;">Capítulo</td><td style="padding: 8px 0;">${safeChapter}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: 700;">Início</td><td style="padding: 8px 0;">${safeStartTime}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: 700;">Fim</td><td style="padding: 8px 0;">${safeEndTime}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: 700;">Local</td><td style="padding: 8px 0;">${safeLocation}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: 700;">Criado por</td><td style="padding: 8px 0;">${safeCreator}</td></tr>
      </table>
      ${recurrence ?`<p style="margin: 16px 0 0;"><strong>${escapeHtml(recurrence)}</strong></p>` : ""}
      <p style="margin: 16px 0 0;"><strong>Descrição:</strong><br>${safeDescription}</p>
      <p style="margin: 20px 0 0;">
        <a href="https://interno.ieeeufjf.com.br/calendario" style="color: #00629B; font-weight: 700;">Abrir calendário</a>
      </p>
    </div>
  `;
}

function eventEmailText({ creator, event }) {
  const recurrence = recurrenceLabel(event);
  return [
    "Novo evento no calendário do Sistema Interno IEEE UFJF.",
    "",
    `Evento: ${event.title}`,
    `Capítulo: ${chapterLabel(event.chapter)}`,
    `Início: ${formatDateTime(event.startTime)}`,
    `Fim: ${formatDateTime(event.endTime)}`,
    `Local: ${event.location || "Local não informado"}`,
    `Criado por: ${creator?.name || "Sistema Interno IEEE UFJF"}`,
    recurrence ?`Recorrência: ${recurrence}` : "",
    "",
    `Descrição: ${event.description || "Sem descrição."}`,
    "",
    "Acesse: https://interno.ieeeufjf.com.br/calendario",
  ].filter(Boolean).join("\n");
}

async function sendSingleEmail({ html, subject, text, to }) {
  const enabled = emailNotificationsEnabled();
  if (!enabled || !isDeliverableEmail(to?.email)) {
    return { enabled, sent: 0 };
  }

  await getResendClient().emails.send({
    from: process.env.EMAIL_FROM,
    html,
    subject,
    text,
    to: `${to.name || to.email} <${to.email}>`,
  });

  return { enabled: true, sent: 1 };
}

export async function notifyMembersAboutCreatedTask({ creator, task }) {
  if (!emailNotificationsEnabled()) {
    return { enabled: false, sent: 0 };
  }

  const recipients = await listChapterNotificationRecipients(task.chapter);
  if (!recipients.length) {
    return { enabled: true, sent: 0 };
  }

  const subject = `[IEEE UFJF] Nova tarefa: ${task.title}`;
  const html = taskEmailHtml({ creator, task });
  const text = taskEmailText({ creator, task });
  const results = await Promise.allSettled(
    recipients.map((recipient) =>
      getResendClient().emails.send({
        from: process.env.EMAIL_FROM,
        html,
        subject,
        text,
        to: `${recipient.name} <${recipient.email}>`,
      }),
    ),
  );

  return {
    enabled: true,
    failed: results.filter((result) => result.status === "rejected").length,
    sent: results.filter((result) => result.status === "fulfilled").length,
  };
}

export async function notifyUserWelcome({ initialPassword, user }) {
  return sendSingleEmail({
    html: welcomeEmailHtml({ initialPassword, user }),
    subject: "[IEEE UFJF] Seu acesso ao Sistema Interno",
    text: welcomeEmailText({ initialPassword, user }),
    to: {
      email: user.email,
      name: user.name,
    },
  });
}

export async function notifyMembersAboutCreatedEvent({ creator, events }) {
  const eventList = Array.isArray(events) ?events : [events].filter(Boolean);
  const firstEvent = eventList[0];
  if (!firstEvent || !emailNotificationsEnabled()) {
    return { enabled: false, sent: 0 };
  }

  const notificationEvent = {
    ...firstEvent,
    recurrenceCount: eventList.length > 1 ?eventList.length : firstEvent.recurrenceCount,
  };
  const recipients = await listChapterNotificationRecipients(firstEvent.chapter);
  if (!recipients.length) {
    return { enabled: true, sent: 0 };
  }

  const subject = `[IEEE UFJF] Novo evento: ${firstEvent.title}`;
  const html = eventEmailHtml({ creator, event: notificationEvent });
  const text = eventEmailText({ creator, event: notificationEvent });
  const results = await Promise.allSettled(
    recipients.map((recipient) =>
      getResendClient().emails.send({
        from: process.env.EMAIL_FROM,
        html,
        subject,
        text,
        to: `${recipient.name} <${recipient.email}>`,
      }),
    ),
  );

  return {
    enabled: true,
    failed: results.filter((result) => result.status === "rejected").length,
    sent: results.filter((result) => result.status === "fulfilled").length,
  };
}
