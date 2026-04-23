"use client";

import { useState } from "react";

async function readApiError(response, fallback) {
  try {
    const payload = await response.json();
    return payload.detail || fallback;
  } catch {
    return fallback;
  }
}

function createInitialPasswordForm() {
  return {
    confirmPassword: "",
    currentPassword: "",
    newPassword: "",
  };
}

export default function UserPasswordDialog({ onClose, user }) {
  const [form, setForm] = useState(createInitialPasswordForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({
    tone: "idle",
    text: "Informe sua senha atual para confirmar a troca.",
  });

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (form.newPassword !== form.confirmPassword) {
      setMessage({ tone: "error", text: "A confirmacao da nova senha nao confere." });
      return;
    }

    setIsSubmitting(true);
    setMessage({ tone: "loading", text: "Alterando sua senha..." });

    try {
      const response = await fetch("/api/auth/password", {
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Nao foi possivel alterar a senha."));
      }

      setForm(createInitialPasswordForm());
      setMessage({ tone: "success", text: "Senha alterada com sucesso." });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error.message || "Nao foi possivel alterar a senha.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        className="password-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="password-dialog-header">
          <div>
            <p className="panel-kicker">Conta</p>
            <h2>Alterar senha</h2>
            <span>{user?.name ? `${user.name} (@${user.username})` : "Usuario autenticado"}</span>
          </div>
          <button className="text-button" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form className="password-dialog-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Senha atual</span>
            <input
              autoComplete="current-password"
              required
              type="password"
              value={form.currentPassword}
              onChange={(event) => updateField("currentPassword", event.target.value)}
            />
          </label>

          <label className="field">
            <span>Nova senha</span>
            <input
              autoComplete="new-password"
              minLength={6}
              required
              type="password"
              value={form.newPassword}
              onChange={(event) => updateField("newPassword", event.target.value)}
            />
          </label>

          <label className="field">
            <span>Confirmar nova senha</span>
            <input
              autoComplete="new-password"
              minLength={6}
              required
              type="password"
              value={form.confirmPassword}
              onChange={(event) => updateField("confirmPassword", event.target.value)}
            />
          </label>

          <div className={`inline-message inline-message-${message.tone}`}>
            {message.text}
          </div>

          <div className="inline-actions">
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Alterando..." : "Alterar senha"}
            </button>
            <button className="soft-button" type="button" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
