"use client";

export default function LoadingBall() {
  return (
    <div className="app-shell loading-shell" aria-live="polite" aria-busy="true">
      <span className="loading-ball" aria-label="Carregando" />
    </div>
  );
}
