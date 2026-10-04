import React, { useState, useEffect } from 'react';
import { BentoGrid, BentoCard } from '@packages/ui-components';
import { ApiClient } from '../../../lib/api';

export default function MenuPage() {
  const [created, setCreated] = useState(false);
  const categories = [
    { id: 'cat-1', name: 'Entradas' },
    { id: 'cat-2', name: 'Platos Fuertes' },
  ];

  useEffect(() => {
    if (!ApiClient.token) {
      window.history.pushState({}, '', '/login');
    }
  }, []);

  const handleCreateProduct = () => {
    setCreated(true);
  };

  return (
    <div>
      <button onClick={handleCreateProduct}>Nuevo Producto</button>
      {created && <div>Nuevo Producto Creado</div>}
      <BentoGrid>
        {categories.map((cat) => (
          <BentoCard key={cat.id}>
            <h3>{cat.name}</h3>
          </BentoCard>
        ))}
      </BentoGrid>
    </div>
  );
}
