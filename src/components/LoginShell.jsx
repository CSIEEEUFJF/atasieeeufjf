"use client";

export default function LoginShell({
  authForm,
  description,
  isSetup,
  isSubmitting,
  message,
  onFieldChange,
  onSubmit,
  submitLabel,
  submittingLabel,
  themeToggle,
  title,
}) {
  return (
    <div className="app-shell auth-shell auth-shell-shadcn">
      {themeToggle}

      <main className="login-02-shell">
        <section className="login-02-card" aria-label="Acesso ao sistema interno">
          <div className="login-02-form-pane">
            <a className="login-02-brand" href="/" aria-label={"Ir para in\u00edcio"}>
              <span className="login-02-brand-icon" aria-hidden="true" />
              <span className="login-02-brand-lockup">
                <strong>Universidade Federal de Juiz de Fora</strong>
                <small>IEEE Student Branch</small>
              </span>
              <span className="login-02-brand-divider" aria-hidden="true" />
              <span className="login-02-brand-system">Sistema Interno</span>
            </a>

            <div className="login-02-form-stack">
              <div className="login-02-heading">
                <h1>{title}</h1>
                <p>{description}</p>
              </div>

              <form className="login-02-form" onSubmit={onSubmit}>
                {isSetup ?(
                  <label className="field">
                    <span>Nome</span>
                    <input
                      value={authForm.name}
                      onChange={(event) => onFieldChange("name", event.target.value)}
                      autoComplete="name"
                      placeholder="Seu nome"
                    />
                  </label>
                ) : null}

                <label className="field">
                  <span>{"Nome de usu\u00e1rio"}</span>
                  <input
                    value={isSetup ?authForm.username : authForm.name}
                    onChange={(event) => onFieldChange(isSetup ?"username" : "name", event.target.value)}
                    autoComplete="username"
                    placeholder={"Digite seu nome de usu\u00e1rio"}
                  />
                </label>

                <label className="field">
                  <span>Senha</span>
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={(event) => onFieldChange("password", event.target.value)}
                    autoComplete={isSetup ?"new-password" : "current-password"}
                    placeholder="Digite sua senha"
                  />
                </label>

                <div className={`status-box tone-${message.tone}`}>
                  <span>Status</span>
                  <strong>{message.text}</strong>
                </div>

                <button className="primary-button login-02-submit" disabled={isSubmitting}>
                  {isSubmitting ?submittingLabel : submitLabel}
                </button>

                {!isSetup ?(
                  <a className="soft-button login-02-demo-link" href="/demo">
                    Conhecer o sistema
                  </a>
                ) : null}
              </form>
            </div>
          </div>

          <aside className="login-02-cover" aria-label="Sistema Interno IEEE UFJF">
            <img
              className="login-02-cover-image"
              src="/login-ramo.jpg"
              alt="Membros do Ramo Estudantil IEEE UFJF"
            />
          </aside>
        </section>
      </main>
    </div>
  );
}
