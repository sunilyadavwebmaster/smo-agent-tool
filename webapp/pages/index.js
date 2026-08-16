import { useState } from "react";
import { useRouter } from "next/router";
import { isAuthenticated } from "../lib/auth";

export async function getServerSideProps({ req }) {
  if (!isAuthenticated(req)) {
    return { redirect: { destination: "/login", permanent: false } };
  }
  return { props: {} };
}

const today = () => new Date().toISOString().slice(0, 10);

export default function Home() {
  const router = useRouter();
  const [form, setForm] = useState({
    ownerHandle: "",
    competitor1: "",
    competitor2: "",
    competitor3: "",
    competitor4: "",
    competitor5: "",
    resultsLimit: 30,
    startDate: today(),
    blockedDates: "",
    partnerName: "",
    partnerBenefit: "",
    promoCode: "",
    occasionName: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    const competitors = [form.competitor1, form.competitor2, form.competitor3, form.competitor4, form.competitor5]
      .map((s) => s.trim())
      .filter(Boolean);

    if (!form.ownerHandle.trim()) {
      setError("Your Instagram handle is required.");
      return;
    }
    if (competitors.length === 0) {
      setError("Add at least one competitor handle.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/generate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerHandle: form.ownerHandle.trim(),
          competitors,
          resultsLimit: form.resultsLimit,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start the data pull.");
        setSubmitting(false);
        return;
      }
      const formData = { ...form, ownerHandle: form.ownerHandle.trim(), competitors };
      sessionStorage.setItem("cag_run", JSON.stringify({ runId: data.runId, formData }));
      router.push("/result");
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <h1>Content Agent Dashboard Tool</h1>
          <p className="subtitle">Fill in your details, pull real data, and generate the full dashboard — no manual work in between.</p>
        </div>
        <button className="secondary" onClick={logout}>Log out</button>
      </div>

      <div className="card">
        <form onSubmit={onSubmit}>
          <label className="first" htmlFor="ownerHandle">Your Instagram handle</label>
          <input id="ownerHandle" type="text" placeholder="yourhandle" value={form.ownerHandle}
                 onChange={(e) => update("ownerHandle", e.target.value)} />

          <div className="section-title">Competitors (1–5)</div>
          {[1, 2, 3, 4, 5].map((n) => (
            <input key={n} type="text" placeholder={`competitor${n}`} style={{ marginTop: 8 }}
                   value={form[`competitor${n}`]} onChange={(e) => update(`competitor${n}`, e.target.value)} />
          ))}
          <div className="hint">Bare handles or full instagram.com URLs both work.</div>

          <div className="section-title">Pull settings</div>
          <div className="two-col">
            <div>
              <label className="first">Results limit per profile</label>
              <input type="number" min="5" max="100" value={form.resultsLimit}
                     onChange={(e) => update("resultsLimit", e.target.value)} />
            </div>
            <div>
              <label className="first">Calendar start date</label>
              <input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
            </div>
          </div>
          <label>Dates to treat as respectful/no-hard-sell (optional)</label>
          <input type="text" placeholder="2026-08-28, 2026-12-02" value={form.blockedDates}
                 onChange={(e) => update("blockedDates", e.target.value)} />
          <div className="hint">Comma-separated YYYY-MM-DD. This tool doesn't look up local holidays automatically — add any you want handled gently yourself.</div>

          <div className="section-title">Fill in what the tool can't know</div>
          <div className="hint" style={{ marginBottom: 8 }}>Leave any of these blank and the matching post will keep a placeholder and be flagged "needs your input" on the dashboard.</div>
          <div className="two-col">
            <div>
              <label className="first">Partner name</label>
              <input type="text" value={form.partnerName} onChange={(e) => update("partnerName", e.target.value)} />
            </div>
            <div>
              <label className="first">Partner benefit</label>
              <input type="text" placeholder="e.g. 10% off" value={form.partnerBenefit} onChange={(e) => update("partnerBenefit", e.target.value)} />
            </div>
          </div>
          <div className="two-col">
            <div>
              <label>Creator promo code</label>
              <input type="text" value={form.promoCode} onChange={(e) => update("promoCode", e.target.value)} />
            </div>
            <div>
              <label>Nearest upcoming occasion</label>
              <input type="text" placeholder="e.g. Mother's Day" value={form.occasionName} onChange={(e) => update("occasionName", e.target.value)} />
            </div>
          </div>

          {error && <div className="error">{error}</div>}
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? "Starting the data pull…" : "Generate Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
