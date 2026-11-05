import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PREFIXES = [
  "/entrar", "/criar-conta", "/esqueci-senha", "/redefinir-senha", "/verificar-email", "/privacidade", "/termos",
];

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // next/font e os atributos style do React exigem unsafe-inline; não há como executar script por aqui.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Só evita um render inútil. A validação real da sessão acontece em requireUser().
  const isPublic = pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isPublic && !pathname.startsWith("/api/") && !getSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    const destination = `${pathname}${search}`;
    if (destination !== "/hoje") url.searchParams.set("volta", destination);
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icons/|sw\\.js|offline\\.html|manifest\\.webmanifest|icon\\.svg|favicon\\.ico).*)",
  ],
};
