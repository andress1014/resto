"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BentoGrid, BentoCard } from '@packages/ui-components';
import { ApiClient } from '../../../lib/api';

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
  id: string;
  tableId: string;
  status: string;
}

export default function TablesPage() {
  const [tables, setTables] = useState<TableItem[]>([]);
  const [occupiedTableIds, setOccupiedTableIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const fetchTablesAndSessions = async () => {
    try {
      setLoading(true);
      setError(null);

      const [tablesRes, sessionsRes] = await Promise.all([
        ApiClient.request('/v1/tables', { method: 'GET' }),
        ApiClient.request('/v1/sessions?status=active', { method: 'GET' }).catch(() => ({ data: [] })),
      ]);

      if (Array.isArray(tablesRes.data)) {
        // Normalizar cada mesa asegurando tableId
        const normalizedTables: TableItem[] = tablesRes.data.map((t: any) => ({
          ...t,
          tableId: t.tableId || t.id,
        }));
        setTables(normalizedTables);
      } else {
        setTables([]);
      }

      if (Array.isArray(sessionsRes.data)) {
        const occupied = new Set<string>();
        sessionsRes.data.forEach((s: SessionItem) => {
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
      setQrData(res.data);
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
      setQrData(res.data);
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

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: 'var(--bento-text, #1E293B)' }}>
              Mesas y Códigos QR
            </h1>
            <Link
              href="/menu"
              style={{
                fontSize: '0.875rem',
                color: '#2563eb',
                textDecoration: 'none',
                fontWeight: 500,
                border: '1px solid #dbeafe',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: '#eff6ff',
              }}
            >
              ← Ir a Menú
            </Link>
          </div>
          <p style={{ margin: '4px 0 0 0', color: 'var(--bento-text-muted, #64748B)', fontSize: '0.9rem' }}>
            Control de mesas activas y generación de códigos QR de autoservicio
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleOpenCreateModal}
            style={{
              padding: '10px 18px',
              backgroundColor: '#2563eb',
              color: '#fff',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            Nueva Mesa
          </button>
        </div>
      </div>

      {/* Error general */}
      {error && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '0.9rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Grid de Mesas */}
      {loading && tables.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          Cargando mesas...
        </div>
      ) : tables.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px',
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '1px dashed #d1d5db',
            color: '#6b7280',
          }}
        >
          <p style={{ fontSize: '1.1rem', fontWeight: 500, margin: '0 0 8px 0' }}>No hay mesas registradas</p>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem' }}>
            Agrega tu primera mesa para generar su código QR único de acceso.
          </p>
          <button
            onClick={handleOpenCreateModal}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2563eb',
              color: '#fff',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Crear primera mesa
          </button>
        </div>
      ) : (
        <BentoGrid cols={3}>
          {tables.map((table) => {
            // Semántica definida por Kimi:
            // (a) Si table.status !== 'active' -> Deshabilitada
            // (b) Si la mesa tiene sesión activa en occupiedTableIds -> Ocupada
            // (c) Si no -> Disponible
            let badgeText = 'Disponible';
            let badgeBg = '#ecfdf5';
            let badgeColor = '#059669';

            if (table.status !== 'active') {
              badgeText = 'Deshabilitada';
              badgeBg = '#f3f4f6';
              badgeColor = '#6b7280';
            } else if (occupiedTableIds.has(table.tableId)) {
              badgeText = 'Ocupada';
              badgeBg = '#fef2f2';
              badgeColor = '#dc2626';
            }

            return (
              <BentoCard key={table.tableId}>
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>
                        {table.label}
                      </h3>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '3px 8px',
                          borderRadius: '9999px',
                          fontWeight: 600,
                          backgroundColor: badgeBg,
                          color: badgeColor,
                        }}
                      >
                        {badgeText}
                      </span>
                    </div>

                    <p style={{ margin: '0 0 16px 0', fontSize: '0.8rem', color: '#9ca3af' }}>
                      ID: {table.tableId}
                      {table.createdAt && ` • Creada: ${new Date(table.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button
                      onClick={() => handleViewQr(table)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        cursor: 'pointer',
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
      )}

      {/* Modal Crear Mesa */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '24px',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>
              Nueva Mesa
            </h2>

            {createError && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  borderRadius: '6px',
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
                  style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}
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
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                  }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#fff',
                    color: '#4b5563',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: creating ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {creating ? 'Guardando...' : 'Guardar Mesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ver / Rotar QR */}
      {activeTableQr && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '24px',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '460px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>
                Código QR — {activeTableQr.label}
              </h2>
              <button
                onClick={handleCloseQrModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: '#6b7280',
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
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  fontSize: '0.875rem',
                  textAlign: 'left',
                }}
              >
                {qrError}
              </div>
            )}

            {qrLoading && !qrData ? (
              <div style={{ padding: '40px', color: '#6b7280' }}>Cargando código QR...</div>
            ) : qrData ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    marginBottom: '16px',
                    display: 'inline-block',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrData.pngDataUrl}
                    alt={`QR ${activeTableQr.label}`}
                    style={{ width: '220px', height: '220px', display: 'block' }}
                  />
                </div>

                <div
                  style={{
                    width: '100%',
                    backgroundColor: '#f9fafb',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    marginBottom: '20px',
                    wordBreak: 'break-all',
                    fontSize: '0.8rem',
                    color: '#4b5563',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '2px', color: '#374151' }}>
                    Enlace de Mesa:
                  </span>
                  {qrData.url}
                </div>

                <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                  <button
                    onClick={() => handleRotateQr(activeTableQr)}
                    disabled={qrLoading}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      backgroundColor: '#f59e0b',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: qrLoading ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {qrLoading ? 'Rotando...' : 'Rotar QR'}
                  </button>
                  <button
                    onClick={handleCloseQrModal}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      backgroundColor: '#e5e7eb',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 500,
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
