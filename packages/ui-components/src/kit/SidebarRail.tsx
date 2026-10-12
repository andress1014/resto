import React from 'react';

export interface SidebarRailItem {
  id: string;
  label: string;
  /** SVG inline (decorativo, aria-hidden recomendado). */
  icon: React.ReactNode;
  href?: string;
  /** Contador; solo se muestra si > 0. */
  badge?: number;
}

export interface SidebarRailProps {
  items: SidebarRailItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  ariaLabel?: string;
  className?: string;
  /** Contenido opcional superior (logo). */
  header?: React.ReactNode;
}

const CSS = `
.bento-rail{display:flex;flex-direction:column;align-items:center;gap:var(--bento-grid-gap);width:3.75rem;box-sizing:border-box;padding:var(--bento-grid-gap) 0;background:var(--bento-papel);border-right:1px solid var(--bento-border);color:var(--bento-text);font-family:var(--bento-font-body)}
.bento-rail__list{display:flex;flex-direction:column;align-items:center;gap:0.5rem;margin:0;padding:0;list-style:none}
.bento-rail__item{position:relative;display:flex;align-items:center;justify-content:center;width:2.75rem;height:2.75rem;border:0;border-radius:var(--bento-pill-radius);background:transparent;color:var(--bento-text);cursor:pointer;text-decoration:none;transition:background-color .15s ease,color .15s ease}
.bento-rail__item:hover{background:var(--bento-hueso)}
.bento-rail__item[data-active="true"]{background:var(--bento-tinta);color:var(--bento-papel)}
.bento-rail__item:focus-visible{outline:var(--bento-focus-ring);outline-offset:2px}
.bento-rail__item svg{width:1.25rem;height:1.25rem;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}
.bento-rail__label{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.bento-rail__badge{position:absolute;top:0;right:0;min-width:1.125rem;height:1.125rem;box-sizing:border-box;padding:0 0.25rem;border-radius:var(--bento-pill-radius);background:var(--bento-lima);color:var(--bento-tinta);font-size:0.6875rem;font-weight:700;line-height:1.125rem;text-align:center;font-variant-numeric:tabular-nums}
@media (prefers-reduced-motion:reduce){.bento-rail__item{transition:none}}
`;

export function SidebarRail({ items, activeId, onSelect, ariaLabel = 'Navegación principal', className, header }: SidebarRailProps) {
  return (
    <nav data-component="sidebar-rail" aria-label={ariaLabel} className={['bento-rail', className].filter(Boolean).join(' ')}>
      <style>{CSS}</style>
      {header}
      <ul className="bento-rail__list">
        {items.map((item) => {
          const active = item.id === activeId;
          const count = item.badge && item.badge > 0 ? item.badge : 0;
          const shown = count > 99 ? '99+' : String(count);
          const common = {
            className: 'bento-rail__item',
            'data-active': active ? 'true' : undefined,
            'aria-current': active ? ('page' as const) : undefined,
            title: item.label,
          };
          const inner = (
            <>
              {item.icon}
              <span className="bento-rail__label">{item.label}</span>
              {count > 0 && <span className="bento-rail__badge">{shown}</span>}
            </>
          );
          return (
            <li key={item.id}>
              {item.href ? (
                <a {...common} href={item.href} onClick={() => onSelect?.(item.id)}>
                  {inner}
                </a>
              ) : (
                <button type="button" {...common} onClick={() => onSelect?.(item.id)}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
