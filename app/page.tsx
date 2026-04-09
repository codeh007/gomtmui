export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "42rem",
          border: "1px solid rgba(148, 163, 184, 0.3)",
          borderRadius: "1rem",
          padding: "2rem",
          background: "rgba(15, 23, 42, 0.92)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.35)",
        }}
      >
        <p style={{ margin: 0, color: "#38bdf8", fontSize: "0.95rem", fontWeight: 700 }}>gomtmui</p>
        <h1 style={{ marginTop: "0.75rem", marginBottom: "0.75rem", fontSize: "2.25rem" }}>Hello World</h1>
        <p style={{ margin: 0, lineHeight: 1.7, color: "#cbd5e1" }}>
          This public repository is a minimal Cloudflare Worker deployment demo for the future gomtmui migration.
        </p>
      </section>
    </main>
  );
}
