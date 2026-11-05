export function AuthArt({ line, tagline }: { line: string; tagline: string }) {
  return (
    <section className="auth-art">
      <svg viewBox="0 0 420 250" width="520" height="310" aria-hidden="true" className="auth-illustration">
        <ellipse cx="210" cy="238" rx="176" ry="9" fill="#4A3B33" opacity=".09" />
        <path d="M30 34Q120 18 206 40V224Q120 206 30 222Z" fill="#FFFCF5" stroke="#D9C8A6" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M214 40Q300 18 390 34V222Q300 206 214 224Z" fill="#FFFCF5" stroke="#D9C8A6" strokeWidth="2.5" strokeLinejoin="round" />
        <g stroke="#E8DCC2" strokeWidth="2.5" strokeLinecap="round"><path d="M52 98H184M52 124H184M52 150H184M52 176H150M238 98H370M238 124H370M238 150H336M238 176H356" /></g>
        <path d="M240 94h96" stroke="#FBE58A" strokeWidth="10" strokeLinecap="round" opacity=".9" />
        <text x="52" y="76" fontFamily="var(--font-caveat),cursive" fontSize="30" fontWeight="600" fill="#BE4B33">{line}</text>
        <g fill="none" stroke="#B9A57F" strokeWidth="4" strokeLinecap="round"><path d="M198 52h20M198 80h20M198 108h20M198 136h20M198 164h20M198 192h20" /></g>
        <path d="M356 50l4 12 12 4-12 4-4 12-4-12-12-4 12-4z" fill="#F0B93A" />
        <g transform="translate(318 132) scale(.95)">
          <path d="M32 52C32 38 26 30 14 26c-1 12 5 22 18 26z" fill="#9CBF93" />
          <path d="M32 52c0-16 7-26 20-30 1 14-6 26-20 30z" fill="#7FA877" />
          <path d="M32 52c-1-12 1-22 6-32-7 6-9 18-6 32z" fill="#B7D3AE" />
          <path d="M18 52h28l-3 22a4 4 0 01-4 3.5H25a4 4 0 01-4-3.5L18 52z" fill="#E3A07E" />
          <rect x="15" y="48" width="34" height="8" rx="3" fill="#D98F6B" />
        </g>
      </svg>
      <h1 className="ser auth-brand">Amora</h1>
      <p className="hand auth-tagline">{tagline}</p>
    </section>
  );
}
