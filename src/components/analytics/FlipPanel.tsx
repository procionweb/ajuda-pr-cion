import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import "./flip-panel.css";

export function FlipPanel({
  flipped,
  onBack,
  title,
  front,
  back,
  className = "",
}: {
  flipped: boolean;
  onBack: () => void;
  title: string;
  front: ReactNode;
  back: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const face = frontRef.current;
    if (!face) return;
    const observer = new ResizeObserver(() => {
      root.current?.style.setProperty("--flip-height", `${face.offsetHeight}px`);
    });
    observer.observe(face);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (flipped) {
      backButton.current?.focus({ preventScroll: true });
    } else {
      trigger.current?.focus({ preventScroll: true });
    }
  }, [flipped]);
  return (
    <div
      ref={root}
      className="analytics-flip"
      data-flipped={flipped}
      onKeyDown={(event) => {
        if (event.key === "Escape" && flipped) {
          event.stopPropagation();
          onBack();
        }
      }}
    >
      <div className="analytics-flip__rotor">
        <div
          ref={frontRef}
          className={`analytics-flip__front ${className}`}
          inert={flipped}
          aria-hidden={flipped}
          onFocusCapture={(event) => {
            trigger.current = event.target as HTMLElement;
          }}
        >
          {front}
        </div>
        <div className="analytics-flip__back" inert={!flipped} aria-hidden={!flipped}>
          <header className="analytics-flip__heading">
            <button
              ref={backButton}
              type="button"
              onClick={onBack}
              title="Voltar ao resumo"
              aria-label="Voltar ao resumo"
            >
              <ArrowLeft size={18} />
            </button>
            <h3>{title}</h3>
          </header>
          <div className="analytics-flip__details">{back}</div>
        </div>
      </div>
    </div>
  );
}
