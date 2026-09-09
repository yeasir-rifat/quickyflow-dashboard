import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "./supabaseClient";
import { formatDuration, formatTime, isoDaysAgo, todayISO } from "./utils";

export default function EmployeePortal({ profile }) {
  const [todayActivities, setTodayActivities] = useState([]);
  const [weekRows, setWeekRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const today = todayISO();
    const weekStart = isoDaysAgo(6);

    const { data: todayActs } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("employee_id", profile.id)
      .eq("activity_date", today)
      .order("started_at", { ascending: false });

    const { data: weekActs } = await supabase
      .from("activity_logs")
      .select("domain, duration_seconds, activity_date")
      .eq("employee_id", profile.id)
      .gte("activity_date", weekStart)
      .lte("activity_date", today);

    setTodayActivities(todayActs || []);
    setWeekRows(weekActs || []);
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  const todayTotal = todayActivities.reduce((sum, a) => sum + (a.duration_seconds || 0), 0);

  const domainTotals = {};
  for (const a of todayActivities) {
    domainTotals[a.domain] = (domainTotals[a.domain] || 0) + (a.duration_seconds || 0);
  }
  const sortedDomains = Object.entries(domainTotals).sort((a, b) => b[1] - a[1]);

  // সাপ্তাহিক ট্রেন্ড চার্টের ডেটা
  const dayLabels = [];
  for (let i = 6; i >= 0; i--) dayLabels.push(isoDaysAgo(i));
  const weekChartData = dayLabels.map((dateKey) => {
    const secs = weekRows
      .filter((r) => r.activity_date === dateKey)
      .reduce((sum, r) => sum + (r.duration_seconds || 0), 0);
    return { date: dateKey.slice(5), minutes: Math.round(secs / 60) };
  });
  const weekTotal = weekRows.reduce((sum, r) => sum + (r.duration_seconds || 0), 0);

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <span style={styles.brandMark}>◆</span>
          <span style={styles.brandName}>Quickyflow</span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.userName}>{profile.full_name}</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>লগআউট</button>
        </div>
      </header>

      <div style={styles.body}>
        {loading ? (
          <div style={styles.empty}>লোড হচ্ছে...</div>
        ) : (
          <>
            <div style={styles.statsRow}>
              <StatCard label="আজকের সময়" value={formatDuration(todayTotal)} />
              <StatCard label="এই সপ্তাহের মোট সময়" value={formatDuration(weekTotal)} />
              <StatCard
                label="দৈনিক গড় (৭ দিন)"
                value={formatDuration(weekTotal / 7)}
              />
            </div>

            <div style={styles.chartCard}>
              <div style={styles.chartLabel}>গত ৭ দিনের কাজের সময় (মিনিট)</div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={weekChartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--text-faint)" fontSize={12} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
                  <YAxis stroke="var(--text-faint)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--panel-raised)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      color: "var(--text)",
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="minutes" stroke="var(--amber)" strokeWidth={2} dot={{ fill: "var(--amber)", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={styles.section}>
              <div style={styles.sectionLabel}>আজ যেসব সাইটে সময় দিয়েছেন</div>
              <div style={styles.domainGrid}>
                {sortedDomains.length === 0 && (
                  <div style={styles.emptySmall}>আজ এখনো কোনো কার্যক্রম রেকর্ড হয়নি।</div>
                )}
                {sortedDomains.map(([domain, secs]) => (
                  <div key={domain} style={styles.domainCard}>
                    <span style={styles.domainName}>{domain}</span>
                    <span style={styles.domainTime} className="mono">{formatDuration(secs)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.section}>
              <div style={styles.sectionLabel}>আজকের টাইমলাইন</div>
              <div style={styles.timeline}>
                {todayActivities.length === 0 && (
                  <div style={{ ...styles.emptySmall, padding: "14px 0" }}>কোনো কার্যক্রম নেই।</div>
                )}
                {todayActivities.map((a) => (
                  <div key={a.id} style={styles.timelineRow}>
                    <span style={styles.timelineTime} className="mono">{formatTime(a.started_at)}</span>
                    <span style={styles.timelineDomain}>{a.domain}</span>
                    <span style={styles.timelineDuration} className="mono">
                      {formatDuration(a.duration_seconds)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue} className="mono">{value}</div>
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
    justifyContent: "space-between",
    padding: "0 20px",
    borderBottom: "1px solid var(--line)",
  },
  brand: { display: "flex", alignItems: "center", gap: 8 },
  brandMark: { color: "var(--amber)", fontSize: 16 },
  brandName: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 },
  headerRight: { display: "flex", alignItems: "center", gap: 12 },
  userName: { fontSize: 13, color: "var(--text-dim)" },
  logoutBtn: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    color: "var(--text-dim)",
    borderRadius: 7,
    padding: "6px 12px",
    fontSize: 12.5,
  },
  body: { flex: 1, overflowY: "auto", padding: "24px 28px", maxWidth: 900, margin: "0 auto", width: "100%" },
  statsRow: { display: "flex", gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1,
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 12,
    padding: "16px 18px",
  },
  statLabel: { fontSize: 12, color: "var(--text-dim)", marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: 600, color: "var(--amber)" },
  chartCard: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 12,
    padding: "18px 18px 6px",
    marginBottom: 24,
  },
  chartLabel: { fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 12.5,
    color: "var(--text-dim)",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  domainGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  domainCard: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "8px 12px",
    display: "flex",
    gap: 10,
    alignItems: "center",
    fontSize: 13,
  },
  domainName: { color: "var(--text)" },
  domainTime: { color: "var(--text-dim)", fontSize: 12 },
  timeline: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 12,
    padding: "6px 16px",
  },
  timelineRow: {
    display: "flex",
    gap: 16,
    padding: "10px 0",
    borderBottom: "1px solid var(--line)",
    fontSize: 13.5,
    alignItems: "center",
  },
  timelineTime: { color: "var(--text-faint)", width: 50, flexShrink: 0, fontSize: 12 },
  timelineDomain: { flex: 1, color: "var(--text)" },
  timelineDuration: { color: "var(--amber)", fontSize: 12.5 },
  empty: { color: "var(--text-dim)", padding: 40, textAlign: "center" },
  emptySmall: { color: "var(--text-faint)", fontSize: 13 },
};
