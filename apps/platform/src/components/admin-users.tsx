"use client";

import { useEffect, useState } from "react";
import { adminMutation } from "./admin-api";

type User = {
  id: string;
  emailNormalized: string;
  role: string;
  isActive: boolean;
  mfaEnrolledAt: string | null;
  permissions: Array<{ code: string }>;
};
type Session = {
  id: string;
  lastSeenAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  current: boolean;
  adminUser: { emailNormalized: string; role: string };
};

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [message, setMessage] = useState("");

  const fetchAccessState = async () => {
    const [usersResponse, sessionsResponse] = await Promise.all([
      fetch("/api/admin/users", { cache: "no-store" }),
      fetch("/api/admin/sessions", { cache: "no-store" }),
    ]);
    if (usersResponse.status === 403 || sessionsResponse.status === 403) {
      return { users: [] as User[], sessions: [] as Session[], forbidden: true };
    }
    if (!usersResponse.ok || !sessionsResponse.ok) throw new Error("users_load_failed");
    return {
      users: await usersResponse.json() as User[],
      sessions: await sessionsResponse.json() as Session[],
      forbidden: false,
    };
  };

  const load = async () => {
    const state = await fetchAccessState();
    setUsers(state.users);
    setSessions(state.sessions);
    if (state.forbidden) setMessage("Раздел доступен только ADMIN");
  };

  useEffect(() => {
    let active = true;
    void fetchAccessState()
      .then((state) => {
        if (!active) return;
        setUsers(state.users);
        setSessions(state.sessions);
        if (state.forbidden) setMessage("Раздел доступен только ADMIN");
      })
      .catch(() => {
        if (active) setMessage("Не удалось загрузить пользователей");
      });
    return () => { active = false; };
  }, []);

  async function create(form: HTMLFormElement) {
    const data = new FormData(form);
    try {
      await adminMutation("/api/admin/users", "POST", {
        email: data.get("email"),
        password: data.get("password"),
        role: "MANAGER",
        refundPermission: data.get("refund") === "on",
      });
      setMessage("Менеджер создан");
      form.reset();
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка"); }
  }

  async function update(user: User, isActive: boolean, refundPermission: boolean) {
    try {
      await adminMutation("/api/admin/users", "PATCH", { userId: user.id, isActive, refundPermission });
      setMessage("Права пользователя обновлены; при отключении активные сессии отозваны");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка"); }
  }

  async function revoke(session: Session) {
    try {
      await adminMutation("/api/admin/sessions", "PATCH", { sessionId: session.id });
      if (session.current) {
        location.assign("/admin/login");
        return;
      }
      setMessage("Сессия отозвана");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка"); }
  }

  return <section style={{ padding: "30px 0" }}>
    <h1>Пользователи и сессии</h1>
    {message ? <p role="status">{message}</p> : null}
    <form className="admin-card" onSubmit={(event) => { event.preventDefault(); void create(event.currentTarget); }}>
      <h2>Новый MANAGER</h2>
      <input className="admin-field" name="email" type="email" placeholder="Email" required />
      <input className="admin-field" name="password" type="password" minLength={14} maxLength={256} autoComplete="new-password" placeholder="Пароль ≥ 14 символов" required style={{ marginTop: 8 }} />
      <label style={{ display: "block", marginTop: 12 }}><input type="checkbox" name="refund" /> REFUND_ORDER</label>
      <button className="admin-button" style={{ marginTop: 12 }}>Создать</button>
    </form>

    <h2>Пользователи</h2>
    <div style={{ display: "grid", gap: 8 }}>
      {users.map((user) => {
        const canRefund = user.permissions.some((permission) => permission.code === "REFUND_ORDER");
        return <div className="admin-card" key={user.id}>
          <b>{user.emailNormalized}</b> · {user.role} · {user.isActive ? "active" : "disabled"}
          {user.role === "MANAGER" ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button className="admin-button" type="button" onClick={() => void update(user, !user.isActive, canRefund)}>{user.isActive ? "Отключить" : "Включить"}</button>
            <button className="admin-button" type="button" onClick={() => void update(user, user.isActive, !canRefund)}>{canRefund ? "Убрать REFUND_ORDER" : "Выдать REFUND_ORDER"}</button>
          </div> : null}
        </div>;
      })}
    </div>

    <h2>Активные сессии</h2>
    <div style={{ display: "grid", gap: 8 }}>
      {sessions.map((session) => <div className="admin-card" key={session.id}>
        <b>{session.adminUser.emailNormalized}</b> · {session.adminUser.role}{session.current ? " · текущая" : ""}
        <p>Последняя активность: {new Date(session.lastSeenAt).toLocaleString("ru-RU")}<br />Абсолютный срок: {new Date(session.absoluteExpiresAt).toLocaleString("ru-RU")}</p>
        <button className="admin-button" type="button" onClick={() => void revoke(session)}>Отозвать сессию</button>
      </div>)}
    </div>
  </section>;
}
