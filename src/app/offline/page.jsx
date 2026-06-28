export const metadata = {
  title: "Serviço de dados indisponível | Sistema Interno IEEE UFJF",
};

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <section className="offline-card">
        <a href="/" className="home-branch-brand offline-brand" aria-label="Sistema Interno IEEE UFJF">
          <span className="home-branch-logo" aria-hidden="true" />
          <span className="home-branch-lockup">
            <span>Universidade Federal de Juiz de Fora</span>
            <strong>IEEE Student Branch</strong>
          </span>
          <span className="home-branch-divider" aria-hidden="true" />
          <span className="home-system-title">Sistema Interno</span>
        </a>

        <div className="offline-content">
          <p className="panel-kicker">Serviço de dados offline</p>
          <h1>Não foi possível conectar ao armazenamento</h1>
          <p>
            O sistema interno continua disponível, mas o serviço responsável por arquivos,
            uploads e downloads está temporariamente indisponível. Aguarde alguns instantes e
            tente novamente.
          </p>
        </div>

        <div className="offline-actions">
          <a className="primary-button" href="/arquivos">
            Tentar novamente
          </a>
          <a className="soft-button" href="mailto:ieee.csufjf@gmail.com">
            Falar com suporte
          </a>
        </div>
      </section>
    </main>
  );
}
