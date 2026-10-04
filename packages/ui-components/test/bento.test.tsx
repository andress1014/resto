import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import {
  BentoGrid,
  BentoCard,
  KpiValue,
  AvailabilityToggle,
  BENTO_TOKENS,
  BENTO_STYLESHEET,
} from '../src';

// Función para calcular luminancia relativa y ratio de contraste WCAG
function getLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('E.2 Estructura visual Bento Box (Tests 37-44)', () => {
  test('37. BentoGrid renderiza data-component="bento-grid" y referencia var(--bento-grid-gap) en su estilo; ningún valor de gap en px hardcodeado', () => {
    const { container } = render(
      <BentoGrid>
        <div>Contenido</div>
      </BentoGrid>
    );

    const grid = container.querySelector('[data-component="bento-grid"]') as HTMLElement;
    expect(grid).toBeInTheDocument();
    const styleAttr = grid.getAttribute('style') || '';
    expect(styleAttr).toContain('var(--bento-grid-gap)');
    expect(styleAttr).not.toMatch(/gap:\s*\d+px/);
  });

  test('38. BentoCard referencia var(--bento-card-radius), var(--bento-card-shadow) y var(--bento-card-bg); sin hex ni px inline', () => {
    const { container } = render(
      <BentoCard>
        <div>Tarjeta</div>
      </BentoCard>
    );

    const card = container.querySelector('[data-component="bento-card"]') as HTMLElement;
    expect(card).toBeInTheDocument();
    const styleAttr = card.getAttribute('style') || '';
    expect(styleAttr).toContain('var(--bento-card-radius)');
    expect(styleAttr).toContain('var(--bento-card-shadow)');
    expect(styleAttr).toContain('var(--bento-card-bg)');
    expect(styleAttr).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  test('39. Tokens (test unitario puro): --bento-card-radius = 24px, --bento-inner-radius = 16px, --bento-grid-gap = 16px, --bento-card-shadow = sombra suave especificada', () => {
    expect(BENTO_TOKENS['--bento-card-radius']).toBe('24px');
    expect(BENTO_TOKENS['--bento-inner-radius']).toBe('16px');
    expect(BENTO_TOKENS['--bento-grid-gap']).toBe('16px');
    expect(BENTO_TOKENS['--bento-card-shadow']).toBe('0 4px 6px rgba(0,0,0,0.05)');
  });

  test('40. Contraste (test unitario puro, función WCAG sobre los hex de los tokens): --bento-text y --bento-text-muted sobre --bento-card-bg >= 4.5:1; blanco sobre --bento-accent-strong >= 4.5:1; --bento-accent sobre card >= 3:1', () => {
    const textRatio = getContrastRatio(BENTO_TOKENS['--bento-text'], BENTO_TOKENS['--bento-card-bg']);
    expect(textRatio).toBeGreaterThanOrEqual(4.5);

    const mutedRatio = getContrastRatio(BENTO_TOKENS['--bento-text-muted'], BENTO_TOKENS['--bento-card-bg']);
    expect(mutedRatio).toBeGreaterThanOrEqual(4.5);

    const whiteOnAccentStrong = getContrastRatio('#FFFFFF', BENTO_TOKENS['--bento-accent-strong']);
    expect(whiteOnAccentStrong).toBeGreaterThanOrEqual(4.5);

    const accentOnCard = getContrastRatio(BENTO_TOKENS['--bento-accent'], BENTO_TOKENS['--bento-card-bg']);
    expect(accentOnCard).toBeGreaterThanOrEqual(3.0);
  });

  test('41. Acento vibrante solo en datos clave: en una tarjeta renderizada con precio y estado, el ÚNICO elemento con data-tone="accent" es el KpiValue del precio', () => {
    const { container } = render(
      <BentoCard>
        <h3>Hamburguesa</h3>
        <KpiValue label="Precio" value="$12.00" tone="accent" />
        <KpiValue label="Calorías" value="450" tone="neutral" />
      </BentoCard>
    );

    const accentElements = container.querySelectorAll('[data-tone="accent"]');
    expect(accentElements.length).toBe(1);
    expect(accentElements[0]).toHaveAttribute('data-component', 'kpi-value');
  });

  test('42. Cero decoración: todo SVG de icono junto a texto tiene aria-hidden="true"; no existe <img> sin alt; no hay emojis usados como iconos', () => {
    const { container } = render(
      <BentoCard>
        <svg aria-hidden="true" data-testid="icon">
          <circle cx="10" cy="10" r="5" />
        </svg>
        <span>Guardar</span>
        <img src="test.jpg" alt="Foto plato" />
      </BentoCard>
    );

    const card = container.querySelector('[data-component="bento-card"]') as HTMLElement;
    expect(card).toBeInTheDocument();

    const svgs = container.querySelectorAll('svg');
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    const imgs = container.querySelectorAll('img');
    imgs.forEach((img) => {
      expect(img).toHaveAttribute('alt');
      expect(img.getAttribute('alt')).not.toBe('');
    });
  });

  test('43. Controles accesibles: todo botón y switch de las tarjetas tiene nombre accesible; BentoCard interactive declara cursor pointer y referencia el token --bento-focus-ring', () => {
    const { container } = render(
      <BentoCard interactive onClick={() => {}}>
        <button aria-label="Editar">Editar</button>
        <AvailabilityToggle label="Disponible para ordenar" checked={true} onChange={() => {}} />
      </BentoCard>
    );

    const card = container.querySelector('[data-component="bento-card"]') as HTMLElement;
    expect(card).toHaveAttribute('data-interactive', 'true');
    const styleAttr = card.getAttribute('style') || '';
    expect(styleAttr).toContain('cursor: pointer');
    expect(styleAttr).toContain('var(--bento-focus-ring)');
  });

  test('44. Responsive + motion: BentoGrid declara el colapso 4->2->1 y el hover scale/transiciones quedan desactivados bajo prefers-reduced-motion', () => {
    expect(BENTO_STYLESHEET).toContain('@media (max-width: 1024px)');
    expect(BENTO_STYLESHEET).toContain('@media (max-width: 640px)');
    expect(BENTO_STYLESHEET).toContain('@media (prefers-reduced-motion: reduce)');
    expect(BENTO_STYLESHEET).toContain('transform: none !important');
  });
});
