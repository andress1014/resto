"use client";
import React, { useState, useEffect } from 'react';
import { FeatureGuard, BentoCard } from '@packages/ui-components';
import { BillDTO, PaymentMethod, TableSessionDTO, TableDTO } from '@packages/shared-types';
import {
  ActiveTablesGrid,
  BillSummaryCard,
  PaymentMethodPicker,
  ConfirmPaymentButton,
  PaymentSuccessCard,
} from '../../../components/checkout';
import { ApiClient } from '../../../lib/api';

export default function CheckoutPage() {
  const [sessions, setSessions] = useState<TableSessionDTO[]>([]);
  const [tables, setTables] = useState<TableDTO[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedSession, setSelectedSession] = useState<TableSessionDTO | null>(null);
  const [bill, setBill] = useState<BillDTO | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [completedPayment, setCompletedPayment] = useState<{
    tableId: string;
    amount: number;
    method: PaymentMethod;
  } | null>(null);

  const fetchTables = async () => {
    try {
      const res = await ApiClient.request('/v1/tables');
      if (Array.isArray(res)) {
        setTables(res);
      } else if (res?.data && Array.isArray(res.data)) {
        setTables(res.data);
      }
    } catch {
      // no bloqueante si falla la lista de mesas
    }
  };

  const fetchActiveSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await ApiClient.request('/v1/sessions?status=active');
      if (Array.isArray(res)) {
        setSessions(res);
      } else if (res?.data && Array.isArray(res.data)) {
        setSessions(res.data);
      }
    } catch (err: any) {
      setError(err.code || err.message || 'Error al obtener sesiones activas');
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchActiveSessions();
    fetchTables();
  }, []);

  const handleSelectSession = async (session: TableSessionDTO) => {
    setSelectedSession(session);
    setError(undefined);
    setCompletedPayment(null);
    setBill(null);
    setMethod(null);

    try {
      const res = await ApiClient.request(`/v1/checkout/${session.sessionId}`);
      const billData = res?.data || res;
      setBill(billData);
    } catch (err: any) {
      setError(err.code || err.message || 'Error al obtener la cuenta de la mesa');
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedSession || !bill || !method) return;
    setError(undefined);

    try {
      const res = await ApiClient.request('/v1/checkout/confirm', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: selectedSession.sessionId,
          tableId: selectedSession.tableId,
          method,
        }),
      });

      const paymentResult = res?.data || res;
      setCompletedPayment({
        tableId: selectedSession.tableId,
        amount: paymentResult?.amount || bill.total,
        method,
      });

      setSelectedSession(null);
      setBill(null);
      setMethod(null);
      await fetchActiveSessions();
    } catch (err: any) {
      setError(err.code || err.message || 'Error al procesar cobro');
    }
  };

  const handleRetry = async () => {
    if (selectedSession && !bill) {
      handleSelectSession(selectedSession);
    } else {
      handleConfirmPayment();
    }
  };

  return (
    <FeatureGuard flag="payments">
      <div data-testid="checkout-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {completedPayment && (
          <div style={{ marginBottom: '16px' }}>
            <PaymentSuccessCard
              tableId={completedPayment.tableId}
              amount={completedPayment.amount}
              method={completedPayment.method}
              tables={tables}
            />
          </div>
        )}

        <BentoCard
          style={{
            backgroundColor: 'var(--bento-papel)',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              fontSize: '1.1rem',
              marginTop: 0,
              marginBottom: '16px',
              fontFamily: 'var(--bento-font-heading)',
              color: 'var(--bento-text)',
            }}
          >
            Mesas Activas
          </h2>
          <ActiveTablesGrid
            loading={loadingSessions}
            sessions={sessions}
            tables={tables}
            selectedSessionId={selectedSession?.sessionId}
            onSelectSession={handleSelectSession}
          />
        </BentoCard>

        {bill && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <BillSummaryCard bill={bill} tables={tables} error={error} onRetry={handleRetry} />
            <PaymentMethodPicker selectedMethod={method} onSelect={setMethod} />
            <ConfirmPaymentButton
              disabled={!method}
              total={bill.total}
              method={method}
              onConfirm={handleConfirmPayment}
            />
          </div>
        )}
      </div>
    </FeatureGuard>
  );
}
