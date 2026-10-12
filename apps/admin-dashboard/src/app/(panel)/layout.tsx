import React from 'react';
import type { Metadata } from 'next';
import PanelShell from './PanelShell';

export const metadata: Metadata = {
  title: 'Panel - Restaurante OS',
  description: 'Panel operativo: menú, mesas, cocina y cobros',
};

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <PanelShell>{children}</PanelShell>;
}
