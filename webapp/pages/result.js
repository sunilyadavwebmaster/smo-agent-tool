import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { isAuthenticated } from "../lib/auth";

export async function getServerSideProps({ req }) {
  if (!isAuthenticated(req)) {
    return { redirect: { destination: "/login", permanent: false } };
  }
  return { props: {} };
}

const POLL_INTERVAL_MS = 6000;

export default function Result() {
  const router = useRouter();
  const [status, setStatus] = useState("LOADING"); // LOADING | RUNNING | READY | FAILED | ERROR
  const [apifyStatus, setApifyStatus] = useState("");
  const [html, setHtml] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const runInfoRef = useRef(null);
  const timerRef = useRef(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    const stored = sessionStorage.getItem("cag_run");
    if (!stored) {
      router.replace("/");
      return;
    }
    runInfoRef.current = JSON.parse(stored);
    setStatus("RUNNING");
    poll();
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function poll() {
    const { runId, formData } = runInfoRef.current;
    try {
      const res = await fetch("/api/generate/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, formData }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("ERROR");
        setErrorMsg(data.error || "Something went wrong");
        return;
      }
      if (data.status === "READY") {
        setStatus("READY");
        setHtml(data.html);
        return;
      }
      if (data.status === "FAILED") {
        setStatus("FAILED");
        setApifyStatus(data.apifyStatus || "");
        return;
      }
      // RUNNING
      setApifyStatus(data.apifyStatus || "");
      elapsedRef.current += POLL_INTERVAL_MS;
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    } catch (err) {
      setStatus("ERROR");
      setErrorMsg(err.message);
    }
  }

  function downloadHtml() {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "content-agent-dashboard.html";
    a.click();
    URL.revokeObjectURL(url);
  }

  function openInNewTab() {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  if (status === "LOADING" || status === "RUNNING") {
    return (
      <div className="page">
        <div className="status-box card">
          <div className="spinner" />
          <h1 style={{ fontSize: 16 }}>Pulling your data…</h1>
          <p className="subtitle">
            Apify status: {apifyStatus || "starting"} — this usually takes 1–3 minutes for several profiles.
            This page checks automatically every few seconds.
          </p>
        </div>
      </div>
    );
  }

  if (status === "FAILED") {
    return (
      <div className="page">
        <div className="card">
          <h1>The Apify run didn&apos;t succeed</h1>
          <p className="subtitle">Status: {apifyStatus}. Check your Apify console for details, then try again.</p>
          <button className="secondary" onClick={() => router.push("/")}>Back to form</button>
        </div>
      </div>
    );
  }

  if (status === "ERROR") {
    return (
      <div className="page">
        <div className="card">
          <h1>Something went wrong</h1>
          <p className="error">{errorMsg}</p>
          <button className="secondary" onClick={() => router.push("/")}>Back to form</button>
        </div>
      </div>
    );
  }

  // READY
  return (
    <div className="page wide">
      <div className="topbar">
        <h1>Your dashboard is ready</h1>
        <button className="secondary" onClick={() => router.push("/")}>Start another</button>
      </div>
      <div className="result-actions">
        <button className="secondary" onClick={downloadHtml}>Download HTML</button>
        <button className="secondary" onClick={openInNewTab}>Open in new tab</button>
      </div>
      <iframe className="dashboard-preview" srcDoc={html} title="Dashboard preview" />
    </div>
  );
}
