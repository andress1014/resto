"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { FeatureGuard } from '@packages/ui-components';
import { StatusChip, Skeleton, ErrorState } from '@packages/ui-components';
import { OrderDTO, ServiceCallDTO, OrderStatus, TableDTO } from '@packages/shared-types';
import { KdsBoard, ServiceCallPanel, KdsLiveAnnouncer } from '../../../components/kds';
import * as realtime from '../../../lib/realtime';
import { ApiClient } from '../../../lib/api';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export default function KdsPage() {
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [calls, setCalls] = useState<ServiceCallDTO[]>([]);
  const [tables, setTables] = useState<TableDTO[]>([]);
  const [announcement, setAnnouncement] = useState<string>('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Carga inicial vía ApiClient (nunca tablero en blanco)
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [ordersRes, callsRes, tablesRes] = await Promise.allSettled([
        ApiClient.request('/v1/orders'),
        ApiClient.request('/v1/service-calls'),
        ApiClient.request('/v1/tables'),
      ]);

      if (ordersRes.status === 'fulfilled') {
        const data = ordersRes.value?.data || ordersRes.value;
        if (Array.isArray(data)) {
          setOrders(data);
        }
      }

      if (callsRes.status === 'fulfilled') {
        const data = callsRes.value?.data || callsRes.value;
        if (Array.isArray(data)) {
          setCalls(data);
        }
      }

      if (tablesRes.status === 'fulfilled') {
        const data = tablesRes.value?.data || tablesRes.value;
        if (Array.isArray(data)) {
          setTables(data);
        }
      }
    } catch (err: any) {
      setFetchError(err.message || 'Error al cargar datos de cocina');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Hook realtime socket when mounted (if token exists)
  useEffect(() => {
    const token =
      ApiClient.token ||
      (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!token) {
      setConnectionStatus('disconnected');
      return;
    }

    const socket = realtime.connectOrdersSocket(token);

    socket.on('connect', () => {
      setConnectionStatus('connected');
    });

    socket.on('connect_error', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('order:created', (data: { order: OrderDTO }) => {
      setOrders((prev) => {
        if (prev.some((o) => o.id === data.order.id)) return prev;
        return [...prev, data.order];
      });
      setAnnouncement(`Nueva orden de la mesa ${data.order.tableId}`);
    });

    socket.on('order:status-changed', (data: { order: OrderDTO; status: OrderStatus }) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === data.order.id ? data.order : o))
      );
      if (data.status === 'READY') {
        setAnnouncement(`Orden de la mesa ${data.order.tableId} lista`);
      }
    });

    socket.on('service-call:created', (data: { call: ServiceCallDTO }) => {
      setCalls((prev) => [...prev, data.call]);
      setAnnouncement(`Llamado de servicio en la mesa ${data.call.tableId}`);
    });

    socket.on('service-call:resolved', (data: { call: ServiceCallDTO }) => {
      setCalls((prev) => prev.filter((c) => c.callId !== data.call.callId));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleAdvanceStatus = async (orderId: string, nextStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await ApiClient.request(`/v1/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      const updated = res?.data || res;
      if (updated && updated.id) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      }
    } catch {
      // Ignoramos error o mantenemos estado actual
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleResolveCall = async (callId: string) => {
    try {
      await ApiClient.request(`/v1/service-calls/${callId}/resolve`, {
        method: 'PATCH',
      });
      setCalls((prev) => prev.filter((c) => c.callId !== callId));
    } catch {
      // Ignoramos error o mantenemos estado actual
    }
  };

  const connectionChip =
    connectionStatus === 'connected' ? (
      <StatusChip label="En vivo" tone="ok" />
    ) : connectionStatus === 'connecting' ? (
      <StatusChip label="Conectando..." tone="warning" />
    ) : (
      <StatusChip label="Desconectado" tone="error" />
    );

  return (
    <FeatureGuard flag="kitchen-display">
      <div
        style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          maxWidth: '1600px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <KdsLiveAnnouncer message={announcement} />

        {/* Encabezado KDS con estado en vivo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--bento-text)',
                fontFamily: 'var(--bento-font-heading)',
              }}
            >
              Pantalla de Cocina
            </h1>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '13px',
                color: 'var(--bento-text-muted)',
              }}
            >
              Monitor operativo de pedidos y llamadas de sala
            </p>
          </div>
          <div>{connectionChip}</div>
        </div>

        {fetchError ? (
          <ErrorState
            title="Error al cargar pedidos"
            message={fetchError}
            onRetry={loadInitialData}
            retryLabel="Reintentar carga"
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '24px',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 680px', minWidth: '300px' }}>
              {isLoading && orders.length === 0 ? (
                <div style={{ marginBottom: '16px' }}>
                  <Skeleton height="80px" radius="var(--bento-card-radius)" />
                </div>
              ) : null}
              <KdsBoard
                orders={orders}
                tables={tables}
                onAdvanceStatus={handleAdvanceStatus}
                updatingOrderId={updatingOrderId}
              />
            </div>
            <div style={{ width: '320px', flexShrink: 0 }}>
              <ServiceCallPanel calls={calls} tables={tables} onResolve={handleResolveCall} />
            </div>
          </div>
        )}
      </div>
    </FeatureGuard>
  );
}
