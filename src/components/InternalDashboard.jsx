"use client";

import { useEffect, useMemo, useState } from "react";

import LoadingBall from "./LoadingBall";
import UserPasswordDialog from "./UserPasswordDialog";
import {
  DEMO_CHAPTERS,
  DEMO_MEMBERS,
  DEMO_USER,
  createDemoEvents,
  createDemoTasks,
} from "./demo-data";

const GLOBAL_CHAPTER = "Todos";

const TASK_STATUS_LABELS = {
  pending: "Pendente",
  doing: "Em andamento",
  done: "Concluída",
};

const TASK_PRIORITY_LABELS = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
};

const BRT_TIME_ZONE = "America/Sao_Paulo";

function tomorrowAt(hour) {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, 0, 0, 0);
  return toBrtDateTimeInput(date);
}

function getBrtDateParts(value) {
  const date = value instanceof Date ?value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: BRT_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function toBrtDateTimeInput(value) {
  const parts = getBrtDateParts(value);
  if (!parts) {
    return "";
  }

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function brtInputToIso(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) {
    return value || "";
  }

  const [, year, month, day, hour, minute] = match;
  return new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) + 3,
    Number(minute),
  )).toISOString();
}

function toDateInputValue(value) {
  const parts = getBrtDateParts(value);
  if (!parts) {
    return "";
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatDateTime(value) {
  if (!value) {
    return "Sem data";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Data inválida";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: BRT_TIME_ZONE,
    year: "numeric",
  }).format(date).replace(",", "");
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BRT_TIME_ZONE,
  }).format(date);
}

function formatDailyScheduleTitle(count) {
  if (count === 0) {
    return "Nenhum horário agendado";
  }

  if (count === 1) {
    return "1 horário agendado";
  }

  return `${count} horários agendados`;
}

function formatChapterOption(chapter) {
  const key = String(chapter?.key || "").trim();
  const label = String(chapter?.label || "").trim();

  if (!key) {
    return label;
  }

  if (key === GLOBAL_CHAPTER) {
    return label || key;
  }

  if (!label || label === key || label.startsWith(`${key} - `)) {
    return label || key;
  }

  return `${key} - ${label}`;
}

function createTaskForm(defaultChapter = GLOBAL_CHAPTER) {
  return {
    assignedToId: "",
    chapter: defaultChapter,
    description: "",
    dueDate: "",
    notifyMembers: false,
    priority: "normal",
    title: "",
  };
}

function createEventForm(defaultChapter = GLOBAL_CHAPTER) {
  return {
    chapter: defaultChapter,
    description: "",
    endTime: tomorrowAt(19),
    location: "Sala do Ramo",
    notifyMembers: false,
    recurrenceCount: 4,
    recurrenceEnabled: false,
    recurrenceFrequency: "weekly",
    startTime: tomorrowAt(18),
    title: "",
  };
}

async function readApiError(response, fallback) {
  try {
    const payload = await response.json();
    return payload.detail || fallback;
  } catch {
    return fallback;
  }
}

function createDemoChapterOptions() {
  return [{ key: GLOBAL_CHAPTER, label: "Todos os capítulos" }, ...DEMO_CHAPTERS];
}

function addRecurrence(date, frequency, index) {
  const nextDate = new Date(brtInputToIso(date));
  if (frequency === "daily") {
    nextDate.setDate(nextDate.getDate() + index);
  } else if (frequency === "biweekly") {
    nextDate.setDate(nextDate.getDate() + index * 14);
  } else if (frequency === "monthly") {
    nextDate.setMonth(nextDate.getMonth() + index);
  } else {
    nextDate.setDate(nextDate.getDate() + index * 7);
  }

  return nextDate.toISOString();
}

function eventSeriesKey(event) {
  if (event.recurrenceSeriesId) {
    return `series:${event.recurrenceSeriesId}`;
  }

  return [
    "legacy",
    event.chapter || "",
    event.title || "",
    event.description || "",
    event.location || "",
    formatTime(event.startTime),
    formatTime(event.endTime),
  ].join(":");
}

function isRecurringEvent(event) {
  return Boolean(event.recurrenceSeriesId || Number(event.recurrenceCount) > 1);
}

function getVisibleEventItems(events) {
  const now = Date.now();
  const grouped = new Map();

  events.forEach((event) => {
    const key = eventSeriesKey(event);
    const current = grouped.get(key) || [];
    current.push(event);
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .map((group) => {
      const sorted = [...group].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      const upcoming = sorted.find((event) => new Date(event.startTime).getTime() >= now);
      const event = upcoming || sorted[sorted.length - 1];
      return {
        ...event,
        isRecurring: group.length > 1 || isRecurringEvent(event),
        seriesEventIds: group.map((item) => item.id),
        seriesSize: Number(event.recurrenceCount) || group.length,
      };
    })
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
}

export default function InternalDashboard({ page = "tasks", demoMode = false }) {
  const [theme, setTheme] = useState("light");
  const [auth, setAuth] = useState({
    loading: !demoMode,
    setupRequired: false,
    user: demoMode ?DEMO_USER : null,
  });
  const [chapters, setChapters] = useState(demoMode ?createDemoChapterOptions : []);
  const [members, setMembers] = useState(demoMode ?DEMO_MEMBERS : []);
  const [tasks, setTasks] = useState(demoMode ?createDemoTasks : []);
  const [events, setEvents] = useState(demoMode ?createDemoEvents : []);
  const activeTab = page === "calendar" ?"calendar" : "tasks";
  const [selectedChapter, setSelectedChapter] = useState("");
  const [taskForm, setTaskForm] = useState(createTaskForm);
  const [eventForm, setEventForm] = useState(createEventForm);
  const [status, setStatus] = useState({
    tone: demoMode ?"success" : "idle",
    text: demoMode ?"Modo demo carregado com dados fictícios." : "Carregando sistema de atas.",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toDateInputValue(new Date()));

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("atas-ieee-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
      return;
    }

    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("atas-ieee-theme", theme);
  }, [theme]);

  useEffect(() => {
    let active = true;

    if (demoMode) {
      setAuth({ loading: false, setupRequired: false, user: DEMO_USER });
      setChapters(createDemoChapterOptions());
      setMembers(DEMO_MEMBERS);
      setTasks(createDemoTasks());
      setEvents(createDemoEvents());
      setTaskForm(createTaskForm(GLOBAL_CHAPTER));
      setEventForm(createEventForm(GLOBAL_CHAPTER));
      setStatus({ tone: "success", text: "Modo demo carregado com dados fictícios." });
      return () => {
        active = false;
      };
    }

    async function loadAuth() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(await readApiError(response, "Não foi possível verificar a autenticação."));
        }

        const payload = await response.json();
        if (!active) {
          return;
        }

        const user = payload.user || null;
        const allowedKeys = new Set(user?.isAdmin ?[] : user?.chapters || []);
        const visibleChapters = [
          { key: GLOBAL_CHAPTER, label: "Todos os capítulos" },
          ...(Array.isArray(payload.chapters) ?payload.chapters : []).filter((chapter) =>
            user?.isAdmin || allowedKeys.has(chapter.key),
          ),
        ];

        setAuth({
          loading: false,
          setupRequired: Boolean(payload.setupRequired),
          user,
        });
        setChapters(visibleChapters);
        setTaskForm(createTaskForm(visibleChapters[0]?.key || GLOBAL_CHAPTER));
        setEventForm(createEventForm(visibleChapters[0]?.key || GLOBAL_CHAPTER));
      } catch (error) {
        if (active) {
          setAuth({ loading: false, setupRequired: false, user: null });
          setStatus({
            tone: "error",
            text: error.message || "Não foi possível verificar a autenticação.",
          });
        }
      }
    }

    loadAuth();
    return () => {
      active = false;
    };
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) {
      return;
    }

    if (!auth.user) {
      return;
    }

    loadInternalData();
    loadMembers();
  }, [auth.user, selectedChapter, demoMode]);

  useEffect(() => {
    if (!demoMode && !auth.loading && !auth.user) {
      const nextPath = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    }
  }, [auth.loading, auth.user, demoMode]);

  const nextTheme = theme === "dark" ?"light" : "dark";
  const chapterMatchesFilter = (item) =>
    !selectedChapter || selectedChapter === GLOBAL_CHAPTER || item.chapter === selectedChapter;
  const displayedTasks = tasks.filter(chapterMatchesFilter);
  const displayedEvents = events.filter(chapterMatchesFilter);
  const visibleCalendarEvents = useMemo(() => getVisibleEventItems(displayedEvents), [displayedEvents]);
  const openTasks = displayedTasks.filter((task) => task.status !== "done");
  const doneTasks = displayedTasks.filter((task) => task.status === "done");
  const dailyEvents = useMemo(
    () =>
      displayedEvents
        .filter((event) => toDateInputValue(event.startTime) === selectedCalendarDate)
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime)),
    [displayedEvents, selectedCalendarDate],
  );
  const pageCopy = activeTab === "calendar"
    ?{
        aria: "Ir para o calendário",
        eyebrow: "Calendário",
        heading: "Calendário do Ramo",
        loading: "Verificando sua sessão antes de abrir o calendário.",
        statusLoading: "Atualizando calendário.",
        statusSuccess: "Calendário atualizado.",
        unavailable: "Não foi possível carregar o calendário.",
        description:
          "Acompanhe reuniões, eventos e compromissos do Ramo e dos capítulos no sistema de atas.",
      }
    : {
        aria: "Ir para tarefas",
        eyebrow: "Tarefas",
        heading: "Tarefas do Ramo",
        loading: "Verificando sua sessão antes de abrir tarefas.",
        statusLoading: "Atualizando tarefas.",
        statusSuccess: "Tarefas atualizadas.",
        unavailable: "Não foi possível carregar as tarefas.",
        description:
          "Organize demandas, responsáveis e prazos do Ramo e dos capítulos no sistema de atas.",
      };

  function toggleTheme() {
    setTheme((current) => (current === "dark" ?"light" : "dark"));
  }

  async function loadInternalData() {
    if (demoMode) {
      setTasks(createDemoTasks());
      setEvents(createDemoEvents());
      setMembers(DEMO_MEMBERS);
      setStatus({ tone: "success", text: "Dados demo restaurados." });
      return;
    }

    setIsLoading(true);
    setStatus({ tone: "loading", text: pageCopy.statusLoading });

    try {
      const query = selectedChapter ?`?chapter=${encodeURIComponent(selectedChapter)}` : "";
      const [tasksResponse, eventsResponse] = await Promise.all([
        fetch(`/api/internal/tasks${query}`, { cache: "no-store" }),
        fetch(`/api/internal/events${query}`, { cache: "no-store" }),
      ]);

      if (!tasksResponse.ok) {
        throw new Error(await readApiError(tasksResponse, "Não foi possível carregar tarefas."));
      }

      if (!eventsResponse.ok) {
        throw new Error(await readApiError(eventsResponse, "Não foi possível carregar eventos."));
      }

      const [tasksPayload, eventsPayload] = await Promise.all([
        tasksResponse.json(),
        eventsResponse.json(),
      ]);

      setTasks(Array.isArray(tasksPayload.tasks) ?tasksPayload.tasks : []);
      setEvents(Array.isArray(eventsPayload.events) ?eventsPayload.events : []);
      setStatus({ tone: "success", text: pageCopy.statusSuccess });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || pageCopy.unavailable,
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMembers() {
    if (demoMode) {
      setMembers(DEMO_MEMBERS);
      return;
    }

    try {
      const response = await fetch("/api/users?scope=accessible", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      setMembers(Array.isArray(payload.users) ?payload.users : []);
    } catch {
      setMembers([]);
    }
  }

  async function handleLogout() {
    if (demoMode) {
      window.location.href = "/demo";
      return;
    }

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  }

  async function handleCreateTask(event) {
    event.preventDefault();
    setIsSavingTask(true);
    setStatus({ tone: "loading", text: "Salvando tarefa." });

    try {
      if (demoMode) {
        const assignedTo = members.find((member) => member.id === taskForm.assignedToId);
        const task = {
          ...taskForm,
          assignedTo: assignedTo ?{ id: assignedTo.id, name: assignedTo.name } : null,
          assignedToId: taskForm.assignedToId || null,
          chapter: taskForm.chapter || GLOBAL_CHAPTER,
          id: crypto.randomUUID(),
          status: "pending",
        };
        setTasks((current) => [...current, task]);
        setTaskForm(createTaskForm(taskForm.chapter));
        setIsTaskDialogOpen(false);
        setStatus({ tone: "success", text: "Tarefa demo criada localmente." });
        return;
      }

      const response = await fetch("/api/internal/tasks", {
        body: JSON.stringify({
          ...taskForm,
          assignedToId: taskForm.assignedToId || null,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Não foi possível salvar a tarefa."));
      }

      const payload = await response.json();
      setTasks((current) => [...current, payload.task].filter(Boolean));
      setTaskForm(createTaskForm(taskForm.chapter));
      setIsTaskDialogOpen(false);
      setStatus({ tone: "success", text: "Tarefa criada." });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Não foi possível salvar a tarefa.",
      });
    } finally {
      setIsSavingTask(false);
    }
  }

  async function updateTaskStatus(task, statusValue) {
    setStatus({ tone: "loading", text: "Atualizando tarefa." });

    try {
      if (demoMode) {
        setTasks((current) =>
          current.map((item) => (item.id === task.id ?{ ...item, status: statusValue } : item)),
        );
        setStatus({ tone: "success", text: "Tarefa demo atualizada localmente." });
        return;
      }

      const response = await fetch(`/api/internal/tasks/${task.id}`, {
        body: JSON.stringify({ status: statusValue }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Não foi possível atualizar a tarefa."));
      }

      const payload = await response.json();
      setTasks((current) =>
        current.map((item) => (item.id === task.id ?payload.task || item : item)),
      );
      setStatus({ tone: "success", text: "Tarefa atualizada." });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Não foi possível atualizar a tarefa.",
      });
    }
  }

  async function deleteTask(task) {
    if (!window.confirm("Excluir esta tarefa?")) {
      return;
    }

    setStatus({ tone: "loading", text: "Excluindo tarefa." });

    try {
      if (demoMode) {
        setTasks((current) => current.filter((item) => item.id !== task.id));
        setStatus({ tone: "success", text: "Tarefa demo excluída localmente." });
        return;
      }

      const response = await fetch(`/api/internal/tasks/${task.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Não foi possível excluir a tarefa."));
      }

      setTasks((current) => current.filter((item) => item.id !== task.id));
      setStatus({ tone: "success", text: "Tarefa excluída." });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Não foi possível excluir a tarefa.",
      });
    }
  }

  function openCreateEventDialog() {
    setEditingEvent(null);
    setEventForm(createEventForm(eventForm.chapter || selectedChapter || GLOBAL_CHAPTER));
    setIsEventDialogOpen(true);
  }

  function openEditEventDialog(event) {
    setEditingEvent(event);
    setEventForm({
      chapter: event.chapter || GLOBAL_CHAPTER,
      description: event.description || "",
      endTime: toBrtDateTimeInput(event.endTime),
      location: event.location || "",
      notifyMembers: false,
      recurrenceCount: event.recurrenceCount || 1,
      recurrenceEnabled: false,
      recurrenceFrequency: event.recurrenceFrequency || "weekly",
      startTime: toBrtDateTimeInput(event.startTime),
      title: event.title || "",
    });
    setIsEventDialogOpen(true);
  }

  function closeEventDialog() {
    setIsEventDialogOpen(false);
    setEditingEvent(null);
  }

  async function handleCreateEvent(event) {
    event.preventDefault();
    setIsSavingEvent(true);
    setStatus({ tone: "loading", text: editingEvent ?"Atualizando evento." : "Salvando evento." });

    const eventPayload = {
      ...eventForm,
      chapter: eventForm.chapter || GLOBAL_CHAPTER,
      endTime: brtInputToIso(eventForm.endTime),
      startTime: brtInputToIso(eventForm.startTime),
    };

    try {
      if (demoMode) {
        if (editingEvent) {
          const updatedEvent = {
            ...editingEvent,
            ...eventPayload,
            recurrenceCount: editingEvent.recurrenceCount || null,
            recurrenceFrequency: editingEvent.recurrenceFrequency || null,
            recurrenceSeriesId: editingEvent.recurrenceSeriesId || null,
          };
          setEvents((current) =>
            current.map((item) => (item.id === editingEvent.id ?updatedEvent : item)),
          );
          setEventForm(createEventForm(eventForm.chapter));
          closeEventDialog();
          setStatus({ tone: "success", text: "Evento demo atualizado localmente." });
          return;
        }

        const recurrenceCount = eventForm.recurrenceEnabled
          ?Math.max(1, Math.min(52, Number(eventForm.recurrenceCount) || 1))
          : 1;
        const recurrenceSeriesId = recurrenceCount > 1 ?crypto.randomUUID() : null;
        const createdEvents = Array.from({ length: recurrenceCount }, (_, index) => ({
          ...eventPayload,
          endTime: addRecurrence(eventForm.endTime, eventForm.recurrenceFrequency, index),
          id: crypto.randomUUID(),
          recurrenceCount: recurrenceSeriesId ?recurrenceCount : null,
          recurrenceFrequency: recurrenceSeriesId ?eventForm.recurrenceFrequency : null,
          recurrenceIndex: recurrenceSeriesId ?index : null,
          recurrenceSeriesId,
          startTime: addRecurrence(eventForm.startTime, eventForm.recurrenceFrequency, index),
        }));
        setEvents((current) =>
          [...current, ...createdEvents].sort((a, b) => new Date(a.startTime) - new Date(b.startTime)),
        );
        setEventForm(createEventForm(eventForm.chapter));
        closeEventDialog();
        setStatus({
          tone: "success",
          text: createdEvents.length > 1
            ?`${createdEvents.length} eventos demo criados localmente.`
            : "Evento demo criado localmente.",
        });
        return;
      }

      const response = await fetch(editingEvent ?`/api/internal/events/${editingEvent.id}` : "/api/internal/events", {
        body: JSON.stringify(eventPayload),
        headers: { "Content-Type": "application/json" },
        method: editingEvent ?"PATCH" : "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Não foi possível salvar o evento."));
      }

      const payload = await response.json();
      if (editingEvent) {
        setEvents((current) =>
          current.map((item) => (item.id === editingEvent.id ?payload.event || item : item)),
        );
        setStatus({ tone: "success", text: "Evento atualizado." });
      } else {
        const createdEvents = Array.isArray(payload.events)
          ?payload.events
          : [payload.event].filter(Boolean);
        setEvents((current) =>
          [...current, ...createdEvents].filter(Boolean).sort((a, b) =>
            new Date(a.startTime) - new Date(b.startTime),
          ),
        );
        setStatus({
          tone: "success",
          text: createdEvents.length > 1
            ?`${createdEvents.length} eventos criados.`
            : "Evento criado.",
        });
      }
      setEventForm(createEventForm(eventForm.chapter));
      closeEventDialog();
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Não foi possível salvar o evento.",
      });
    } finally {
      setIsSavingEvent(false);
    }
  }

  async function deleteEvent(item, { series = false } = {}) {
    const message = series
      ?"Excluir todos os eventos desta série?"
      : "Excluir este evento?";
    if (!window.confirm(message)) {
      return;
    }

    setStatus({ tone: "loading", text: series ?"Excluindo série." : "Excluindo evento." });

    try {
      if (demoMode) {
        setEvents((current) => current.filter((event) =>
          series && item.recurrenceSeriesId
            ?event.recurrenceSeriesId !== item.recurrenceSeriesId
            : series && item.seriesEventIds?.length
              ?!item.seriesEventIds.includes(event.id)
            : event.id !== item.id,
        ));
        setStatus({
          tone: "success",
          text: series ?"Série demo excluída localmente." : "Evento demo excluído localmente.",
        });
        return;
      }

      if (series && !item.recurrenceSeriesId && item.seriesEventIds?.length) {
        const responses = await Promise.all(item.seriesEventIds.map((eventId) =>
          fetch(`/api/internal/events/${eventId}`, { method: "DELETE" }),
        ));
        const failedResponse = responses.find((response) => !response.ok);
        if (failedResponse) {
          throw new Error(await readApiError(failedResponse, "Não foi possível excluir a série."));
        }
      } else {
        const suffix = series ?"?series=1" : "";
        const response = await fetch(`/api/internal/events/${item.id}${suffix}`, { method: "DELETE" });
        if (!response.ok) {
          throw new Error(await readApiError(response, "Não foi possível excluir o evento."));
        }
      }

      setEvents((current) => current.filter((event) =>
        series && item.recurrenceSeriesId
          ?event.recurrenceSeriesId !== item.recurrenceSeriesId
          : series && item.seriesEventIds?.length
            ?!item.seriesEventIds.includes(event.id)
          : event.id !== item.id,
      ));
      setStatus({ tone: "success", text: series ?"Série excluída." : "Evento excluído." });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Não foi possível excluir o evento.",
      });
    }
  }
  const themeToggleButton = (
    <button
      type="button"
      className="theme-toggle"
      data-theme-current={theme}
      onClick={toggleTheme}
      aria-pressed={theme === "dark"}
      aria-label={`Alternar para tema ${nextTheme === "dark" ?"escuro" : "claro"}`}
      title={`Trocar para tema ${nextTheme === "dark" ?"escuro" : "claro"}`}
    >
      <span className="theme-toggle__icon" aria-hidden="true" />
      <span className="theme-toggle__label">
        {theme === "dark" ?"Tema escuro" : "Tema claro"}
      </span>
    </button>
  );

  if (auth.loading) {
    return <LoadingBall />;
  }

  if (!auth.user) {
    return <LoadingBall />;
  }

  return (
    <div className="app-shell">
      <header className="site-nav">
        <a
          href={demoMode ?(activeTab === "calendar" ?"/demo/calendario" : "/demo/tarefas") : (activeTab === "calendar" ?"/calendario" : "/tarefas")}
          className="site-brand"
          aria-label={pageCopy.aria}
        >
          <span className="site-brand-badge" aria-hidden="true" />
          <span className="site-brand-lockup">
            <span className="site-brand-text">Sistema Interno - IEEE UFJF</span>
            <span className="site-brand-meta">IEEE UFJF</span>
          </span>
        </a>

        <ul className="nav-links">
          <li><a href={demoMode ?"/demo" : "/"}>Início</a></li>
          <li><a href={demoMode ?"/demo/atas" : "/atas"}>Atas</a></li>
          <li><a href={demoMode ?"/demo/tarefas" : "/tarefas"} aria-current={activeTab === "tasks" ?"page" : undefined}>Tarefas</a></li>
          <li><a href={demoMode ?"/demo/calendario" : "/calendario"} aria-current={activeTab === "calendar" ?"page" : undefined}>Calendário</a></li>
          {auth.user.canManageMembers ?<li><a href={demoMode ?"/demo/diretoria" : "/diretoria"}>Diretoria</a></li> : null}
        </ul>

        <div className="topbar-actions">
          {demoMode ?(
            <span className="user-chip">Modo demo</span>
          ) : (
            <button
              className="user-chip"
              type="button"
              onClick={() => setIsPasswordDialogOpen(true)}
              title="Alterar senha"
            >
              {auth.user.name}
            </button>
          )}
          <button className="ghost-button" onClick={loadInternalData} disabled={isLoading}>
            Atualizar
          </button>
          {!demoMode ?(
            <button className="ghost-button" onClick={handleLogout}>
              Sair
            </button>
          ) : null}
        </div>
      </header>

      {themeToggleButton}
      {!demoMode && isPasswordDialogOpen ?(
        <UserPasswordDialog user={auth.user} onClose={() => setIsPasswordDialogOpen(false)} />
      ) : null}

      <main className="page-main internal-page-main">
        <section className="hero-panel internal-hero">
          <div>
            <p className="panel-kicker">{pageCopy.eyebrow}</p>
            <h1>{pageCopy.heading}</h1>
            <p>{pageCopy.description}</p>
          </div>
          <div className={`status-box tone-${status.tone}`}>
            <span>Status</span>
            <strong>{status.text}</strong>
          </div>
        </section>

        <section className="internal-toolbar">
          <label className="field internal-filter">
            <span>Filtrar capítulo</span>
            <select
              value={selectedChapter}
              onChange={(event) => setSelectedChapter(event.target.value)}
            >
              <option value="">Todos visíveis</option>
              {chapters.map((chapter) => (
                <option key={chapter.key} value={chapter.key}>
                  {formatChapterOption(chapter)}
                </option>
              ))}
            </select>
          </label>
          {activeTab === "tasks" ?(
            <button
              className="primary-button internal-add-button"
              type="button"
              onClick={() => setIsTaskDialogOpen(true)}
            >
              Adicionar tarefa
            </button>
          ) : (
            <div className="calendar-toolbar-actions">
              <label className="field internal-day-filter">
                <span>Dia</span>
                <input
                  type="date"
                  value={selectedCalendarDate}
                  onChange={(event) => setSelectedCalendarDate(event.target.value)}
                />
              </label>
              <button
                className="primary-button internal-add-button"
                type="button"
                onClick={openCreateEventDialog}
              >
                Agendar evento
              </button>
            </div>
          )}
        </section>

        {activeTab === "tasks" && isTaskDialogOpen ?(
          <div className="dialog-backdrop" role="presentation">
            <section
              className="password-dialog task-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="task-dialog-title"
            >
              <div className="password-dialog-header">
                <div>
                  <span>Nova tarefa</span>
                  <h2 id="task-dialog-title">Adicionar tarefa</h2>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setIsTaskDialogOpen(false)}
                  disabled={isSavingTask}
                >
                  Fechar
                </button>
              </div>

              <form className="internal-form" onSubmit={handleCreateTask}>
                <label className="field">
                  <span>Título</span>
                  <input
                    value={taskForm.title}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, title: event.target.value }))
                    }
                    maxLength={160}
                  />
                </label>

                <label className="field">
                  <span>Capítulo</span>
                  <select
                    value={taskForm.chapter}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, chapter: event.target.value }))
                    }
                  >
                    {chapters.map((chapter) => (
                      <option key={chapter.key} value={chapter.key}>
                        {formatChapterOption(chapter)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="internal-form-grid">
                  <label className="field">
                    <span>Prioridade</span>
                    <select
                      value={taskForm.priority}
                      onChange={(event) =>
                        setTaskForm((current) => ({ ...current, priority: event.target.value }))
                      }
                    >
                      {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Data limite</span>
                    <input
                      type="datetime-local"
                      value={taskForm.dueDate}
                      onChange={(event) =>
                        setTaskForm((current) => ({ ...current, dueDate: event.target.value }))
                      }
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Responsável</span>
                  <select
                    value={taskForm.assignedToId}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, assignedToId: event.target.value }))
                    }
                  >
                    <option value="">Sem responsável definido</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Descrição</span>
                  <textarea
                    rows={5}
                    value={taskForm.description}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                </label>

                <label className="member-admin-toggle compact">
                  <input
                    type="checkbox"
                    checked={Boolean(taskForm.notifyMembers)}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, notifyMembers: event.target.checked }))
                    }
                  />
                  <span>
                    <strong>Notificar membros por e-mail</strong>
                    <small>Com responsável definido, envia apenas para ele. Sem responsável, envia para o capítulo.</small>
                  </span>
                </label>

                <button className="primary-button" disabled={isSavingTask}>
                  {isSavingTask ?"Salvando..." : "Criar tarefa"}
                </button>
              </form>
            </section>
          </div>
        ) : null}

        {activeTab === "calendar" && isEventDialogOpen ?(
          <div className="dialog-backdrop" role="presentation">
            <section
              className="password-dialog task-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="event-dialog-title"
            >
              <div className="password-dialog-header">
                <div>
                  <span>{editingEvent ?"Editar evento" : "Novo evento"}</span>
                  <h2 id="event-dialog-title">{editingEvent ?"Editar evento" : "Agendar evento"}</h2>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={closeEventDialog}
                  disabled={isSavingEvent}
                >
                  Fechar
                </button>
              </div>

              <form className="internal-form" onSubmit={handleCreateEvent}>
                <label className="field">
                  <span>Título</span>
                  <input
                    value={eventForm.title}
                    onChange={(event) =>
                      setEventForm((current) => ({ ...current, title: event.target.value }))
                    }
                    maxLength={160}
                  />
                </label>

                <label className="field">
                  <span>Capítulo</span>
                  <select
                    value={eventForm.chapter}
                    onChange={(event) =>
                      setEventForm((current) => ({ ...current, chapter: event.target.value }))
                    }
                  >
                    {chapters.map((chapter) => (
                      <option key={chapter.key} value={chapter.key}>
                        {formatChapterOption(chapter)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Local</span>
                  <input
                    value={eventForm.location}
                    onChange={(event) =>
                      setEventForm((current) => ({ ...current, location: event.target.value }))
                    }
                  />
                </label>

                <div className="internal-form-grid">
                  <label className="field">
                    <span>Início</span>
                    <input
                      type="datetime-local"
                      value={eventForm.startTime}
                      onChange={(event) =>
                        setEventForm((current) => ({ ...current, startTime: event.target.value }))
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Fim</span>
                    <input
                      type="datetime-local"
                      value={eventForm.endTime}
                      onChange={(event) =>
                        setEventForm((current) => ({ ...current, endTime: event.target.value }))
                      }
                    />
                  </label>
                </div>

                <label className="field inline-check recurrence-toggle">
                  <input
                    type="checkbox"
                    checked={eventForm.recurrenceEnabled}
                    disabled={Boolean(editingEvent)}
                    onChange={(event) =>
                      setEventForm((current) => ({
                        ...current,
                        recurrenceEnabled: event.target.checked,
                      }))
                    }
                  />
                  <span>Evento recorrente</span>
                </label>

                {eventForm.recurrenceEnabled ?(
                  <div className="internal-form-grid recurrence-grid">
                    <label className="field">
                      <span>Periodicidade</span>
                      <select
                        value={eventForm.recurrenceFrequency}
                        onChange={(event) =>
                          setEventForm((current) => ({
                            ...current,
                            recurrenceFrequency: event.target.value,
                          }))
                        }
                      >
                        <option value="daily">Diária</option>
                        <option value="weekly">Semanal</option>
                        <option value="biweekly">Quinzenal</option>
                        <option value="monthly">Mensal</option>
                      </select>
                    </label>

                    <label className="field">
                      <span>Ocorrências</span>
                      <input
                        type="number"
                        min="1"
                        max="52"
                        value={eventForm.recurrenceCount}
                        onChange={(event) =>
                          setEventForm((current) => ({
                            ...current,
                            recurrenceCount: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                ) : null}

                <label className="field">
                  <span>Descrição</span>
                  <textarea
                    rows={5}
                    value={eventForm.description}
                    onChange={(event) =>
                      setEventForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                </label>

                {!editingEvent ?(
                  <label className="member-admin-toggle compact">
                    <input
                      type="checkbox"
                      checked={Boolean(eventForm.notifyMembers)}
                      onChange={(event) =>
                        setEventForm((current) => ({ ...current, notifyMembers: event.target.checked }))
                      }
                    />
                    <span>
                      <strong>Notificar membros por e-mail</strong>
                      <small>Envia o novo evento para os membros do capítulo selecionado.</small>
                    </span>
                  </label>
                ) : null}

                <button className="primary-button" disabled={isSavingEvent}>
                  {isSavingEvent
                    ?"Salvando..."
                    : editingEvent
                      ?"Salvar alterações"
                      : "Criar evento"}
                </button>
              </form>
            </section>
          </div>
        ) : null}

        {activeTab === "tasks" ?(
          <section className="tasks-display">
            <article className="panel tasks-display-panel">
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">Quadro</p>
                  <h2>{openTasks.length} tarefa(s) abertas</h2>
                </div>
              </div>

              <div className="task-board">
                {["pending", "doing", "done"].map((statusKey) => (
                  <section className="task-column" key={statusKey}>
                    <h3>{TASK_STATUS_LABELS[statusKey]}</h3>
                    <div className="task-list">
                      {displayedTasks.filter((task) => task.status === statusKey).map((task) => (
                        <article className="task-card" key={task.id}>
                          <div className="task-card__topline">
                            <span>{task.chapter}</span>
                            <span>{TASK_PRIORITY_LABELS[task.priority] || task.priority}</span>
                          </div>
                          <h4>{task.title}</h4>
                          {task.description ?<p>{task.description}</p> : null}
                          <dl>
                            <div>
                              <dt>Prazo</dt>
                              <dd>{formatDateTime(task.dueDate)}</dd>
                            </div>
                            <div>
                              <dt>Responsável</dt>
                              <dd>{task.assignedTo?.name || "Sem responsável"}</dd>
                            </div>
                          </dl>
                          <div className="task-card__actions">
                            {statusKey !== "doing" ?(
                              <button
                                className="text-button"
                                type="button"
                                onClick={() => updateTaskStatus(task, "doing")}
                              >
                                Em andamento
                              </button>
                            ) : null}
                            {statusKey !== "done" ?(
                              <button
                                className="text-button"
                                type="button"
                                onClick={() => updateTaskStatus(task, "done")}
                              >
                                Concluir
                              </button>
                            ) : null}
                            {statusKey !== "pending" ?(
                              <button
                                className="text-button"
                                type="button"
                                onClick={() => updateTaskStatus(task, "pending")}
                              >
                                Reabrir
                              </button>
                            ) : null}
                            <button
                              className="text-button danger"
                              type="button"
                              onClick={() => deleteTask(task)}
                            >
                              Excluir
                            </button>
                          </div>
                        </article>
                      ))}

                      {!displayedTasks.some((task) => task.status === statusKey) ?(
                        <div className="empty-state">Nenhuma tarefa nesta etapa.</div>
                      ) : null}
                    </div>
                  </section>
                ))}
              </div>
            </article>
          </section>
        ) : (
          <section className="calendar-display">
            <article className="panel day-schedule-panel">
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">Calendário do dia</p>
                  <h2>{formatDailyScheduleTitle(dailyEvents.length)}</h2>
                </div>
              </div>

              <div className="day-schedule-list">
                {dailyEvents.length ?(
                  dailyEvents.map((item) => (
                    <article className="day-schedule-row" key={item.id}>
                      <div className="day-schedule-time">
                        <strong>{formatTime(item.startTime)}</strong>
                        <span>{formatTime(item.endTime)}</span>
                      </div>
                      <div className="day-schedule-content">
                        <span>{item.chapter}</span>
                        <h3>{item.title}</h3>
                        <p>{item.location || "Sem local definido"}</p>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">Nenhum horário agendado</div>
                )}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">Agenda</p>
                  <h2>Eventos cadastrados</h2>
                </div>
              </div>

              <div className="calendar-list">
                {visibleCalendarEvents.length ?(
                  visibleCalendarEvents.map((item) => (
                    <article className="calendar-item" key={item.id}>
                      <div className="calendar-item__date">
                        <strong>{formatDateTime(item.startTime)}</strong>
                        <span>{item.chapter}</span>
                      </div>
                      <div className="calendar-item__content">
                        <div className="calendar-item__title-row">
                          <h3>{item.title}</h3>
                          {item.isRecurring ?(
                            <span className="recurrence-badge">Recorrente</span>
                          ) : null}
                        </div>
                        <p>{item.description || "Sem descrição."}</p>
                        <dl>
                          <div>
                            <dt>Fim</dt>
                            <dd>{formatDateTime(item.endTime)}</dd>
                          </div>
                          <div>
                            <dt>Local</dt>
                            <dd>{item.location || "Sem local definido"}</dd>
                          </div>
                        </dl>
                      </div>
                      <div className="calendar-item__actions">
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => openEditEventDialog(item)}
                        >
                          Editar
                        </button>
                        <button
                          className="text-button danger"
                          type="button"
                          onClick={() => deleteEvent(item)}
                        >
                          Excluir
                        </button>
                        {item.isRecurring ?(
                          <button
                            className="text-button danger"
                            type="button"
                            onClick={() => deleteEvent(item, { series: true })}
                          >
                            Excluir série
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">Nenhum evento cadastrado ainda.</div>
                )}
              </div>
            </article>
          </section>
        )}

        <section className="internal-summary-strip" aria-label="Resumo">
          {activeTab === "tasks" ?(
            <>
              <div>
                <span>Tarefas abertas</span>
                <strong>{openTasks.length}</strong>
              </div>
              <div>
                <span>Tarefas concluídas</span>
                <strong>{doneTasks.length}</strong>
              </div>
            </>
          ) : (
            <>
              <div>
                <span>Eventos cadastrados</span>
                <strong>{displayedEvents.length}</strong>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
