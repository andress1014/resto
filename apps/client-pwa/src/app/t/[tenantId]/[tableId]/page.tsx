"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
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
          const targetUrl = `/t/${params.tenantId}/${params.tableId}/menu`;
          if (typeof window !== 'undefined' && window.location) {
            window.history.pushState({}, '', targetUrl);
          }
          router.push(targetUrl);
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
  }, [params.tenantId, params.tableId, searchParams?.k, router]);

  if (error) {
    return (
      <div style={{ padding: '16px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <BentoCard>
            <div role="alert" style={{ color: 'var(--bento-destructive)', fontWeight: 600 }}>
              {error}
            </div>
          </BentoCard>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <BentoCard>
          <div style={{ color: 'var(--bento-text)', textAlign: 'center', padding: '12px 0' }}>
            Conectando con la mesa...
          </div>
        </BentoCard>
      </div>
    </div>
  );
}
