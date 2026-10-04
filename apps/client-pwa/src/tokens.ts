export const PWA_BENTO_TOKENS: Record<string, string> = {
  '--bento-page-bg': '#FEF2F2',
  '--bento-card-bg': '#FFFFFF',
  '--bento-card-radius': '24px',
  '--bento-inner-radius': '16px',
  '--bento-grid-gap': '16px',
  '--bento-card-shadow': '0 4px 6px rgba(0,0,0,0.05)',
  '--bento-text': '#450A0A',
  '--bento-text-muted': '#475569',
  '--bento-accent': '#A16207',
  '--bento-accent-strong': '#DC2626',
  '--bento-success': '#15803D',
  '--bento-destructive': '#DC2626',
  '--bento-touch-target': '44px',
  '--bento-touch-gap': '8px',
  '--bento-safe-bottom': 'env(safe-area-inset-bottom)',
};

export const PWA_BENTO_STYLESHEET = `
:root {
  --bento-page-bg: #FEF2F2;
  --bento-card-bg: #FFFFFF;
  --bento-card-radius: 24px;
  --bento-inner-radius: 16px;
  --bento-grid-gap: 16px;
  --bento-card-shadow: 0 4px 6px rgba(0,0,0,0.05);
  --bento-text: #450A0A;
  --bento-text-muted: #475569;
  --bento-accent: #A16207;
  --bento-accent-strong: #DC2626;
  --bento-success: #15803D;
  --bento-destructive: #DC2626;
  --bento-touch-target: 44px;
  --bento-touch-gap: 8px;
  --bento-safe-bottom: env(safe-area-inset-bottom);
}

[data-component="bento-grid"] {
  display: grid;
  gap: var(--bento-grid-gap);
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  [data-component="bento-grid"] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.touchable {
  min-height: var(--bento-touch-target);
  min-width: var(--bento-touch-target);
  margin-bottom: var(--bento-touch-gap);
}

.safe-bottom {
  padding-bottom: var(--bento-safe-bottom);
}
`;
