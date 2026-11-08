import { useId } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  title: string;
  actions?: ReactNode;
}

export function Panel({ title, actions, children, className = '', ...props }: PanelProps) {
  const titleId = useId();
  return (
    <section {...props} className={`bb-panel ${className}`} aria-labelledby={titleId}>
      <header className="bb-panel__header">
        <h2 id={titleId}>{title}</h2>
        {actions}
      </header>
      <div className="bb-panel__body">{children}</div>
    </section>
  );
}
