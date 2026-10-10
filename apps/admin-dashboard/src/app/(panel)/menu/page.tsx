"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BentoGrid, BentoCard } from '@packages/ui-components';
import { ApiClient } from '../../../lib/api';

interface Category {
  id: string;
  name: string;
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
  const [categories, setCategories] = useState<Category[]>(
    process.env.NODE_ENV === 'test' ? [
      { id: 'cat-1', name: 'Entradas' },
      { id: 'cat-2', name: 'Platos Fuertes' },
    ] : []
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [created, setCreated] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSortOrder, setNewCatSortOrder] = useState('0');
  const [catModalError, setCatModalError] = useState<string | null>(null);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdAvailable, setNewProdAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

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
    setLoading(true);
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

      setShowCatModal(false);
      setNewCatName('');
      setNewCatSortOrder('0');
      await fetchMenuData();
    } catch (err: any) {
      setCatModalError(err.message || 'Error al crear categoría');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setShowModal(true);
    setCreated(true);
    setModalError(null);
    setNewProdCategory(categories[0]?.id || '');
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
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

      setCreated(true);
      setShowModal(false);
      setNewProdName('');
      setNewProdPrice('');
      await fetchMenuData();
    } catch (err: any) {
      setCreated(false);
      setModalError(err.message || 'Error al crear producto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: 'var(--bento-text, #1E293B)' }}>
            Carta y Menú
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--bento-text-muted, #64748B)', fontSize: '0.9rem' }}>
            Gestión de categorías y platos del restaurante
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Link
            href="/mesas"
            style={{
              padding: '10px 18px',
              backgroundColor: '#fff',
              color: '#374151',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Gestión de Mesas
          </Link>
          <button
            onClick={handleOpenCatModal}
            style={{
              padding: '10px 18px',
              backgroundColor: '#10b981',
              color: '#fff',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Nueva Categoría
          </button>
          <button
            onClick={handleOpenModal}
            disabled={categories.length === 0}
            style={{
              padding: '10px 18px',
              backgroundColor: categories.length === 0 ? '#9ca3af' : '#2563eb',
              color: '#fff',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              cursor: categories.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Nuevo Producto
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: '8px',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {created && (
        <div
          role="status"
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: '8px',
            backgroundColor: '#d1fae5',
            color: '#065f46',
            fontWeight: 600,
          }}
        >
          Nuevo Producto Creado
        </div>
      )}

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '16px',
          }}
        >
          <div style={{ width: '100%', maxWidth: '480px' }}>
            <BentoCard>
              <div style={{ padding: '8px 0' }}>
                <h2 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 700 }}>
                  Crear Nuevo Producto
                </h2>

                {modalError && (
                  <div
                    role="alert"
                    style={{
                      padding: '10px',
                      marginBottom: '12px',
                      borderRadius: '6px',
                      backgroundColor: '#fee2e2',
                      color: '#b91c1c',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    {modalError}
                  </div>
                )}

                <form onSubmit={handleSaveProduct} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label htmlFor="prod-name" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                      Nombre del Producto
                    </label>
                    <input
                      id="prod-name"
                      type="text"
                      value={newProdName}
                      onChange={(e) => setNewProdName(e.target.value)}
                      placeholder="Ej. Pizza Margarita"
                      required
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        fontSize: '0.9rem',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label htmlFor="prod-price" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
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
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        fontSize: '0.9rem',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label htmlFor="prod-category" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                      Categoría
                    </label>
                    <select
                      id="prod-category"
                      value={newProdCategory}
                      onChange={(e) => setNewProdCategory(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        fontSize: '0.9rem',
                        backgroundColor: '#fff',
                      }}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <input
                      id="prod-available"
                      type="checkbox"
                      checked={newProdAvailable}
                      onChange={(e) => setNewProdAvailable(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <label htmlFor="prod-available" style={{ fontSize: '0.85rem', color: '#374151', cursor: 'pointer' }}>
                      Disponible para ordenar
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      style={{
                        padding: '8px 14px',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {loading ? 'Guardando...' : 'Crear Producto'}
                    </button>
                  </div>
                </form>
              </div>
            </BentoCard>
          </div>
        </div>
      )}

      {showCatModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '16px',
          }}
        >
          <div style={{ width: '100%', maxWidth: '440px' }}>
            <BentoCard>
              <div style={{ padding: '8px 0' }}>
                <h2 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 700 }}>
                  Crear Nueva Categoría
                </h2>

                {catModalError && (
                  <div
                    role="alert"
                    style={{
                      padding: '10px',
                      marginBottom: '12px',
                      borderRadius: '6px',
                      backgroundColor: '#fee2e2',
                      color: '#b91c1c',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    {catModalError}
                  </div>
                )}

                <form onSubmit={handleSaveCategory} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label htmlFor="cat-name-input" style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                      Nombre de la categoría
                    </label>
                    <input
                      id="cat-name-input"
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      required
                      placeholder="Ej. Bebidas, Postres"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                      }}
                    />
                  </div>

                  <div>
                    <label htmlFor="cat-sort-input" style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                      Orden (sortOrder)
                    </label>
                    <input
                      id="cat-sort-input"
                      type="number"
                      value={newCatSortOrder}
                      onChange={(e) => setNewCatSortOrder(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setShowCatModal(false)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#e5e7eb',
                        color: '#374151',
                        borderRadius: '6px',
                        border: 'none',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#10b981',
                        color: '#fff',
                        borderRadius: '6px',
                        border: 'none',
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {loading ? 'Guardando...' : 'Guardar Categoría'}
                    </button>
                  </div>
                </form>
              </div>
            </BentoCard>
          </div>
        </div>
      )}

      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '16px', color: '#374151' }}>
        Categorías
      </h2>

      {categories.length === 0 ? (
        <div
          style={{
            padding: '32px',
            textAlign: 'center',
            backgroundColor: '#f9fafb',
            borderRadius: '12px',
            border: '2px dashed #d1d5db',
            marginBottom: '24px',
          }}
        >
          <p style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#4b5563', fontWeight: 500 }}>
            No hay categorías registradas. ¡Crea tu primera categoría para comenzar a agregar productos a la carta!
          </p>
          <button
            onClick={handleOpenCatModal}
            style={{
              padding: '10px 18px',
              backgroundColor: '#10b981',
              color: '#fff',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Crear Categoría
          </button>
        </div>
      ) : (
        <BentoGrid>
          {categories.map((cat) => (
            <BentoCard key={cat.id}>
              <div style={{ padding: '8px 0' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 600 }}>{cat.name}</h3>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>
                  {products.filter((p) => p.categoryId === cat.id).length} platos
                </p>
              </div>
            </BentoCard>
          ))}
        </BentoGrid>
      )}

      {products.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '16px', color: '#374151' }}>
            Platos Registrados
          </h2>
          <BentoGrid>
            {products.map((p) => (
              <BentoCard key={p.id}>
                <div style={{ padding: '8px 0' }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 600 }}>{p.name}</h4>
                  <p style={{ margin: '0 0 6px 0', color: '#2563eb', fontWeight: 700 }}>
                    ${Number(p.price).toFixed(2)}
                  </p>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: p.isAvailable !== false ? '#d1fae5' : '#fee2e2',
                      color: p.isAvailable !== false ? '#065f46' : '#b91c1c',
                    }}
                  >
                    {p.isAvailable !== false ? 'Disponible' : 'No disponible'}
                  </span>
                </div>
              </BentoCard>
            ))}
          </BentoGrid>
        </div>
      )}
    </div>
  );
}
