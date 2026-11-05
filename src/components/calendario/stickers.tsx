export function Sticker({ kind }: { kind: "star" | "rainbow" | "moon" }) {
  if (kind === "star") {
    return <svg className="stk" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2l2 7 7 3-7 3-2 7-2-7-7-3 7-3z" fill="#F0B93A" /></svg>;
  }
  if (kind === "rainbow") {
    return (
      <svg className="stk" viewBox="0 0 24 14" width="26" height="15" aria-hidden="true">
        <path d="M2 13a10 10 0 0120 0" fill="none" stroke="#F2A09A" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M6 13a6 6 0 0112 0" fill="none" stroke="#9CCBEA" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    );
  }
  return <svg className="stk" viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z" fill="#E9C95F" /></svg>;
}
