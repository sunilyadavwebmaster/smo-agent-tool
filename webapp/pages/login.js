import { useState } from "react";
import { useRouter } from "next/router";
import { isAuthenticated } from "../lib/auth";

export async function getServerSideProps({ req }) {
  if (isAuthenticated(req)) {
    return { redirect: { destination: "/", permanent: false } };
  }
  return { props: {} };
}

export default function Login() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Login failed");
    }
  }

  return (
    <div className="page">
      <h1>Content Agent Dashboard Tool</h1>
      <p className="subtitle">Enter the password to continue.</p>
      <div className="card">
        <form onSubmit={onSubmit}>
          <label className="first" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <div className="error">{error}</div>}
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
