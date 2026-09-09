import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./Login";
import EmployeeSidebar from "./EmployeeSidebar";
import OverviewPanel from "./OverviewPanel";
import EmployeeDetail from "./EmployeeDetail";
import WeeklyReportPanel from "./WeeklyReportPanel";
import EmployeePortal from "./EmployeePortal";
import { todayISO } from "./utils";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [totalsToday, setTotalsToday] = useState({});
  const [topDomains, setTopDomains] = useState({});
  const [activeTab, setActiveTab] = useState("overview"); // overview | weekly

  useEffect(() => {
    init();
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      if (sess) {
        await loadProfile(sess.user.id);
      } else {
        setProfile(null);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function init() {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session) {
      await loadProfile(data.session.user.id);
    }
    setCheckingSession(false);
  }

  async function loadProfile(userId) {
    const { data } = await supabase
      .from("employees")
      .select("id, role, full_name, email")
      .eq("id", userId)
      .single();
    setProfile(data || null);
  }

  useEffect(() => {
    if (session && profile?.role === "admin") {
      loadEmployees();
      loadTotals();
      const interval = setInterval(loadTotals, 20000);
      return () => clearInterval(interval);
    }
  }, [session, profile]);

  async function loadEmployees() {
    const { data } = await supabase
      .from("employees")
      .select("*")
      .eq("role", "employee")
      .order("full_name");
    setEmployees(data || []);
  }

  async function loadTotals() {
    const today = todayISO();
    const { data } = await supabase
      .from("activity_logs")
      .select("employee_id, domain, duration_seconds")
      .eq("activity_date", today);

    const totals = {};
    const domainCounts = {};

    for (const row of data || []) {
      totals[row.employee_id] = (totals[row.employee_id] || 0) + (row.duration_seconds || 0);
      if (!domainCounts[row.employee_id]) domainCounts[row.employee_id] = {};
      domainCounts[row.employee_id][row.domain] =
        (domainCounts[row.employee_id][row.domain] || 0) + (row.duration_seconds || 0);
    }

    const top = {};
    for (const [empId, domains] of Object.entries(domainCounts)) {
      const sorted = Object.entries(domains).sort((a, b) => b[1] - a[1]);
      top[empId] = sorted[0]?.[0] || null;
    }

    setTotalsToday(totals);
    setTopDomains(top);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  if (checkingSession) {
    return <div style={{ color: "var(--text-dim)", padding: 40 }}>লোড হচ্ছে...</div>;
  }

  if (!session) {
    return <Login onLoggedIn={setProfile} />;
  }

  if (!profile) {
    return <div style={{ color: "var(--text-dim)", padding: 40 }}>প্রোফাইল লোড হচ্ছে...</div>;
  }

  // কর্মী হলে সরাসরি তার নিজস্ব পোর্টাল দেখানো হবে
  if (profile.role === "employee") {
    return <EmployeePortal profile={profile} />;
  }

  // অ্যাডমিন ভিউ
  const selectedEmployee = employees.find((e) => e.id === selectedId) || null;

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <span style={styles.brandMark}>◆</span>
          <span style={styles.brandName}>Quickyflow</span>
        </div>
        <nav style={styles.nav}>
          <button
            style={{ ...styles.navTab, ...(activeTab === "overview" ? styles.navTabActive : {}) }}
            onClick={() => { setActiveTab("overview"); setSelectedId(null); }}
          >
            সারসংক্ষেপ
          </button>
          <button
            style={{ ...styles.navTab, ...(activeTab === "weekly" ? styles.navTabActive : {}) }}
            onClick={() => { setActiveTab("weekly"); setSelectedId(null); }}
          >
            সাপ্তাহিক রিপোর্ট
          </button>
        </nav>
        <button style={styles.logoutBtn} onClick={handleLogout}>লগআউট</button>
      </header>
      <div style={styles.body}>
        <EmployeeSidebar
          employees={employees}
          selectedId={selectedId}
          onSelect={(id) => { setSelectedId(id); setActiveTab("overview"); }}
          totalsToday={totalsToday}
        />
        {selectedEmployee ? (
          <EmployeeDetail employee={selectedEmployee} />
        ) : activeTab === "weekly" ? (
          <WeeklyReportPanel employees={employees} />
        ) : (
          <OverviewPanel
            employees={employees}
            totalsToday={totalsToday}
            topDomainsByEmployee={topDomains}
          />
        )}
      </div>
    </div>
  );
}

const styles = {
  app: { height: "100vh", display: "flex", flexDirection: "column" },
  header: {
    height: 56,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 24,
    padding: "0 20px",
    borderBottom: "1px solid var(--line)",
  },
  brand: { display: "flex", alignItems: "center", gap: 8 },
  brandMark: { color: "var(--amber)", fontSize: 16 },
  brandName: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 },
  nav: { display: "flex", gap: 4, flex: 1 },
  navTab: {
    background: "transparent",
    border: "none",
    color: "var(--text-dim)",
    borderRadius: 7,
    padding: "7px 14px",
    fontSize: 13,
  },
  navTabActive: {
    background: "var(--panel)",
    color: "var(--text)",
  },
  logoutBtn: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    color: "var(--text-dim)",
    borderRadius: 7,
    padding: "6px 12px",
    fontSize: 12.5,
  },
  body: { flex: 1, display: "flex", overflow: "hidden" },
};
