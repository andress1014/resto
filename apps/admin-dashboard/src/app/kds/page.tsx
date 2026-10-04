import React, { useState, useEffect } from 'react';
import { FeatureGuard } from '@packages/ui-components';
import { OrderDTO, ServiceCallDTO, OrderStatus } from '@packages/shared-types';
import { KdsBoard, ServiceCallPanel, KdsLiveAnnouncer } from '../../components/kds';
import * as realtime from '../../lib/realtime';

export default function KdsPage() {
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [calls, setCalls] = useState<ServiceCallDTO[]>([]);
  const [announcement, setAnnouncement] = useState<string>('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Hook realtime socket when mounted (if token exists)
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    const socket = realtime.connectOrdersSocket(token);

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
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`/v1/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      }
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleResolveCall = async (callId: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const res = await fetch(`/v1/service-calls/${callId}/resolve`, {
      method: 'PATCH',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.ok) {
      setCalls((prev) => prev.filter((c) => c.callId !== callId));
    }
  };

  return (
    <FeatureGuard flag="kitchen-display">
      <div className="p-6 space-y-6">
        <KdsLiveAnnouncer message={announcement} />
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <KdsBoard
              orders={orders}
              onAdvanceStatus={handleAdvanceStatus}
              updatingOrderId={updatingOrderId}
            />
          </div>
          <div className="w-full lg:w-80">
            <ServiceCallPanel calls={calls} onResolve={handleResolveCall} />
          </div>
        </div>
      </div>
    </FeatureGuard>
  );
}
