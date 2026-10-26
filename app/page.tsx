export default function Home() {
  // The v1 product is the chat + cards UI (brand work is a later phase); the
  // backend surfaces live under /api/* per docs/BACKEND_BUILD_BRIEF.md §4.
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", lineHeight: 1.6 }}>
      <h1>A Una Milla — backend v1</h1>
      <p>Este despliegue expone la API del motor (F12). Las pantallas de chat llegan en la fase de UI.</p>
      <ul>
        <li>POST /api/chat — turno F12 (parse → computar → explicar)</li>
        <li>POST /api/engine/verdict — comparación de reservar ya (F2)</li>
        <li>POST /api/engine/runway — modo plan (F1, ranking D21)</li>
        <li>POST /api/duffel/* — tarifas en efectivo, re-verify, pedido test (F8, D31)</li>
        <li>CRUD /api/wallet · /api/itineraries · GET /api/persona · GET /api/admin</li>
      </ul>
      <p style={{ color: "#666" }}>
        Atribución del dataset de valoraciones (CC-BY-4.0): «points-transfer-valuations», WanderWise Guide.
      </p>
    </main>
  );
}
