import React, { useEffect, useState } from 'react';
import { PwaApiClient } from '../../../../lib/api';
import { BentoCard } from '@packages/ui-components';

export interface TableLandingPageProps {
  params: {
    tenantId: string;
    tableId: string;
  };
  searchParams?: {
    k?: string;
  };
}

export default function TableLandingPage({ params, searchParams }: TableLandingPageProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Reset URL to the table landing route if previous navigation was to /menu
    if (typeof window !== 'undefined' && window.location.pathname.includes('/menu')) {
      window.history.pushState({}, '', `/t/${params.tenantId}/${params.tableId}`);
    }

    async function initializeSession() {
      try {
        const qrKey = searchParams?.k;
        if (!qrKey) {
          throw new Error('QR_KEY_INVALID: Código QR requerido');
        }

        await PwaApiClient.openSession({
          tenantId: params.tenantId,
          tableId: params.tableId,
          qrKey,
        });

        if (isMounted) {
          window.history.pushState({}, '', `/t/${params.tenantId}/${params.tableId}/menu`);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Error al conectar con la mesa');
        }
      }
    }

    initializeSession();

    return () => {
      isMounted = false;
    };
  }, [params.tenantId, params.tableId, searchParams?.k]);

  if (error) {
    return (
      <BentoCard>
        <div role="alert" style={{ color: 'var(--bento-destructive)' }}>
          {error}
        </div>
      </BentoCard>
    );
  }

  return (
    <BentoCard>
      <div style={{ color: 'var(--bento-text)' }}>Conectando con la mesa...</div>
    </BentoCard>
  );
}
