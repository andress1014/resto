export default function ClientRootPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 20, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Bienvenido a Resto</h1>
      <p style={{ fontSize: '1.2rem', color: '#666' }}>Por favor escanea el QR de tu mesa para ordenar.</p>
    </div>
  );
}
