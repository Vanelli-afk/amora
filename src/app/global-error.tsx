"use client";

// Substitui o layout raiz quando ele próprio falha, por isso traz html, body e estilos próprios.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#F7F0E1", color: "#4A3B33", fontFamily: "Georgia, serif", padding: 16, textAlign: "center" }}>
        <main>
          <h1 style={{ color: "#A63E29", fontSize: 28, margin: "0 0 12px" }}>Algo deu errado</h1>
          <p style={{ margin: "0 0 24px" }}>O seu caderno está guardado. Tente abrir de novo em instantes.</p>
          <button type="button" onClick={reset} style={{ minHeight: 44, padding: "0 20px", border: 0, borderRadius: 14, background: "#BE4B33", color: "#fff", font: "inherit", fontWeight: 700, cursor: "pointer" }}>
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
