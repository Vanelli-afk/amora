"use client";

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div className="empty" role="alert" style={{ marginTop: 40 }}>
      <h2 className="h2">Algo saiu do lugar</h2>
      <p>Não conseguimos abrir esta página agora. Os seus dados estão a salvo.</p>
      <button type="button" className="btn btn-p" onClick={reset}>Tentar de novo</button>
    </div>
  );
}
