"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BentoGrid,
  BentoCard,
  Skeleton,
  EmptyState,
  ErrorState,
  Toast,
} from '@packages/ui-components';
import { ApiClient } from '../../../lib/api';
import { ProductCard } from '../../../components/ProductCard';
import { CategoryCard } from '../../../components/CategoryCard';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Category {
  id: string;
  name: string;
  sortOrder?: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  isAvailable?: boolean;
}

export default function MenuPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [toastMessage, setToastMessage] = useState('Nuevo Producto Creado');

  // Modales
  const [showModal, setShowModal] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdAvailable, setNewProdAvailable] = useState(true);

  const [showCatModal, setShowCatModal] = useState(false);
  const [catModalError, setCatModalError] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSortOrder, setNewCatSortOrder] = useState('0');

  const prodModalRef = useRef<HTMLDivElement>(null);
  const catModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showModal) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    prodModalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowModal(false);
        return;
      }
      if (e.key === 'Tab') {
        if (!prodModalRef.current) return;
        const nodes = Array.from(prodModalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (nodes.length === 0) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === prodModalRef.current)) {
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
  }, [showModal]);

  useEffect(() => {
    if (!showCatModal) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    catModalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowCatModal(false);
        return;
      }
      if (e.key === 'Tab') {
        if (!catModalRef.current) return;
        const nodes = Array.from(catModalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (nodes.length === 0) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === catModalRef.current)) {
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
  }, [showCatModal]);

  const fetchMenuData = async () => {
    try {
      const res = await ApiClient.request('/v1/graphql', {
        method: 'POST',
        body: JSON.stringify({
          query: `
            query AdminMenu {
              categories { id name }
              products { id name price isAvailable category { id } }
            }
          `,
        }),
      });

      if (res?.data?.errors && res.data.errors.length > 0) {
        throw new Error(res.data.errors[0].message || 'Error en consulta GraphQL');
      }

      if (res?.data?.data) {
        const fetchedCats: Category[] = res.data.data.categories || [];
        const rawProds: any[] = res.data.data.products || [];
        const mappedProds: Product[] = rawProds.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          isAvailable: p.isAvailable,
          categoryId: p.categoryId ?? p.category?.id,
        }));

        setCategories(fetchedCats);
        setProducts(mappedProds);
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar el menú');
      setCategories([]);
      setProducts([]);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    if (!ApiClient.token) {
      if (typeof window !== 'undefined' && window.location) {
        window.history.pushState({}, '', '/login');
      }
      router.push('/login');
      return;
    }

    fetchMenuData();
  }, [router]);

  const handleOpenCatModal = () => {
    setShowCatModal(true);
    setCatModalError(null);
    setNewCatName('');
    setNewCatSortOrder('0');
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setCatModalError(null);

    const sortOrderNum = parseInt(newCatSortOrder, 10) || 0;

    try {
      const res = await ApiClient.request('/v1/graphql', {
        method: 'POST',
        body: JSON.stringify({
          query: `
            mutation CreateCategory($input: CreateCategoryInput!) {
              createCategory(input: $input) {
                id
                name
              }
            }
          `,
          variables: {
            input: {
              name: newCatName,
              sortOrder: sortOrderNum,
            },
          },
        }),
      });

      if (res?.data?.errors && res.data.errors.length > 0) {
        throw new Error(res.data.errors[0].message || 'Error al crear categoría');
      }

      setToastMessage('Nueva Categoría Creada');
      setCreated(true);
      setShowCatModal(false);
      setNewCatName('');
      setNewCatSortOrder('0');
      await fetchMenuData();
    } catch (err: any) {
      setCreated(false);
      setCatModalError(err.message || 'Error al crear categoría');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenModal = () => {
    setShowModal(true);
    setToastMessage('Nuevo Producto Creado');
    setCreated(true);
    setModalError(null);
    setNewProdCategory(categories[0]?.id || '');
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);

    const priceNum = parseFloat(newProdPrice) || 0;
    const catId = newProdCategory || categories[0]?.id || '';

    try {
      const res = await ApiClient.request('/v1/graphql', {
        method: 'POST',
        body: JSON.stringify({
          query: `
            mutation CreateProduct($input: CreateProductInput!) {
              createProduct(input: $input) {
                id
                name
                price
                isAvailable
                category {
                  id
                }
              }
            }
          `,
          variables: {
            input: {
              name: newProdName,
              price: priceNum,
              categoryId: catId,
            },
          },
        }),
      });

      if (res?.data?.errors && res.data.errors.length > 0) {
        throw new Error(res.data.errors[0].message || 'Error al crear producto');
      }

      const createdProduct = res?.data?.data?.createProduct;
      if (createdProduct) {
        const mappedNewProd: Product = {
          id: createdProduct.id,
          name: createdProduct.name,
          price: createdProduct.price,
          isAvailable: createdProduct.isAvailable,
          categoryId: createdProduct.categoryId ?? createdProduct.category?.id,
        };
        setProducts((prev) => [...prev, mappedNewProd]);
      }

      setToastMessage('Nuevo Producto Creado');
      setCreated(true);
      setShowModal(false);
      setNewProdName('');
      setNewProdPrice('');
      await fetchMenuData();
    } catch (err: any) {
      setCreated(false);
      setModalError(err.message || 'Error al crear producto');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAvailability = async (productId: string, isAvailable: boolean) => {
    // Actualización optimista
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, isAvailable } : p))
    );

    try {
      const res = await ApiClient.request('/v1/graphql', {
        method: 'POST',
        body: JSON.stringify({
          query: `
            mutation SetAvailability($id: ID!, $isAvailable: Boolean!) {
              setProductAvailability(id: $id, isAvailable: $isAvailable) {
                id
                isAvailable
              }
            }
          `,
          variables: {
            id: productId,
            isAvailable,
          },
        }),
      });

      if (res?.data?.errors && res.data.errors.length > 0) {
        throw new Error(res.data.errors[0].message || 'Error al actualizar disponibilidad');
      }
    } catch (err: any) {
      // Revertir ante error
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, isAvailable: !isAvailable } : p))
      );
      setError(err.message || 'Error al actualizar disponibilidad');
    }
  };

  const primaryBtnStyle: React.CSSProperties = {
    padding: '10px 18px',
    backgroundColor: 'var(--bento-tinta)',
    color: 'var(--bento-papel)',
    borderRadius: 'var(--bento-pill-radius)',
    border: '1px solid var(--bento-tinta)',
    fontFamily: 'var(--bento-font-body)',
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '44px',
    textDecoration: 'none',
  };

  const secondaryBtnStyle: React.CSSProperties = {
    padding: '10px 18px',
    backgroundColor: 'var(--bento-papel)',
    color: 'var(--bento-text)',
    borderRadius: 'var(--bento-pill-radius)',
    border: '1px solid var(--bento-border)',
    fontFamily: 'var(--bento-font-body)',
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '44px',
    textDecoration: 'none',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 14px',
    borderRadius: 'var(--bento-inner-radius)',
    border: '1px solid var(--bento-border)',
    backgroundColor: 'var(--bento-card-bg)',
    color: 'var(--bento-text)',
    fontFamily: 'var(--bento-font-body)',
    fontSize: '0.9rem',
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'var(--bento-font-body)' }}>
      {/* Barra de título y acciones */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '1.75rem',
              fontWeight: 700,
              fontFamily: 'var(--bento-font-heading)',
              color: 'var(--bento-text)',
            }}
          >
            Carta y Menú
          </h1>
          <p
            style={{
              margin: '4px 0 0 0',
              color: 'var(--bento-text-muted)',
              fontSize: '0.9rem',
            }}
          >
            Gestión de categorías y platos del restaurante
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/mesas" style={secondaryBtnStyle}>
            Gestión de Mesas
          </Link>
          <button
            type="button"
            onClick={handleOpenCatModal}
            style={secondaryBtnStyle}
          >
            Nueva Categoría
          </button>
          <button
            type="button"
            onClick={handleOpenModal}
            disabled={categories.length === 0}
            style={{
              ...primaryBtnStyle,
              opacity: categories.length === 0 ? 0.5 : 1,
              cursor: categories.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Alerta de error global */}
      {error && (
        <div style={{ marginBottom: '24px' }}>
          <ErrorState
            title="Error al cargar el menú"
            message={error}
            onRetry={fetchMenuData}
            retryLabel="Reintentar"
          />
        </div>
      )}

      {/* Notificación Toast de éxito */}
      {created && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 1100,
          }}
        >
          <Toast
            message={toastMessage}
            onDismiss={() => setCreated(false)}
            duration={4000}
          />
        </div>
      )}

      {/* Modal Crear Producto */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-prod-title"
          ref={prodModalRef}
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setShowModal(false);
              return;
            }
            if (e.key === 'Tab') {
              if (!prodModalRef.current) return;
              const nodes = Array.from(prodModalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
              if (nodes.length === 0) {
                e.preventDefault();
                return;
              }
              const first = nodes[0];
              const last = nodes[nodes.length - 1];
              const active = document.activeElement;
              if (e.shiftKey && (active === first || active === prodModalRef.current)) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'color-mix(in srgb, var(--bento-hueso) 70%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'var(--bento-papel)',
              borderRadius: 'var(--bento-card-radius)',
              border: '1px solid var(--bento-border)',
              boxShadow: 'var(--bento-card-shadow)',
              padding: '24px',
            }}
          >
            <h2
              id="modal-prod-title"
              style={{
                margin: '0 0 16px 0',
                fontSize: '1.25rem',
                fontWeight: 700,
                fontFamily: 'var(--bento-font-heading)',
                color: 'var(--bento-text)',
              }}
            >
              Crear Nuevo Producto
            </h2>

            {modalError && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  marginBottom: '16px',
                  borderRadius: 'var(--bento-inner-radius)',
                  border: '1px solid var(--bento-destructive)',
                  backgroundColor: 'var(--bento-papel)',
                  color: 'var(--bento-destructive)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="prod-name"
                  style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--bento-text)' }}
                >
                  Nombre del Producto
                </label>
                <input
                  id="prod-name"
                  type="text"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="Ej. Pizza Margarita"
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="prod-price"
                  style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--bento-text)' }}
                >
                  Precio
                </label>
                <input
                  id="prod-price"
                  type="number"
                  step="any"
                  value={newProdPrice}
                  onChange={(e) => setNewProdPrice(e.target.value)}
                  placeholder="1200"
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="prod-category"
                  style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--bento-text)' }}
                >
                  Categoría
                </label>
                <select
                  id="prod-category"
                  value={newProdCategory}
                  onChange={(e) => setNewProdCategory(e.target.value)}
                  style={{
                    ...inputStyle,
                    cursor: 'pointer',
                  }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                <input
                  id="prod-available"
                  type="checkbox"
                  checked={newProdAvailable}
                  onChange={(e) => setNewProdAvailable(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label
                  htmlFor="prod-available"
                  style={{ fontSize: '0.85rem', color: 'var(--bento-text)', cursor: 'pointer' }}
                >
                  Disponible para ordenar
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={secondaryBtnStyle}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    ...primaryBtnStyle,
                    opacity: submitting ? 0.6 : 1,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Guardando...' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear Categoría */}
      {showCatModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-cat-title"
          ref={catModalRef}
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setShowCatModal(false);
              return;
            }
            if (e.key === 'Tab') {
              if (!catModalRef.current) return;
              const nodes = Array.from(catModalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
              if (nodes.length === 0) {
                e.preventDefault();
                return;
              }
              const first = nodes[0];
              const last = nodes[nodes.length - 1];
              const active = document.activeElement;
              if (e.shiftKey && (active === first || active === catModalRef.current)) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'color-mix(in srgb, var(--bento-hueso) 70%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCatModal(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--bento-papel)',
              borderRadius: 'var(--bento-card-radius)',
              border: '1px solid var(--bento-border)',
              boxShadow: 'var(--bento-card-shadow)',
              padding: '24px',
            }}
          >
            <h2
              id="modal-cat-title"
              style={{
                margin: '0 0 16px 0',
                fontSize: '1.25rem',
                fontWeight: 700,
                fontFamily: 'var(--bento-font-heading)',
                color: 'var(--bento-text)',
              }}
            >
              Crear Nueva Categoría
            </h2>

            {catModalError && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  marginBottom: '16px',
                  borderRadius: 'var(--bento-inner-radius)',
                  border: '1px solid var(--bento-destructive)',
                  backgroundColor: 'var(--bento-papel)',
                  color: 'var(--bento-destructive)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                {catModalError}
              </div>
            )}

            <form onSubmit={handleSaveCategory} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="cat-name-input"
                  style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--bento-text)' }}
                >
                  Nombre de la categoría
                </label>
                <input
                  id="cat-name-input"
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required
                  placeholder="Ej. Bebidas, Postres"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="cat-sort-input"
                  style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--bento-text)' }}
                >
                  Orden (sortOrder)
                </label>
                <input
                  id="cat-sort-input"
                  type="number"
                  value={newCatSortOrder}
                  onChange={(e) => setNewCatSortOrder(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowCatModal(false)}
                  style={secondaryBtnStyle}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    ...primaryBtnStyle,
                    opacity: submitting ? 0.6 : 1,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Guardando...' : 'Guardar Categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Estado de carga inicial con Skeleton */}
      {initialLoading ? (
        <div data-testid="menu-loading-skeleton" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div>
            <Skeleton width="180px" height="24px" style={{ marginBottom: '16px' }} />
            <BentoGrid>
              {[1, 2, 3, 4].map((i) => (
                <BentoCard key={i}>
                  <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Skeleton width="60%" height="20px" />
                    <Skeleton width="40%" height="16px" />
                  </div>
                </BentoCard>
              ))}
            </BentoGrid>
          </div>
          <div>
            <Skeleton width="200px" height="24px" style={{ marginBottom: '16px' }} />
            <BentoGrid>
              {[1, 2, 3, 4].map((i) => (
                <BentoCard key={i}>
                  <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <Skeleton width="100%" height="120px" />
                    <Skeleton width="70%" height="20px" />
                    <Skeleton width="40%" height="24px" />
                  </div>
                </BentoCard>
              ))}
            </BentoGrid>
          </div>
        </div>
      ) : (
        <>
          {/* Sección de Categorías */}
          <section aria-labelledby="section-categories-title">
            <h2
              id="section-categories-title"
              style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                fontFamily: 'var(--bento-font-heading)',
                marginBottom: '16px',
                color: 'var(--bento-text)',
              }}
            >
              Categorías
            </h2>

            {categories.length === 0 ? (
              <EmptyState
                title="No hay categorías registradas"
                description="Crea tu primera categoría para comenzar a agregar productos a la carta."
                action={
                  <button
                    type="button"
                    onClick={handleOpenCatModal}
                    style={primaryBtnStyle}
                  >
                    Crear Categoría
                  </button>
                }
              />
            ) : (
              <BentoGrid>
                {categories.map((cat) => (
                  <CategoryCard
                    key={cat.id}
                    category={cat}
                    productCount={products.filter((p) => p.categoryId === cat.id).length}
                  />
                ))}
              </BentoGrid>
            )}
          </section>

          {/* Sección de Platos Registrados */}
          {categories.length > 0 && (
            <section aria-labelledby="section-products-title" style={{ marginTop: '36px' }}>
              <h2
                id="section-products-title"
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  fontFamily: 'var(--bento-font-heading)',
                  marginBottom: '16px',
                  color: 'var(--bento-text)',
                }}
              >
                Platos Registrados
              </h2>

              {products.length === 0 ? (
                <EmptyState
                  title="No hay platos registrados"
                  description="Comienza a registrar platos para tus categorías."
                  action={
                    <button
                      type="button"
                      onClick={handleOpenModal}
                      style={primaryBtnStyle}
                    >
                      Agregar Plato
                    </button>
                  }
                />
              ) : (
                <BentoGrid>
                  {products.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={{
                        id: p.id,
                        name: p.name,
                        price: p.price,
                        categoryId: p.categoryId,
                        isAvailable: p.isAvailable !== false,
                      }}
                      onAvailabilityChange={(isAvail) => handleToggleAvailability(p.id, isAvail)}
                    />
                  ))}
                </BentoGrid>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
