"use client";
import React, { useState, useEffect, useCallback } from 'react';
import {
  KpiDelta,
  FeatureGuard,
  Proximamente,
  EmptyState,
  ErrorState,
  Skeleton,
  StatusChip,
  BentoCard,
} from '@packages/ui-components';
import { ApiClient } from '../../../lib/api';

interface SessionItem {
  id: string;
  sessionId?: string;
  tableId: string;
  status: string;
}

interface TableItem {
  tableId: string;
  label?: string;
  status: string;
}

interface OrderItem {
  id: string;
  status: string;
  total?: number;
  tableId?: string;
  createdAt?: string;
}

interface ServiceCallItem {
  id: string;
  tableId: string;
  note?: string;
  status: string;
  createdAt?: string;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeSessions, setActiveSessions] = useState<SessionItem[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [serviceCalls, setServiceCalls] = useState<ServiceCallItem[]>([]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionsRes, tablesRes, ordersRes, callsRes] = await Promise.all([
        ApiClient.request('/v1/sessions?status=active'),
        ApiClient.request('/v1/tables'),
        ApiClient.request('/v1/orders'),
        ApiClient.request('/v1/service-calls?status=pending'),
      ]);

      const sessionsData = Array.isArray(sessionsRes) ? sessionsRes : sessionsRes?.data || [];
      const tablesData = Array.isArray(tablesRes) ? tablesRes : tablesRes?.data || [];
      const ordersData = Array.isArray(ordersRes) ? ordersRes : ordersRes?.data || [];
      const callsData = Array.isArray(callsRes) ? callsRes : callsRes?.data || [];

      setActiveSessions(Array.isArray(sessionsData) ? sessionsData : []);
      setTables(Array.isArray(tablesData) ? tablesData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setServiceCalls(Array.isArray(callsData) ? callsData : []);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
          <BentoCard style={{ backgroundColor: 'var(--bento-papel)', padding: '24px', minHeight: '140px' }}>
            <Skeleton height="72px" />
          </BentoCard>
          <BentoCard style={{ backgroundColor: 'var(--bento-papel)', padding: '24px', minHeight: '140px' }}>
            <Skeleton height="72px" />
          </BentoCard>
          <BentoCard style={{ backgroundColor: 'var(--bento-papel)', padding: '24px', minHeight: '140px' }}>
            <Skeleton height="72px" />
          </BentoCard>
          <BentoCard style={{ backgroundColor: 'var(--bento-papel)', padding: '24px', minHeight: '140px' }}>
            <Skeleton height="72px" />
          </BentoCard>
        </div>
        <BentoCard style={{ backgroundColor: 'var(--bento-papel)', padding: '24px' }}>
          <Skeleton height="24px" width="160px" style={{ marginBottom: '16px' }} />
          <Skeleton height="48px" style={{ marginBottom: '8px' }} />
          <Skeleton height="48px" />
        </BentoCard>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <ErrorState
          title="Error al cargar dashboard"
          message={error}
          onRetry={fetchDashboardData}
          retryLabel="Reintentar"
        />
      </div>
    );
  }

  // Métricas reales
  const distinctActiveTableIds = new Set(
    activeSessions.map((s: any) => s.tableId).filter(Boolean)
  );
  const activeTablesCount = distinctActiveTableIds.size;
  const totalTablesCount = tables.length;
  const activeOrders = orders.filter((o) =>
    ['PLACED', 'IN_KITCHEN', 'READY'].includes(o.status)
  );
  const activeOrdersCount = activeOrders.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <style>{`
        [data-component="bento-card"] [data-testid="proximamente"] {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border: none !important;
        }
      `}</style>
      {/* Fila de KPIs en tarjetas BentoCard */}
      <section aria-label="Indicadores clave de rendimiento">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '24px',
            alignItems: 'stretch',
          }}
        >
          <BentoCard
            style={{
              backgroundColor: 'var(--bento-papel)',
              padding: '24px',
              minHeight: '140px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <KpiDelta
              label="Mesas Activas"
              value={String(activeTablesCount)}
              delta={activeTablesCount > 0 ? `${activeTablesCount} en sala` : 'sin mesas'}
              trend={activeTablesCount > 0 ? 'up' : 'neutral'}
              context={`de ${totalTablesCount} mesas configuradas`}
            />
          </BentoCard>

          <BentoCard
            style={{
              backgroundColor: 'var(--bento-papel)',
              padding: '24px',
              minHeight: '140px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <KpiDelta
              label="Pedidos Activos"
              value={String(activeOrdersCount)}
              delta={activeOrdersCount > 0 ? `${activeOrdersCount} en curso` : 'al día'}
              trend={activeOrdersCount > 0 ? 'up' : 'neutral'}
              context="en preparación y sala"
            />
          </BentoCard>

          <BentoCard
            style={{
              backgroundColor: 'var(--bento-papel)',
              padding: '24px',
              minHeight: '140px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <FeatureGuard
              flag="analytics"
              fallback={<Proximamente featureName="Ventas del Día" />}
            >
              <Proximamente featureName="Ventas del Día" />
            </FeatureGuard>
          </BentoCard>

          <BentoCard
            style={{
              backgroundColor: 'var(--bento-papel)',
              padding: '24px',
              minHeight: '140px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <FeatureGuard
              flag="analytics"
              fallback={<Proximamente featureName="Ticket Promedio" />}
            >
              <Proximamente featureName="Ticket Promedio" />
            </FeatureGuard>
          </BentoCard>
        </div>
      </section>

      {/* Brief operativo con alertas reales */}
      <section aria-label="Brief operativo y alertas">
        <BentoCard style={{ backgroundColor: 'var(--bento-papel)', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontFamily: 'var(--bento-font-heading)',
                color: 'var(--bento-text)',
              }}
            >
              Brief Operativo & Alertas
            </h2>
            {serviceCalls.length > 0 && (
              <StatusChip tone="warning" label={`${serviceCalls.length} pendientes`} />
            )}
          </div>

          {serviceCalls.length === 0 ? (
            <EmptyState
              title="Sin alertas activas"
              description="Servicio al día. No hay llamadas de mesero ni solicitudes pendientes."
            />
          ) : (
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {serviceCalls.map((call) => {
                const tableMatch = tables.find((t) => (t.tableId || (t as any).id) === call.tableId);
                const tableLabel = tableMatch?.label || `Mesa ${call.tableId}`;

                return (
                  <li
                    key={call.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 'var(--bento-card-radius)',
                      background: 'var(--bento-hueso)',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '14px',
                          color: 'var(--bento-text)',
                        }}
                      >
                        {tableLabel}
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--bento-text-muted)' }}>
                        {call.note || 'Solicitud de asistencia'}
                      </span>
                    </div>
                    <StatusChip tone="warning" label="Pendiente" />
                  </li>
                );
              })}
            </ul>
          )}
        </BentoCard>
      </section>
    </div>
  );
}
