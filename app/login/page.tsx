import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in — A Una Milla",
  description: "Access your sovereign travel folio.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="login-shell">
      <div className="login-card">
        <p className="login-kicker">A Una Milla</p>
        <h1 className="login-title">Sign in to your folio</h1>
        <p className="login-lead">Use email and password. New accounts get a private profile automatically.</p>
        {params.error ? <p className="login-error">Could not complete sign-in. Try again.</p> : null}
        <LoginForm nextPath={params.next} />
      </div>
      <style>{`
        .login-shell {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fbf6ee;
          padding: 1.5rem;
          font-family: Outfit, system-ui, sans-serif;
          color: #1d1b16;
        }
        .login-card {
          width: 100%;
          max-width: 420px;
          background: #fff9ee;
          border: 1px solid rgba(21, 44, 82, 0.16);
          box-shadow: 0 8px 32px rgba(0, 23, 58, 0.08);
          padding: 2rem;
        }
        .login-kicker {
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #5e7094;
          margin: 0 0 0.5rem;
        }
        .login-title {
          font-family: "Bodoni Moda", Georgia, serif;
          font-size: 1.75rem;
          font-weight: 500;
          margin: 0 0 0.75rem;
          color: #00173a;
        }
        .login-lead {
          font-size: 0.95rem;
          line-height: 1.5;
          color: #44474e;
          margin: 0 0 1.5rem;
        }
        .login-error {
          color: #93000a;
          background: #ffdad6;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          margin: 0 0 1rem;
        }
      `}</style>
    </main>
  );
}
