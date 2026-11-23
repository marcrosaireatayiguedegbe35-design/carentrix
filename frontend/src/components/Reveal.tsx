import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.16, rootMargin: "0px 0px -10% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

export function Reveal({
  children,
  className = "",
  as: Tag = "div",
  delayMs = 0,
  id,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "ol" | "li" | "p" | "h2";
  delayMs?: number;
  id?: string;
}) {
  const ref = useReveal<HTMLElement>();

  return (
    <Tag
      ref={ref as never}
      id={id}
      className={`reveal ${className}`.trim()}
      style={delayMs ? ({ "--reveal-delay": `${delayMs}ms` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
