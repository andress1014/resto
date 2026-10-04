import React from 'react';
import { BentoCard } from '@packages/ui-components';
import { ServiceCallDTO } from '@packages/shared-types';

export interface ServiceCallPanelProps {
  calls: ServiceCallDTO[];
  onResolve?: (callId: string) => void;
}

export function ServiceCallPanel({ calls, onResolve }: ServiceCallPanelProps) {
  const pendingCalls = calls.filter((c) => c.status === 'pending');

  return (
    <BentoCard className="p-4">
      <div className="pb-3 border-b border-[var(--bento-border)]">
        <h3 className="font-bold text-sm text-[var(--bento-text)]">Llamadas de Servicio</h3>
        <span className="text-xs text-[var(--bento-text-muted)]">{pendingCalls.length} pendientes</span>
      </div>
      {pendingCalls.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No hay llamadas pendientes</p>
      ) : (
        <div className="space-y-3 mt-3">
          {pendingCalls.map((call) => (
            <div
              key={call.callId}
              className="flex items-center justify-between p-3 rounded-lg border bg-card text-card-foreground shadow-sm"
            >
              <div>
                <span className="font-semibold text-base">{call.tableId}</span>
                {call.note && (
                  <p className="text-sm text-muted-foreground mt-0.5">{call.note}</p>
                )}
                <span className="text-xs text-muted-foreground block mt-1">
                  {new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {onResolve && (
                <button
                  type="button"
                  onClick={() => onResolve(call.callId)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                >
                  Resolver
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </BentoCard>
  );
}
