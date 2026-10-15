import { ChatAvatar } from "@/components/chat-avatar";
import { cn } from "@/lib/utils";

// Position (links, oben) und Größe in % des Quadrats, je nach Anzahl der Elemente.
const LAYOUT: Record<1 | 2 | 3 | 4, { size: number; at: [number, number][] }> = {
  1: { size: 100, at: [[0, 0]] },
  // nebeneinander, überlappend, vertikal mittig
  2: { size: 62, at: [[0, 19], [38, 19]] },
  // Dreieck: eins oben, zwei unten
  3: { size: 54, at: [[23, 0], [0, 46], [46, 46]] },
  // 2x2-Raster
  4: { size: 50, at: [[0, 0], [50, 0], [0, 50], [50, 50]] },
};

// Gleich groß wie ein einzelner ChatAvatar: Größe kommt über className/style von außen.
// Höchstens drei Orbis sichtbar, der Rest als "+N".
export function GroupAvatar({
  members,
  className,
  style,
}: {
  members: { avatar: string; color: string | null }[];
  className?: string;
  style?: React.CSSProperties;
}) {
  const shown = members.slice(0, 3);
  const extra = members.length - shown.length;
  const layout = LAYOUT[Math.max(1, shown.length + (extra > 0 ? 1 : 0)) as 1 | 2 | 3 | 4];
  const box = (i: number): React.CSSProperties => ({
    width: `${layout.size}%`,
    height: `${layout.size}%`,
    left: `${layout.at[i][0]}%`,
    top: `${layout.at[i][1]}%`,
  });
  return (
    <span className={cn("relative block shrink-0", className)} style={style}>
      {shown.map((m, i) => (
        <ChatAvatar key={i} seed={m.avatar} color={m.color} className="absolute" style={box(i)} />
      ))}
      {extra > 0 && (
        <span
          className="@container absolute flex items-center justify-center rounded-full bg-muted font-semibold leading-none text-muted-foreground"
          style={box(3)}
        >
          <span className="text-[45cqw]">+{extra}</span>
        </span>
      )}
    </span>
  );
}
