import { dayOfWeek, daysInMonth, makeDay, parseDay } from "@/lib/dates";
import { holidayOn } from "@/lib/holidays";

export function MiniMonth({ month, today, marked, initials }: {
  month: string; today: string; marked: Set<string>; initials: readonly string[];
}) {
  const { y, m } = parseDay(`${month}-01`);
  const lead = dayOfWeek(`${month}-01`);
  const total = daysInMonth(y, m);

  return (
    <div className="mini" aria-hidden="true">
      {initials.map((letter, index) => <span key={index} className="dw">{letter}</span>)}
      {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} className="md e" />)}
      {Array.from({ length: total }, (_, i) => {
        const day = makeDay(y, m, i + 1);
        const classes = [
          "md",
          day === today ? "today" : "",
          holidayOn(day) ? "fer" : "",
          marked.has(day) && day !== today ? "has" : "",
        ].filter(Boolean).join(" ");
        return <span key={day} className={classes}>{i + 1}</span>;
      })}
    </div>
  );
}
