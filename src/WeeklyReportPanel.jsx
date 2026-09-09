import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "./supabaseClient";
import { formatDuration, isoDaysAgo, todayISO } from "./utils";

const BAR_COLORS = ["#f5a524", "#4fd1a5", "#7aa2f7", "#f0648c", "#c084fc", "#5eead4", "#fca5a5", "#a3e635"];

export default function WeeklyReportPanel({ employees }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = এই সপ্তাহ, 1 = গত সপ্তাহ...

  const rangeDays = 7;
  const startOffset = weekOffset * 7 + 6;
  const endOffset = weekOffset * 7;
  const startDate = isoDaysAgo(startOffset);
  const endDate = isoDaysAgo(endOffset);

  useEffect(() => {
    loadWeekData();
  }, [weekOffset, employees.length]);

  async function loadWeekData() {
    setLoading(true);
    const startISO = `${startDate}T00:00:00`;
    const endISO = `${endDate}T23:59:59`;

    const { data } = await supabase
      .from("activity_logs")
      .select("employee_id, domain, duration_seconds, activity_date")
      .gte("started_at", startISO)
      .lte("started_at", endISO);

    setRows(data || []);
    setLoading(false);
  }

  // প্রতিদিনের জন্য প্রতিটা কর্মীর মোট সময় হিসাব করা (চার্টের জন্য)
  const dayLabels = [];
  for (let i = startOffset; i >= endOffset; i--) {
    dayLabels.push(isoDaysAgo(i));
  }

  const chartData = dayLabels.map((dateKey) => {
    const entry = { date: dateKey.slice(5) }; // MM-DD
    for (const emp of employees) {
      const secs = rows
        .filter((r) => r.employee_id === emp.id && r.activity_date === dateKey)
        .reduce((sum, r) => sum + (r.duration_seconds || 0), 0);
      entry[emp.full_name] = Math.round(secs / 60); // মিনিটে
    }
    return entry;
  });

  // প্রতিটা কর্মীর সাপ্তাহিক মোট + সবচেয়ে বেশি ব্যবহৃত সাইট
  const employeeSummaries = employees.map((emp) => {
    const empRows = rows.filter((r) => r.employee_id === emp.id);
    const total = empRows.reduce((sum, r) => sum + (r.duration_seconds || 0), 0);
    const domainTotals = {};
    for (const r of empRows) {
      domainTotals[r.domain] = (domainTotals[r.domain] || 0) + (r.duration_seconds || 0);
    }
    const topDomain = Object.entries(domainTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    const activeDays = new Set(empRows.map((r) => r.activity_date)).size;
    return { ...emp, total, topDomain, activeDays };
  });

  const weekTotal = employeeSummaries.reduce((sum, e) => sum + e.total, 0);

  function exportCSV() {
    let csv = "কর্মী,ইমেইল,মোট সময় (সেকেন্ড),মোট সময় (ফরম্যাট),সক্রিয় দিন,সর্বাধিক ব্যবহৃত সাইট\n";
    for (const e of employeeSummaries) {
      csv += `"${e.full_name}","${e.email}",${e.total},"${formatDuration(e.total)}",${e.activeDays},"${e.topDomain}"\n`;
    }
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quickyflow-weekly-report-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.headRow}>
        <h2 style={styles.h2}>সাপ্তাহিক রিপোর্ট</h2>
        <div style={styles.controls}>
          <button style={styles.navBtn} onClick={() => setWeekOffset((w) => w + 1)}>← আগের সপ্তাহ</button>
          <span style={styles.rangeLabel} className="mono">{startDate} — {endDate}</span>
          <button
            style={styles.navBtn}
            onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
            disabled={weekOffset === 0}
          >
            পরের সপ্তাহ →
          </button>
          <button style={styles.exportBtn} onClick={exportCSV}>CSV এক্সপোর্ট</button>
        </div>
      </div>

      {loading ? (
        <div style={styles.empty}>লোড হচ্ছে...</div>
      ) : (
        <>
          <div style={styles.statsRow}>
            <StatCard label="সপ্তাহের মোট সময়" value={formatDuration(weekTotal)} />
            <StatCard
              label="গড় সময়/কর্মী"
              value={formatDuration(employees.length ? weekTotal / employees.length : 0)}
            />
            <StatCard label="মোট কর্মী" value={`${employees.length}`} />
          </div>

          <div style={styles.chartCard}>
            <div style={styles.chartLabel}>দৈনিক সময় বিভাজন (মিনিট)</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
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
                  cursor={{ fill: "rgba(245,165,36,0.06)" }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-dim)" }} />
                {employees.map((emp, i) => (
                  <Bar
                    key={emp.id}
                    dataKey={emp.full_name}
                    stackId="a"
                    fill={BAR_COLORS[i % BAR_COLORS.length]}
                    radius={i === employees.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={styles.tableCard}>
            <div style={styles.chartLabel}>কর্মী অনুযায়ী সাপ্তাহিক সারসংক্ষেপ</div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>নাম</th>
                  <th style={styles.th}>মোট সময়</th>
                  <th style={styles.th}>সক্রিয় দিন</th>
                  <th style={styles.th}>সর্বাধিক ব্যবহৃত সাইট</th>
                </tr>
              </thead>
              <tbody>
                {employeeSummaries
                  .sort((a, b) => b.total - a.total)
                  .map((e) => (
                    <tr key={e.id}>
                      <td style={styles.td}>{e.full_name}</td>
                      <td style={{ ...styles.td }} className="mono">{formatDuration(e.total)}</td>
                      <td style={{ ...styles.td }} className="mono">{e.activeDays} / 7</td>
                      <td style={{ ...styles.td, color: "var(--text-dim)" }}>{e.topDomain}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
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
  headRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
    flexWrap: "wrap",
    gap: 12,
  },
  h2: { fontSize: 20, color: "var(--text)" },
  controls: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  navBtn: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    color: "var(--text-dim)",
    borderRadius: 7,
    padding: "7px 12px",
    fontSize: 12.5,
  },
  rangeLabel: { color: "var(--text-dim)", fontSize: 12.5 },
  exportBtn: {
    background: "var(--amber)",
    border: "none",
    color: "#1a1305",
    borderRadius: 7,
    padding: "8px 14px",
    fontSize: 12.5,
    fontWeight: 700,
  },
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
  td: {
    padding: "10px 10px 10px 0",
    borderBottom: "1px solid var(--line)",
    fontSize: 13.5,
  },
  empty: { color: "var(--text-dim)", padding: 40, textAlign: "center" },
};
