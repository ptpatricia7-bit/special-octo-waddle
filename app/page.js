"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

const MODEL_OPTIONS = [
  { value: "seedance-pro-fast", label: "Seedance 1.0 Pro Fast" },
  { value: "seedance-2-mini", label: "Seedance 2.0 Mini" },
];

export default function Page() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [credits, setCredits] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("seedance-pro-fast");
  const [ratio, setRatio] = useState("9:16");
  const [res, setRes] = useState("720p");
  const [dur, setDur] = useState("5");
  const [jobs, setJobs] = useState([]);
  const [busy, setBusy] = useState(false);
  const pollRefs = useRef({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    refreshCredits();
    loadJobs();
  }, [session]);

  async function refreshCredits() {
    const { data } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", session.user.id)
      .single();
    setCredits(data?.credits ?? 0);
  }

  async function loadJobs() {
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setJobs(data || []);
  }

  async function sendMagicLink(e) {
    e.preventDefault();
    await supabase.auth.signInWithOtp({ email });
    setMagicSent(true);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function authedFetch(url, opts = {}) {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    return fetch(url, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async function buyCredits() {
    const r = await authedFetch("/api/stripe/checkout", { method: "POST" });
    const data = await r.json();
    if (data.url) window.location.href = data.url;
    else alert(data.error || "Erro ao iniciar pagamento");
  }

  async function create() {
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      const r = await authedFetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model, ratio, res, dur }),
      });
      const data = await r.json();
      if (!r.ok) {
        alert(data.error || "Erro ao criar vídeo");
        setBusy(false);
        return;
      }
      setPrompt("");
      await refreshCredits();
      await loadJobs();
      poll(data.jobId, data.modelId, data.requestId);
    } catch (err) {
      alert("Falha de rede: " + err.message);
    }
    setBusy(false);
  }

  function poll(jobId, modelId, requestId) {
    const tick = setInterval(async () => {
      const r = await authedFetch(
        `/api/status?jobId=${jobId}&modelId=${encodeURIComponent(modelId)}&requestId=${requestId}`
      );
      const data = await r.json();
      if (data.status === "COMPLETED" || data.error) {
        clearInterval(tick);
        delete pollRefs.current[jobId];
        loadJobs();
      }
    }, 3000);
    pollRefs.current[jobId] = tick;
  }

  useEffect(() => () => Object.values(pollRefs.current).forEach(clearInterval), []);

  if (!session) {
    return (
      <div className="wrap">
        <h1>Workspace</h1>
        <p className="sub">Crie vídeos sociais com IA. Entre com seu e-mail para começar.</p>
        <div className="card">
          {magicSent ? (
            <p>Enviamos um link de acesso para {email}. Confira sua caixa de entrada.</p>
          ) : (
            <form onSubmit={sendMagicLink}>
              <input
                type="email"
                required
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="row">
                <button className="btn-primary" type="submit">Enviar link de acesso</button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="top">
        <div>
          <h1>Workspace</h1>
          <p className="sub" style={{ margin: 0 }}>{session.user.email}</p>
        </div>
        <button className="btn-ghost" onClick={signOut}>Sair</button>
      </div>

      <div className="card">
        <div className="top" style={{ marginBottom: 12 }}>
          <span className="credits">
            <strong style={{ color: "var(--fg)" }}>{credits ?? "…"}</strong> créditos
          </span>
          <button className="btn-ghost" onClick={buyCredits}>Comprar créditos</button>
        </div>

        <textarea
          placeholder="Descreva o vídeo que você quer criar…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="row">
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {MODEL_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={ratio} onChange={(e) => setRatio(e.target.value)}>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
            <option value="16:9">16:9</option>
          </select>
          <select value={res} onChange={(e) => setRes(e.target.value)}>
            <option value="480p">480p</option>
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
          </select>
          <select value={dur} onChange={(e) => setDur(e.target.value)}>
            <option value="5">5s</option>
            <option value="10">10s</option>
          </select>
        </div>
        <div className="row">
          <button className="btn-primary" onClick={create} disabled={busy}>
            {busy ? "Enviando…" : "Criar"}
          </button>
        </div>
      </div>

      <h2 style={{ fontSize: 15 }}>Histórico</h2>
      {jobs.length === 0 && <p className="sub">Nada criado ainda.</p>}
      {jobs.map((j) => (
        <div className="job" key={j.id}>
          <p style={{ margin: "0 0 8px", fontSize: 13.5 }}>{j.prompt}</p>
          {j.video_url ? (
            <video src={j.video_url} controls playsInline />
          ) : j.error ? (
            <p className="error">{j.error}</p>
          ) : (
            <p className="sub">Gerando…</p>
          )}
        </div>
      ))}
    </div>
  );
}
