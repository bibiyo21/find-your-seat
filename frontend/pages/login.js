import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { getSession } from "../lib/session";

export async function getServerSideProps({ req }) {
  const session = await getSession(req);
  if (session.authenticated) {
    return { redirect: { destination: "/", permanent: false } };
  }
  return { props: {} };
}

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Login failed");
      router.push("/");
    } catch (err) {
      setError(err.message);
      setPassword("");
    }
  }

  return (
    <>
      <Head>
        <title>Admin Login · Wedding Seating Planner</title>
      </Head>
      <div className="loginBody">
        <div className="loginWrap">
          <div className="loginCard">
            <div className="loginBrand">&hearts; Wedding Seating Planner</div>
            <h1>Admin Login</h1>
            <form onSubmit={onSubmit}>
              <input
                className="search"
                name="username"
                placeholder="Username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <input
                className="search"
                name="password"
                type="password"
                placeholder="Password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <div className="loginError">{error}</div>}
              <button type="submit" className="primary loginSubmit">
                Log In
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
