import { getManageableChapterKeys, isChapterMember, isRamoBoardMember } from "./auth";
import { expandirSociedadesParaBusca, normalizarSociedadeChave, SOCIEDADE_LABELS } from "./ata";
import { getPrisma } from "./db";
import {
  deleteEventFromFirebase,
  deleteTaskFromFirebase,
  syncEventsToFirebase,
  syncEventToFirebase,
  syncTaskToFirebase,
} from "./firebase-sync";

export const GLOBAL_CHAPTER = "Todos";

const TASK_STATUSES = new Set(["pending", "doing", "done"]);
const TASK_PRIORITIES = new Set(["low", "normal", "high"]);
const EVENT_RECURRENCE_FREQUENCIES = new Set(["daily", "weekly", "biweekly", "monthly"]);
const MAX_EVENT_RECURRENCE_COUNT = 52;

export class InternalAccessError extends Error {
  constructor(message = "Você não tem acesso a este item interno.") {
    super(message);
    this.name = "InternalAccessError";
  }
}

function trimText(value, maxLength, fallback = "") {
  const cleanValue = String(value || "").trim();
  return (cleanValue || fallback).slice(0, maxLength);
}

function parseDate(value, fieldName, { required = true } = {}) {
  if (!value) {
    if (required) {
      throw new Error(`Informe ${fieldName}.`);
    }
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} inválido.`);
  }

  return date;
}

function normalizeRecurrenceCount(value) {
  const count = Number.parseInt(String(value || "1"), 10);
  if (!Number.isSafeInteger(count) || count < 1) {
    return 1;
  }

  return Math.min(count, MAX_EVENT_RECURRENCE_COUNT);
}

function addRecurrenceStep(date, frequency, occurrenceIndex) {
  const nextDate = new Date(date);

  if (frequency === "daily") {
    nextDate.setDate(nextDate.getDate() + occurrenceIndex);
    return nextDate;
  }

  if (frequency === "biweekly") {
    nextDate.setDate(nextDate.getDate() + occurrenceIndex * 14);
    return nextDate;
  }

  if (frequency === "monthly") {
    nextDate.setMonth(nextDate.getMonth() + occurrenceIndex);
    return nextDate;
  }

  nextDate.setDate(nextDate.getDate() + occurrenceIndex * 7);
  return nextDate;
}

function buildEventOccurrences({ endTime, payload, startTime }) {
  if (!payload.recurrenceEnabled) {
    return [{ endTime, startTime }];
  }

  const frequency = EVENT_RECURRENCE_FREQUENCIES.has(payload.recurrenceFrequency)
    ?payload.recurrenceFrequency
    : "weekly";
  const count = normalizeRecurrenceCount(payload.recurrenceCount);

  return Array.from({ length: count }, (_, index) => ({
    endTime: addRecurrenceStep(endTime, frequency, index),
    startTime: addRecurrenceStep(startTime, frequency, index),
  }));
}

export function visibleInternalChapters(user) {
  if (!user) {
    return [];
  }

  const chapters = user.isAdmin
    ?Object.keys(SOCIEDADE_LABELS)
    : Array.isArray(user.chapters)
      ?user.chapters
      : [];

  return [GLOBAL_CHAPTER, ...new Set(chapters.map((chapter) => normalizarSociedadeChave(chapter, "")).filter(Boolean))];
}

export function internalChapterOptions(user) {
  return visibleInternalChapters(user).map((key) => ({
    key,
    label: key === GLOBAL_CHAPTER ?"Todos os capítulos" : SOCIEDADE_LABELS[key] || key,
  }));
}

function metricChapterKeysForUser(user) {
  if (isRamoBoardMember(user)) {
    return Object.keys(SOCIEDADE_LABELS);
  }

  return getManageableChapterKeys(user).filter((chapterKey) => chapterKey !== "Ramo");
}

function normalizeInternalChapter(value) {
  const cleanValue = trimText(value, 40);
  if (cleanValue === GLOBAL_CHAPTER) {
    return GLOBAL_CHAPTER;
  }

  return normalizarSociedadeChave(cleanValue, "");
}

function ensureCanViewChapter(user, chapter) {
  if (chapter === GLOBAL_CHAPTER || user?.isAdmin || isChapterMember(user, chapter)) {
    return;
  }

  throw new InternalAccessError();
}

function ensureCanWriteChapter(user, chapter) {
  if (!user) {
    throw new InternalAccessError();
  }

  if (chapter === GLOBAL_CHAPTER) {
    if (isRamoBoardMember(user)) {
      return;
    }

    throw new InternalAccessError("Apenas a diretoria do Ramo pode criar itens para todos os capítulos.");
  }

  if (user.isAdmin || isChapterMember(user, chapter)) {
    return;
  }

  throw new InternalAccessError("Você só pode criar itens para seus capítulos.");
}

function canManageItem(user, item) {
  if (!user || !item) {
    return false;
  }

  if (user.isAdmin || item.createdById === user.id) {
    return true;
  }

  return getManageableChapterKeys(user).includes(item.chapter);
}

function publicTask(row) {
  if (!row) {
    return null;
  }

  return {
    assignedTo: row.assignedTo ?{ id: row.assignedTo.id, name: row.assignedTo.name } : null,
    assignedToId: row.assignedToId,
    chapter: row.chapter,
    createdAt: row.createdAt?.toISOString(),
    createdBy: row.createdBy ?{ id: row.createdBy.id, name: row.createdBy.name } : null,
    description: row.description,
    dueDate: row.dueDate?.toISOString() || "",
    id: row.id,
    priority: row.priority,
    status: row.status,
    title: row.title,
    updatedAt: row.updatedAt?.toISOString(),
  };
}

function publicEvent(row) {
  if (!row) {
    return null;
  }

  return {
    chapter: row.chapter,
    createdAt: row.createdAt?.toISOString(),
    createdBy: row.createdBy ?{ id: row.createdBy.id, name: row.createdBy.name } : null,
    description: row.description,
    endTime: row.endTime?.toISOString(),
    id: row.id,
    location: row.location,
    startTime: row.startTime?.toISOString(),
    title: row.title,
    updatedAt: row.updatedAt?.toISOString(),
  };
}

export async function listInternalTasks(user, chapter = "") {
  const visibleChapters = visibleInternalChapters(user);
  const requestedChapter = normalizeInternalChapter(chapter);
  const chapters = requestedChapter ?[requestedChapter] : visibleChapters;

  chapters.forEach((item) => ensureCanViewChapter(user, item));

  const tasks = await getPrisma().internalTask.findMany({
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { title: "asc" }],
    where: { chapter: { in: chapters } },
  });

  return tasks.map(publicTask);
}

export async function listTaskMetricsByChapter(user) {
  const chapterKeys = metricChapterKeysForUser(user);
  if (!chapterKeys.length) {
    throw new InternalAccessError("Apenas diretoria do Ramo ou de capítulos pode acessar métricas.");
  }

  const [tasks, users] = await Promise.all([
    getPrisma().internalTask.findMany({
      select: {
        assignedToId: true,
        chapter: true,
        status: true,
      },
      where: {
        chapter: { in: chapterKeys },
      },
    }),
    getPrisma().user.findMany({
      include: { chapters: true },
      orderBy: { name: "asc" },
      where: {
        chapters: {
          some: {
            chapterKey: { in: expandirSociedadesParaBusca(chapterKeys) },
          },
        },
      },
    }),
  ]);

  return chapterKeys.map((chapterKey) => {
    const chapterTasks = tasks.filter((task) => task.chapter === chapterKey);
    const chapterUsers = users.filter((userRow) =>
      userRow.chapters.some((chapter) => normalizarSociedadeChave(chapter.chapterKey, "") === chapterKey),
    );

    const members = chapterUsers.map((member) => {
      const memberTasks = chapterTasks.filter((task) => Number(task.assignedToId) === Number(member.id));
      const completed = memberTasks.filter((task) => task.status === "done").length;

      return {
        completed,
        id: member.id,
        name: member.name,
        open: memberTasks.length - completed,
        registered: memberTasks.length,
      };
    });

    return {
      chapter: chapterKey,
      label: SOCIEDADE_LABELS[chapterKey] || chapterKey,
      members,
      totals: {
        completed: chapterTasks.filter((task) => task.status === "done").length,
        open: chapterTasks.filter((task) => task.status !== "done").length,
        registered: chapterTasks.length,
      },
    };
  });
}

export async function createInternalTask(user, payload = {}) {
  const title = trimText(payload.title, 160);
  const chapter = normalizeInternalChapter(payload.chapter);
  const status = TASK_STATUSES.has(payload.status) ?payload.status : "pending";
  const priority = TASK_PRIORITIES.has(payload.priority) ?payload.priority : "normal";
  const assignedToId = Number.isSafeInteger(Number(payload.assignedToId))
    ?Number(payload.assignedToId)
    : null;

  if (!title) {
    throw new Error("Informe o título da tarefa.");
  }

  if (!chapter) {
    throw new Error("Informe um capítulo válido.");
  }

  ensureCanWriteChapter(user, chapter);

  const task = await getPrisma().internalTask.create({
    data: {
      assignedToId,
      chapter,
      createdById: user.id,
      description: trimText(payload.description, 1200),
      dueDate: parseDate(payload.dueDate, "a data limite", { required: false }),
      priority,
      status,
      title,
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  await syncTaskToFirebase(task);
  return publicTask(task);
}

export async function updateInternalTask(user, taskId, payload = {}) {
  const currentTask = await getPrisma().internalTask.findUnique({ where: { id: taskId } });
  if (!currentTask) {
    return null;
  }

  ensureCanViewChapter(user, currentTask.chapter);
  if (!canManageItem(user, currentTask) && Object.keys(payload).some((key) => key !== "status")) {
    throw new InternalAccessError("Somente criador, admin ou gestor do capítulo pode editar esta tarefa.");
  }

  const nextChapter = Object.prototype.hasOwnProperty.call(payload, "chapter")
    ?normalizeInternalChapter(payload.chapter)
    : currentTask.chapter;
  ensureCanWriteChapter(user, nextChapter);

  const task = await getPrisma().internalTask.update({
    data: {
      assignedToId: Object.prototype.hasOwnProperty.call(payload, "assignedToId")
        ?Number.isSafeInteger(Number(payload.assignedToId))
          ?Number(payload.assignedToId)
          : null
        : undefined,
      chapter: nextChapter,
      description: Object.prototype.hasOwnProperty.call(payload, "description")
        ?trimText(payload.description, 1200)
        : undefined,
      dueDate: Object.prototype.hasOwnProperty.call(payload, "dueDate")
        ?parseDate(payload.dueDate, "a data limite", { required: false })
        : undefined,
      priority: TASK_PRIORITIES.has(payload.priority) ?payload.priority : undefined,
      status: TASK_STATUSES.has(payload.status) ?payload.status : undefined,
      title: Object.prototype.hasOwnProperty.call(payload, "title")
        ?trimText(payload.title, 160)
        : undefined,
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    where: { id: taskId },
  });

  await syncTaskToFirebase(task);
  return publicTask(task);
}

export async function deleteInternalTask(user, taskId) {
  const task = await getPrisma().internalTask.findUnique({ where: { id: taskId } });
  if (!task) {
    return false;
  }

  ensureCanViewChapter(user, task.chapter);
  if (!canManageItem(user, task)) {
    throw new InternalAccessError("Somente criador, admin ou gestor do capítulo pode excluir esta tarefa.");
  }

  await getPrisma().internalTask.delete({ where: { id: taskId } });
  await deleteTaskFromFirebase(task);
  return true;
}

export async function listInternalEvents(user, chapter = "") {
  const visibleChapters = visibleInternalChapters(user);
  const requestedChapter = normalizeInternalChapter(chapter);
  const chapters = requestedChapter ?[requestedChapter] : visibleChapters;

  chapters.forEach((item) => ensureCanViewChapter(user, item));

  const events = await getPrisma().internalEvent.findMany({
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { startTime: "asc" },
    where: { chapter: { in: chapters } },
  });

  return events.map(publicEvent);
}

export async function createInternalEvent(user, payload = {}) {
  const title = trimText(payload.title, 160);
  const chapter = normalizeInternalChapter(payload.chapter);
  const startTime = parseDate(payload.startTime, "o início do evento");
  const endTime = parseDate(payload.endTime, "o fim do evento");

  if (!title) {
    throw new Error("Informe o título do evento.");
  }

  if (!chapter) {
    throw new Error("Informe um capítulo válido.");
  }

  if (endTime <= startTime) {
    throw new Error("O fim do evento precisa ser depois do início.");
  }

  ensureCanWriteChapter(user, chapter);

  const baseData = {
    chapter,
    createdById: user.id,
    description: trimText(payload.description, 1200),
    location: trimText(payload.location, 240),
    title,
  };
  const eventCreates = buildEventOccurrences({ endTime, payload, startTime }).map((occurrence) =>
    getPrisma().internalEvent.create({
      data: {
        ...baseData,
        endTime: occurrence.endTime,
        startTime: occurrence.startTime,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    }),
  );
  const events = await getPrisma().$transaction(eventCreates);

  await syncEventsToFirebase(events);
  return events.map(publicEvent);
}

export async function updateInternalEvent(user, eventId, payload = {}) {
  const currentEvent = await getPrisma().internalEvent.findUnique({ where: { id: eventId } });
  if (!currentEvent) {
    return null;
  }

  ensureCanViewChapter(user, currentEvent.chapter);
  if (!canManageItem(user, currentEvent)) {
    throw new InternalAccessError("Somente criador, admin ou gestor do capítulo pode editar este evento.");
  }

  const nextChapter = Object.prototype.hasOwnProperty.call(payload, "chapter")
    ?normalizeInternalChapter(payload.chapter)
    : currentEvent.chapter;
  const startTime = Object.prototype.hasOwnProperty.call(payload, "startTime")
    ?parseDate(payload.startTime, "o início do evento")
    : currentEvent.startTime;
  const endTime = Object.prototype.hasOwnProperty.call(payload, "endTime")
    ?parseDate(payload.endTime, "o fim do evento")
    : currentEvent.endTime;

  if (endTime <= startTime) {
    throw new Error("O fim do evento precisa ser depois do início.");
  }

  ensureCanWriteChapter(user, nextChapter);

  const event = await getPrisma().internalEvent.update({
    data: {
      chapter: nextChapter,
      description: Object.prototype.hasOwnProperty.call(payload, "description")
        ?trimText(payload.description, 1200)
        : undefined,
      endTime,
      location: Object.prototype.hasOwnProperty.call(payload, "location")
        ?trimText(payload.location, 240)
        : undefined,
      startTime,
      title: Object.prototype.hasOwnProperty.call(payload, "title")
        ?trimText(payload.title, 160)
        : undefined,
    },
    include: { createdBy: { select: { id: true, name: true } } },
    where: { id: eventId },
  });

  await syncEventToFirebase(event);
  return publicEvent(event);
}

export async function deleteInternalEvent(user, eventId) {
  const event = await getPrisma().internalEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    return false;
  }

  ensureCanViewChapter(user, event.chapter);
  if (!canManageItem(user, event)) {
    throw new InternalAccessError("Somente criador, admin ou gestor do capítulo pode excluir este evento.");
  }

  await getPrisma().internalEvent.delete({ where: { id: eventId } });
  await deleteEventFromFirebase(event);
  return true;
}
