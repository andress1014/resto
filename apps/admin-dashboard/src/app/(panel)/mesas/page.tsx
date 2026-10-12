"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  BentoGrid,
  BentoCard,
  StatusChip,
  TabsPill,
  Skeleton,
  EmptyState,
  ErrorState,
} from '@packages/ui-components';
import { ApiClient } from '../../../lib/api';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface TableItem {
  tableId: string;
  label: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  tenantId?: string;
}

interface TableQrData {
  url: string;
  pngDataUrl: string;
}

interface SessionItem {
  id?: string;
  sessionId?: string;
  tableId: string;
  status: string;
}

export default function TablesPage() {
  const [tables, setTables] = useState<TableItem[]>([]);
  const [occupiedTableIds, setOccupiedTableIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Modal Crear Mesa
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTableLabel, setNewTableLabel] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Modal / Vista de QR
  const [activeTableQr, setActiveTableQr] = useState<TableItem | null>(null);
  const [qrData, setQrData] = useState<TableQrData | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  const createModalRef = useRef<HTMLDivElement>(null);
  const qrModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCreateModal) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    createModalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleCloseCreateModal();
        return;
      }
      if (e.key === 'Tab') {
        if (!createModalRef.current) return;
        const nodes = Array.from(createModalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (nodes.length === 0) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === createModalRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      prevFocus?.focus?.();
    };
  }, [showCreateModal]);

  useEffect(() => {
    if (!activeTableQr) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    qrModalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleCloseQrModal();
        return;
      }
      if (e.key === 'Tab') {
        if (!qrModalRef.current) return;
        const nodes = Array.from(qrModalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (nodes.length === 0) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === qrModalRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      prevFocus?.focus?.();
    };
  }, [activeTableQr]);

  const fetchTablesAndSessions = async () => {
    try {
      setLoading(true);
      setError(null);

      const [tablesRes, sessionsRes] = await Promise.all([
        ApiClient.request('/v1/tables', { method: 'GET' }),
        ApiClient.request('/v1/sessions?status=active', { method: 'GET' }).catch(() => ({ data: [] })),
      ]);

      const rawTables = Array.isArray(tablesRes) ? tablesRes : tablesRes?.data;
      if (Array.isArray(rawTables)) {
        const normalizedTables: TableItem[] = rawTables.map((t: any) => ({
          ...t,
          tableId: t.tableId || t.id,
        }));
        setTables(normalizedTables);
      } else {
        setTables([]);
      }

      const rawSessions = Array.isArray(sessionsRes) ? sessionsRes : sessionsRes?.data;
      if (Array.isArray(rawSessions)) {
        const occupied = new Set<string>();
        rawSessions.forEach((s: any) => {
          if (s.tableId) {
            occupied.add(s.tableId);
          }
        });
        setOccupiedTableIds(occupied);
      } else {
        setOccupiedTableIds(new Set());
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar las mesas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTablesAndSessions();
  }, []);

  const handleOpenCreateModal = () => {
    setNewTableLabel('');
    setCreateError(null);
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setCreateError(null);
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableLabel.trim()) {
      setCreateError('Por favor ingresa un nombre para la mesa');
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);
      await ApiClient.request('/v1/tables', {
        method: 'POST',
        body: JSON.stringify({ label: newTableLabel.trim() }),
      });
      setShowCreateModal(false);
      setNewTableLabel('');
      await fetchTablesAndSessions();
    } catch (err: any) {
      setCreateError(err?.message || 'Error al crear la mesa');
    } finally {
      setCreating(false);
    }
  };

  const handleViewQr = async (table: TableItem) => {
    setActiveTableQr(table);
    setQrData(null);
    setQrError(null);
    setQrLoading(true);

    try {
      const res = await ApiClient.request(`/v1/tables/${table.tableId}/qr`, { method: 'GET' });
      setQrData(res.data || res);
    } catch (err: any) {
      setQrError(err?.message || 'Error al cargar el código QR');
    } finally {
      setQrLoading(false);
    }
  };

  const handleRotateQr = async (table: TableItem) => {
    setQrLoading(true);
    setQrError(null);

    try {
      const res = await ApiClient.request(`/v1/tables/${table.tableId}/qr/rotate`, {
        method: 'POST',
      });
      setQrData(res.data || res);
    } catch (err: any) {
      setQrError(err?.message || 'Error al rotar el código QR');
    } finally {
      setQrLoading(false);
    }
  };

  const handleCloseQrModal = () => {
    setActiveTableQr(null);
    setQrData(null);
    setQrError(null);
  };

  const getTableStatus = (table: TableItem) => {
    const isInactive = table.status !== 'active';
    const isOccupied = occupiedTableIds.has(table.tableId);
    if (isInactive) {
      return {
        label: 'Deshabilitada',
        tone: 'neutral' as const,
        slotStatus: 'deshabilitada',
      };
    }
    if (isOccupied) {
      return {
        label: 'Ocupada',
        tone: 'error' as const,
        slotStatus: 'ocupada',
      };
    }
    return {
      label: 'Disponible',
      tone: 'ok' as const,
      slotStatus: 'libre',
    };
  };

  return (
    <div
      style={{
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
        fontFamily: 'var(--bento-font-body)',
        color: 'var(--bento-text)',
      }}
    >
      {/* Header y Acciones */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1
              style={{
                margin: 0,
                fontSize: '1.75rem',
                fontWeight: 700,
                fontFamily: 'var(--bento-font-heading)',
                color: 'var(--bento-text)',
              }}
            >
              Mesas y Códigos QR
            </h1>
            <Link
              href="/menu"
              style={{
                fontSize: '0.875rem',
                color: 'var(--bento-text)',
                textDecoration: 'none',
                fontWeight: 500,
                border: '1px solid var(--bento-border)',
                padding: '4px 12px',
                borderRadius: 'var(--bento-pill-radius)',
                backgroundColor: 'var(--bento-papel)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              ← Ir a Menú
            </Link>
          </div>
          <p
            style={{
              margin: '4px 0 0 0',
              color: 'var(--bento-text-muted)',
              fontSize: '0.9rem',
            }}
          >
            Control de mesas activas y generación de códigos QR de autoservicio
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {tables.length > 0 && (
            <TabsPill
              tabs={[
                { id: 'list', label: 'Lista', count: tables.length },
                { id: 'map', label: 'Mapa', count: tables.length },
              ]}
              value={viewMode}
              onChange={(id) => setViewMode(id as 'list' | 'map')}
              ariaLabel="Cambiar vista de mesas"
            />
          )}

          <button
            type="button"
            onClick={handleOpenCreateModal}
            style={{
              padding: '10px 18px',
              backgroundColor: 'var(--bento-tinta)',
              color: 'var(--bento-papel)',
              borderRadius: 'var(--bento-pill-radius)',
              border: '1px solid var(--bento-tinta)',
              fontFamily: 'var(--bento-font-body)',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: 'var(--bento-card-shadow)',
              minHeight: '40px',
            }}
          >
            Nueva Mesa
          </button>
        </div>
      </div>

      {/* Error no-bloqueante cuando ya hay mesas */}
      {error && tables.length > 0 && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--bento-papel)',
            color: 'var(--bento-destructive)',
            border: '1px solid var(--bento-destructive)',
            borderRadius: 'var(--bento-inner-radius)',
            marginBottom: '20px',
            fontSize: '0.9rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Estados principales: Loading / Error / Empty / OK */}
      {loading && tables.length === 0 ? (
        <div
          role="status"
          aria-label="Cargando mesas..."
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--bento-grid-gap)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0,0,0,0)',
            }}
          >
            Cargando mesas...
          </span>
          <BentoGrid cols={3}>
            {[1, 2, 3].map((n) => (
              <BentoCard key={n}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
                  <Skeleton height="28px" width="60%" />
                  <Skeleton height="16px" width="40%" />
                  <Skeleton height="40px" width="100%" radius="var(--bento-pill-radius)" />
                </div>
              </BentoCard>
            ))}
          </BentoGrid>
        </div>
      ) : !loading && error && tables.length === 0 ? (
        <ErrorState
          title="Error al cargar las mesas"
          message={error}
          onRetry={fetchTablesAndSessions}
          retryLabel="Reintentar"
        />
      ) : tables.length === 0 ? (
        <EmptyState
          title="No hay mesas registradas"
          description="Agrega tu primera mesa para generar su código QR único de acceso."
          action={
            <button
              type="button"
              onClick={handleOpenCreateModal}
              style={{
                minHeight: '44px',
                padding: '0 20px',
                backgroundColor: 'var(--bento-tinta)',
                color: 'var(--bento-papel)',
                border: '1px solid var(--bento-tinta)',
                borderRadius: 'var(--bento-pill-radius)',
                fontFamily: 'var(--bento-font-body)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Crear primera mesa
            </button>
          }
        />
      ) : viewMode === 'list' ? (
        /* Vista de Lista (BentoGrid) */
        <BentoGrid cols={3}>
          {tables.map((table) => {
            const statusInfo = getTableStatus(table);
            return (
              <BentoCard key={table.tableId}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '8px',
                        gap: '8px',
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '1.25rem',
                          fontWeight: 600,
                          fontFamily: 'var(--bento-font-heading)',
                          color: 'var(--bento-text)',
                        }}
                      >
                        {table.label}
                      </h3>
                      <StatusChip label={statusInfo.label} tone={statusInfo.tone} />
                    </div>

                    <p
                      style={{
                        margin: '0 0 16px 0',
                        fontSize: '0.8rem',
                        color: 'var(--bento-text-muted)',
                      }}
                    >
                      ID: {table.tableId}
                      {table.createdAt && ` • Creada: ${new Date(table.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button
                      type="button"
                      onClick={() => handleViewQr(table)}
                      style={{
                        flex: 1,
                        minHeight: '40px',
                        padding: '8px 12px',
                        backgroundColor: 'var(--bento-papel)',
                        color: 'var(--bento-text)',
                        border: '1px solid var(--bento-border)',
                        borderRadius: 'var(--bento-pill-radius)',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        fontFamily: 'var(--bento-font-body)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      Ver QR
                    </button>
                  </div>
                </div>
              </BentoCard>
            );
          })}
        </BentoGrid>
      ) : (
        /* Vista de Mapa de Mesas (Grid de slots) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Leyenda clara */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              padding: '12px 18px',
              backgroundColor: 'var(--bento-papel)',
              borderRadius: 'var(--bento-inner-radius)',
              border: '1px solid var(--bento-border)',
              flexWrap: 'wrap',
              fontSize: '0.875rem',
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontFamily: 'var(--bento-font-heading)',
                color: 'var(--bento-text)',
              }}
            >
              Leyenda:
            </span>

            {/* Ocupada */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                aria-hidden="true"
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bento-tinta)',
                  display: 'inline-block',
                }}
              />
              <span style={{ color: 'var(--bento-text)' }}>
                <strong>Ocupada</strong> (con sesión activa)
              </span>
            </div>

            {/* Libre */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                aria-hidden="true"
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bento-papel)',
                  border: '1px dashed var(--bento-border)',
                  display: 'inline-block',
                }}
              />
              <span style={{ color: 'var(--bento-text)' }}>
                <strong>Libre</strong> (disponible)
              </span>
            </div>

            {/* Deshabilitada */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                aria-hidden="true"
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bento-hueso)',
                  border: '1px solid var(--bento-border)',
                  display: 'inline-block',
                }}
              />
              <span style={{ color: 'var(--bento-text-muted)' }}>Deshabilitada</span>
            </div>
          </div>

          {/* Grid de slots */}
          <div
            data-testid="tables-map-grid"
            style={{
              display: 'grid',
              gap: 'var(--bento-grid-gap)',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            }}
          >
            {tables.map((table) => {
              const statusInfo = getTableStatus(table);
              const isOccupied = statusInfo.slotStatus === 'ocupada';
              const isFree = statusInfo.slotStatus === 'libre';

              const slotBg = isOccupied
                ? 'var(--bento-tinta)'
                : isFree
                ? 'var(--bento-papel)'
                : 'var(--bento-hueso)';

              const slotFg = isOccupied
                ? 'var(--bento-papel)'
                : isFree
                ? 'var(--bento-text)'
                : 'var(--bento-text-muted)';

              const slotBorder = isOccupied
                ? '1px solid var(--bento-tinta)'
                : isFree
                ? '1px dashed var(--bento-border)'
                : '1px solid var(--bento-border)';

              return (
                <div
                  key={table.tableId}
                  data-testid={`slot-${table.tableId}`}
                  data-slot-status={statusInfo.slotStatus}
                  style={{
                    backgroundColor: slotBg,
                    color: slotFg,
                    border: slotBorder,
                    borderRadius: 'var(--bento-inner-radius)',
                    padding: '16px',
                    minHeight: '140px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: isOccupied ? 'var(--bento-card-shadow)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '6px',
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '1.2rem',
                          fontWeight: 700,
                          fontFamily: 'var(--bento-font-heading)',
                          color: slotFg,
                        }}
                      >
                        {table.label}
                      </h3>
                      <StatusChip label={statusInfo.label} tone={statusInfo.tone} />
                    </div>

                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.75rem',
                        color: isOccupied ? 'var(--bento-border)' : 'var(--bento-text-muted)',
                      }}
                    >
                      ID: {table.tableId}
                    </p>
                  </div>

                  <div style={{ marginTop: '14px' }}>
                    <button
                      type="button"
                      onClick={() => handleViewQr(table)}
                      style={{
                        width: '100%',
                        minHeight: '36px',
                        padding: '6px 12px',
                        backgroundColor: isOccupied ? 'transparent' : 'var(--bento-hueso)',
                        color: slotFg,
                        border: isOccupied ? '1px solid var(--bento-border)' : '1px solid var(--bento-border)',
                        borderRadius: 'var(--bento-pill-radius)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        fontFamily: 'var(--bento-font-body)',
                        cursor: 'pointer',
                      }}
                    >
                      Ver QR
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Crear Mesa */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-table-title"
          ref={createModalRef}
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              handleCloseCreateModal();
              return;
            }
            if (e.key === 'Tab') {
              if (!createModalRef.current) return;
              const nodes = Array.from(createModalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
              if (nodes.length === 0) {
                e.preventDefault();
                return;
              }
              const first = nodes[0];
              const last = nodes[nodes.length - 1];
              const active = document.activeElement;
              if (e.shiftKey && (active === first || active === createModalRef.current)) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseCreateModal();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'color-mix(in srgb, var(--bento-tinta) 45%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bento-papel)',
              color: 'var(--bento-text)',
              padding: '24px',
              borderRadius: 'var(--bento-card-radius)',
              width: '100%',
              maxWidth: '420px',
              boxShadow: 'var(--bento-card-shadow)',
              border: '1px solid var(--bento-border)',
            }}
          >
            <h2
              id="create-table-title"
              style={{
                margin: '0 0 16px 0',
                fontSize: '1.25rem',
                fontWeight: 700,
                fontFamily: 'var(--bento-font-heading)',
                color: 'var(--bento-text)',
              }}
            >
              Nueva Mesa
            </h2>

            {createError && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--bento-papel)',
                  color: 'var(--bento-destructive)',
                  border: '1px solid var(--bento-destructive)',
                  borderRadius: 'var(--bento-inner-radius)',
                  marginBottom: '16px',
                  fontSize: '0.875rem',
                }}
              >
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateTable}>
              <div style={{ marginBottom: '20px' }}>
                <label
                  htmlFor="table-label-input"
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--bento-text)',
                  }}
                >
                  Nombre o Identificador
                </label>
                <input
                  id="table-label-input"
                  type="text"
                  placeholder="Ej: Mesa 1, Barra 2, Terraza B"
                  value={newTableLabel}
                  onChange={(e) => setNewTableLabel(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--bento-inner-radius)',
                    border: '1px solid var(--bento-border)',
                    backgroundColor: 'var(--bento-papel)',
                    color: 'var(--bento-text)',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                    fontFamily: 'var(--bento-font-body)',
                  }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  style={{
                    minHeight: '44px',
                    padding: '0 18px',
                    backgroundColor: 'transparent',
                    color: 'var(--bento-text)',
                    border: '1px solid var(--bento-border)',
                    borderRadius: 'var(--bento-pill-radius)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontFamily: 'var(--bento-font-body)',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    minHeight: '44px',
                    padding: '0 20px',
                    backgroundColor: 'var(--bento-tinta)',
                    color: 'var(--bento-papel)',
                    border: '1px solid var(--bento-tinta)',
                    borderRadius: 'var(--bento-pill-radius)',
                    cursor: creating ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontFamily: 'var(--bento-font-body)',
                  }}
                >
                  {creating ? 'Guardando...' : 'Guardar Mesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ver / Rotar QR con diseño del Kit */}
      {activeTableQr && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
          ref={qrModalRef}
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              handleCloseQrModal();
              return;
            }
            if (e.key === 'Tab') {
              if (!qrModalRef.current) return;
              const nodes = Array.from(qrModalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
              if (nodes.length === 0) {
                e.preventDefault();
                return;
              }
              const first = nodes[0];
              const last = nodes[nodes.length - 1];
              const active = document.activeElement;
              if (e.shiftKey && (active === first || active === qrModalRef.current)) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseQrModal();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'color-mix(in srgb, var(--bento-tinta) 45%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bento-papel)',
              color: 'var(--bento-text)',
              padding: '24px',
              borderRadius: 'var(--bento-card-radius)',
              width: '100%',
              maxWidth: '460px',
              boxShadow: 'var(--bento-card-shadow)',
              border: '1px solid var(--bento-border)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h2
                id="qr-modal-title"
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  fontFamily: 'var(--bento-font-heading)',
                  color: 'var(--bento-text)',
                }}
              >
                Código QR — {activeTableQr.label}
              </h2>
              <button
                type="button"
                onClick={handleCloseQrModal}
                aria-label="Cerrar modal"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: 'var(--bento-text-muted)',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {qrError && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--bento-papel)',
                  color: 'var(--bento-destructive)',
                  border: '1px solid var(--bento-destructive)',
                  borderRadius: 'var(--bento-inner-radius)',
                  marginBottom: '16px',
                  fontSize: '0.875rem',
                  textAlign: 'left',
                }}
              >
                {qrError}
              </div>
            )}

            {qrLoading && !qrData ? (
              <div style={{ padding: '40px', color: 'var(--bento-text-muted)' }}>
                Cargando código QR...
              </div>
            ) : qrData ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--bento-papel)',
                    borderRadius: 'var(--bento-inner-radius)',
                    border: '1px solid var(--bento-border)',
                    marginBottom: '16px',
                    display: 'inline-block',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrData.pngDataUrl}
                    alt={`QR ${activeTableQr.label}`}
                    style={{ width: '220px', height: '220px', display: 'block', borderRadius: '8px' }}
                  />
                </div>

                <div
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bento-hueso)',
                    padding: '10px 14px',
                    borderRadius: 'var(--bento-inner-radius)',
                    border: '1px solid var(--bento-border)',
                    marginBottom: '20px',
                    wordBreak: 'break-all',
                    fontSize: '0.8rem',
                    color: 'var(--bento-text)',
                    textAlign: 'left',
                    boxSizing: 'border-box',
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      display: 'block',
                      marginBottom: '2px',
                      color: 'var(--bento-text)',
                    }}
                  >
                    Enlace de Mesa:
                  </span>
                  {qrData.url}
                </div>

                <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                  <button
                    type="button"
                    onClick={() => handleRotateQr(activeTableQr)}
                    disabled={qrLoading}
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      padding: '10px 16px',
                      backgroundColor: 'var(--bento-tinta)',
                      color: 'var(--bento-papel)',
                      border: '1px solid var(--bento-tinta)',
                      borderRadius: 'var(--bento-pill-radius)',
                      cursor: qrLoading ? 'not-allowed' : 'pointer',
                      fontWeight: 700,
                      fontFamily: 'var(--bento-font-body)',
                    }}
                  >
                    {qrLoading ? 'Rotando...' : 'Rotar QR'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseQrModal}
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      padding: '10px 16px',
                      backgroundColor: 'transparent',
                      color: 'var(--bento-text)',
                      border: '1px solid var(--bento-border)',
                      borderRadius: 'var(--bento-pill-radius)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontFamily: 'var(--bento-font-body)',
                    }}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
