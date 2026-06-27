import { Resend } from "resend";

import { expandirSociedadesParaBusca, SOCIEDADE_LABELS } from "./ata";
import { getPrisma } from "./db";

const BRT_TIME_ZONE = "America/Sao_Paulo";
const GLOBAL_CHAPTER = "Todos";
const MAX_EMAIL_RECIPIENTS = 200;
const RESEND_EMAILS_PER_SECOND = 10;
const EMAIL_BATCH_DELAY_MS = 1000;
const SYSTEM_BASE_URL = "https://interno.ieeeufjf.com.br";

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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function sendEmailBatches(messages) {
  const results = [];
  for (let index = 0; index < messages.length; index += RESEND_EMAILS_PER_SECOND) {
    const batch = messages.slice(index, index + RESEND_EMAILS_PER_SECOND);
    const batchResults = await Promise.allSettled(
      batch.map((message) => getResendClient().emails.send(message)),
    );
    results.push(...batchResults);

    if (index + RESEND_EMAILS_PER_SECOND < messages.length) {
      await sleep(EMAIL_BATCH_DELAY_MS);
    }
  }

  return results;
}

function isDeliverableEmail(email) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    && !cleanEmail.includes("@local.atas-ieee");
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

  const label = SOCIEDADE_LABELS[chapter] || chapter;
  if (!chapter || label === chapter || label.startsWith(`${chapter} - `)) {
    return label;
  }

  return `${chapter} - ${label}`;
}

function emailShell({ children, eyebrow, preview, title }) {
  const logoUrl = `${SYSTEM_BASE_URL}/ramo-ieee-ufjf.png`;

  return `
    <div style="margin:0; padding:0; background:#f3f7fb;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; background:#f3f7fb;">
        <tr>
          <td align="center" style="padding:32px 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; border-collapse:collapse; overflow:hidden; border:1px solid #d7e5f0; border-radius:18px; background:#ffffff;">
              <tr>
                <td style="padding:22px 28px; background:#00629B; color:#ffffff;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="width:54px; vertical-align:middle;">
                        <img src="${logoUrl}" width="44" height="44" alt="IEEE UFJF" style="display:block; width:44px; height:44px; object-fit:contain; border:0;">
                      </td>
                      <td style="vertical-align:middle; padding-left:10px;">
                        <div style="font-family:Arial,sans-serif; font-size:16px; font-weight:800; line-height:1.15; color:#ffffff;">Universidade Federal de Juiz de Fora</div>
                        <div style="font-family:Arial,sans-serif; font-size:14px; font-weight:700; line-height:1.2; color:#ffffff;">IEEE Student Branch</div>
                      </td>
                      <td style="width:1px; padding:0 16px;">
                        <div style="width:1px; height:40px; background:rgba(255,255,255,.72);"></div>
                      </td>
                      <td style="vertical-align:middle; white-space:nowrap;">
                        <div style="font-family:Arial,sans-serif; font-size:17px; font-weight:800; line-height:1.2; color:#ffffff;">Sistema Interno</div>
                      </td>
                    </tr>
                  </table>
                  <div style="margin-top:22px; font-family:Arial,sans-serif; font-size:12px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; opacity:.88;">${escapeHtml(eyebrow)}</div>
                  <h1 style="margin:8px 0 0; font-family:Arial,sans-serif; font-size:24px; line-height:1.2; color:#ffffff;">${escapeHtml(title)}</h1>
                  ${preview ?`<p style="margin:8px 0 0; font-family:Arial,sans-serif; font-size:14px; line-height:1.5; color:#e8f3fb;">${escapeHtml(preview)}</p>` : ""}
                </td>
              </tr>
              <tr>
                <td style="padding:26px 28px; font-family:Arial,sans-serif; color:#17233c; line-height:1.5;">
                  ${children}
                </td>
              </tr>
              <tr>
                <td style="padding:16px 28px; background:#f8fbfd; border-top:1px solid #d7e5f0; font-family:Arial,sans-serif; color:#607089; font-size:12px;">
                  Sistema Interno IEEE UFJF
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function detailTable(rows) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; margin:0 0 18px;">
      ${rows.map(([label, value]) => `
        <tr>
          <td style="width:170px; padding:10px 0; border-bottom:1px solid #e6eef5; color:#42526a; font-family:Arial,sans-serif; font-size:13px; font-weight:700;">${escapeHtml(label)}</td>
          <td style="padding:10px 0; border-bottom:1px solid #e6eef5; color:#17233c; font-family:Arial,sans-serif; font-size:14px;">${escapeHtml(value)}</td>
        </tr>
      `).join("")}
    </table>
  `;
}

function actionButton({ href, label }) {
  return `
    <p style="margin:24px 0 0;">
      <a href="${escapeHtml(href)}" style="display:inline-block; padding:12px 18px; border-radius:10px; background:#00629B; color:#ffffff; font-family:Arial,sans-serif; font-size:14px; font-weight:700; text-decoration:none;">
        ${escapeHtml(label)}
      </a>
    </p>
  `;
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
      recipients.set(email, { email, name: user.name || email });
    }
  });

  contacts.forEach((contact) => {
    const chapters = Array.isArray(contact.chapters) ?contact.chapters : [];
    if (chapter !== GLOBAL_CHAPTER && !chapters.includes(chapter)) {
      return;
    }

    const email = String(contact.email || "").trim().toLowerCase();
    if (isDeliverableEmail(email)) {
      recipients.set(email, { email, name: contact.name || email });
    }
  });

  return [...recipients.values()];
}

async function assignedTaskRecipient(task) {
  if (!task.assignedToId) {
    return null;
  }

  const user = await getPrisma().user.findUnique({
    select: {
      email: true,
      memberContact: {
        select: {
          email: true,
          name: true,
        },
      },
      name: true,
    },
    where: { id: task.assignedToId },
  });

  if (!user) {
    return null;
  }

  const email = isDeliverableEmail(user.email)
    ?user.email
    : user.memberContact?.email;

  if (!isDeliverableEmail(email)) {
    return null;
  }

  return {
    email: String(email).trim().toLowerCase(),
    name: user.memberContact?.name || user.name || email,
  };
}

async function listTaskNotificationRecipients(task) {
  const assignedRecipient = await assignedTaskRecipient(task);
  if (assignedRecipient) {
    return [assignedRecipient];
  }

  if (task.assignedToId) {
    return [];
  }

  return listChapterNotificationRecipients(task.chapter);
}

function taskAssigneeName(task) {
  return task.assignedTo?.name || "Sem responsável definido";
}

function taskGreeting(recipient, task) {
  return `Prezado ${recipient?.name || "membro"}, informamos que uma nova tarefa foi criada no(a) ${chapterLabel(task.chapter)}.`;
}

function taskEmailHtml({ creator, recipient, task }) {
  const description = task.description || "Sem descrição.";
  const rows = [
    ["Título", task.title],
    ["Capítulo", chapterLabel(task.chapter)],
    ["Prazo", formatDateTime(task.dueDate)],
    ["Responsável", taskAssigneeName(task)],
    ["Criada por", creator?.name || "Sistema Interno IEEE UFJF"],
  ];

  return emailShell({
    eyebrow: "Tarefa",
    preview: "Uma nova tarefa foi cadastrada para o seu capítulo.",
    title: "Nova tarefa cadastrada",
    children: `
      <p style="margin:0 0 18px; font-family:Arial,sans-serif; font-size:15px; color:#17233c;">${escapeHtml(taskGreeting(recipient, task))}</p>
      ${detailTable(rows)}
      <div style="margin-top:18px;">
        <div style="color:#42526a; font-family:Arial,sans-serif; font-size:13px; font-weight:700; margin-bottom:6px;">Descrição</div>
        <div style="padding:14px 16px; border:1px solid #d7e5f0; border-radius:12px; background:#f8fbfd; color:#17233c; font-family:Arial,sans-serif; font-size:14px;">${escapeHtml(description)}</div>
      </div>
      ${actionButton({ href: `${SYSTEM_BASE_URL}/tarefas`, label: "Abrir tarefas" })}
    `,
  });
}

function taskEmailText({ creator, recipient, task }) {
  return [
    "Nova tarefa cadastrada no Sistema Interno IEEE UFJF.",
    "",
    taskGreeting(recipient, task),
    "",
    `Título: ${task.title}`,
    `Capítulo: ${chapterLabel(task.chapter)}`,
    `Prazo: ${formatDateTime(task.dueDate)}`,
    `Responsável: ${taskAssigneeName(task)}`,
    `Criada por: ${creator?.name || "Sistema Interno IEEE UFJF"}`,
    "",
    `Descrição: ${task.description || "Sem descrição."}`,
    "",
    `Acesse: ${SYSTEM_BASE_URL}/tarefas`,
  ].join("\n");
}

function welcomeEmailHtml({ initialPassword, user }) {
  return emailShell({
    eyebrow: "Acesso",
    preview: "Seu acesso ao Sistema Interno IEEE UFJF foi criado.",
    title: "Bem-vindo ao Sistema Interno",
    children: `
      <p style="margin:0 0 18px; font-family:Arial,sans-serif; font-size:15px;">Olá, ${escapeHtml(user.name)}. Seu acesso ao sistema interno foi criado.</p>
      ${detailTable([
        ["Usuário", user.username],
        ["Senha inicial", initialPassword],
      ])}
      <p style="margin:16px 0 0; color:#42526a; font-family:Arial,sans-serif; font-size:14px;">Por segurança, troque sua senha no primeiro acesso clicando no seu nome no canto superior do sistema.</p>
      ${actionButton({ href: `${SYSTEM_BASE_URL}/login`, label: "Acessar o sistema" })}
    `,
  });
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
    `Acesse: ${SYSTEM_BASE_URL}/login`,
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
  const recurrence = recurrenceLabel(event);
  const rows = [
    ["Evento", event.title],
    ["Capítulo", chapterLabel(event.chapter)],
    ["Início", formatDateTime(event.startTime)],
    ["Fim", formatDateTime(event.endTime)],
    ["Local", event.location || "Local não informado"],
    ["Criado por", creator?.name || "Sistema Interno IEEE UFJF"],
  ];

  return emailShell({
    eyebrow: "Calendário",
    preview: "Um novo evento foi agendado no calendário interno.",
    title: "Novo evento no calendário",
    children: `
      ${detailTable(rows)}
      ${recurrence ?`<p style="margin:16px 0; color:#00629B; font-family:Arial,sans-serif; font-size:14px; font-weight:700;">${escapeHtml(recurrence)}</p>` : ""}
      <div style="margin-top:18px;">
        <div style="color:#42526a; font-family:Arial,sans-serif; font-size:13px; font-weight:700; margin-bottom:6px;">Descrição</div>
        <div style="padding:14px 16px; border:1px solid #d7e5f0; border-radius:12px; background:#f8fbfd; color:#17233c; font-family:Arial,sans-serif; font-size:14px;">${escapeHtml(event.description || "Sem descrição.")}</div>
      </div>
      ${actionButton({ href: `${SYSTEM_BASE_URL}/calendario`, label: "Abrir calendário" })}
    `,
  });
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
    `Acesse: ${SYSTEM_BASE_URL}/calendario`,
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

function sentStats(results) {
  return {
    enabled: true,
    failed: results.filter((result) => result.status === "rejected").length,
    sent: results.filter((result) => result.status === "fulfilled").length,
  };
}

export async function notifyMembersAboutCreatedTask({ creator, task }) {
  if (!emailNotificationsEnabled()) {
    return { enabled: false, sent: 0 };
  }

  const recipients = await listTaskNotificationRecipients(task);
  if (!recipients.length) {
    return { enabled: true, sent: 0 };
  }

  const subject = `[IEEE UFJF] Nova tarefa: ${task.title}`;
  const messages = recipients.map((recipient) => ({
    from: process.env.EMAIL_FROM,
    html: taskEmailHtml({ creator, recipient, task }),
    subject,
    text: taskEmailText({ creator, recipient, task }),
    to: `${recipient.name} <${recipient.email}>`,
  }));

  return sentStats(await sendEmailBatches(messages));
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
  const messages = recipients.map((recipient) => ({
    from: process.env.EMAIL_FROM,
    html,
    subject,
    text,
    to: `${recipient.name} <${recipient.email}>`,
  }));

  return sentStats(await sendEmailBatches(messages));
}
