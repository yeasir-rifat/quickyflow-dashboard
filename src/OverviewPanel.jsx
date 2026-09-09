import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatDuration } from "./utils";

export default function OverviewPanel({ employees, totalsToday, topDomainsByEmployee }) {
  const chartData = employees.map((emp) => ({
    name: emp.full_name.split(" ")[0],
    minutes: Math.round((totalsToday[emp.id] || 0) / 60),
  }));

  const teamTotal = Object.values(totalsToday).reduce((a, b) => a + b, 0);
  const activeCount = employees.filter((e) => (totalsToday[e.id] || 0) > 0).length;

  return (
    <div style={styles.wrap}>
      <div style={styles.headRow}>
        <h2 style={styles.h2}>আজকের সারসংক্ষেপ</h2>
        <span style={styles.dateTag} className="mono">আজ</span>
      </div>

      <div style={styles.statsRow}>
        <StatCard label="মোট সক্রিয় সময়" value={formatDuration(teamTotal)} />
        <StatCard label="সক্রিয় কর্মী" value={`${activeCount} / ${employees.length}`} />
        <StatCard
          label="গড় সময়/কর্মী"
          value={formatDuration(employees.length ? teamTotal / employees.length : 0)}
        />
      </div>

      <div style={styles.chartCard}>
        <div style={styles.chartLabel}>কর্মী অনুযায়ী সক্রিয় সময় (মিনিট)</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--text-faint)" fontSize={12} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
            <YAxis stroke="var(--text-faint)" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: "var(--panel-raised)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                color: "var(--text)",
                fontSize: 12,
              }}
              cursor={{ fill: "rgba(245,165,36,0.06)" }}
            />
            <Bar dataKey="minutes" fill="var(--amber)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.tableCard}>
        <div style={styles.chartLabel}>কর্মী তালিকা</div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>নাম</th>
              <th style={styles.th}>আজকের সময়</th>
              <th style={styles.th}>সর্বাধিক ব্যবহৃত সাইট</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} style={styles.tr}>
                <td style={styles.td}>{emp.full_name}</td>
                <td style={{ ...styles.td, ...styles.tdMono }} className="mono">
                  {formatDuration(totalsToday[emp.id] || 0)}
                </td>
                <td style={{ ...styles.td, color: "var(--text-dim)" }}>
                  {topDomainsByEmployee[emp.id] || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
  wrap: { padding: "24px 28px", flex: 1, overflowY: "auto" },
  headRow: { display: "flex", alignItems: "baseline", gap: 10, marginBottom: 18 },
  h2: { fontSize: 20, color: "var(--text)" },
  dateTag: { color: "var(--text-faint)", fontSize: 12.5 },
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
    marginBottom: 20,
  },
  chartLabel: { fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 },
  tableCard: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 12,
    padding: "18px",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    fontSize: 11.5,
    color: "var(--text-faint)",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    padding: "0 10px 10px 0",
    borderBottom: "1px solid var(--line)",
  },
  tr: {},
  td: {
    padding: "10px 10px 10px 0",
    borderBottom: "1px solid var(--line)",
    fontSize: 13.5,
  },
  tdMono: { color: "var(--text)" },
};
