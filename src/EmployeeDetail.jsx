import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { formatDuration, formatTime, todayISO } from "./utils";

export default function EmployeeDetail({ employee }) {
  const [activities, setActivities] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screenshotUrls, setScreenshotUrls] = useState({});

  useEffect(() => {
    if (!employee) return;
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [employee?.id]);

  async function loadData() {
    const today = todayISO();
    const startOfDay = `${today}T00:00:00`;
    const endOfDay = `${today}T23:59:59`;

    const { data: acts } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("employee_id", employee.id)
      .gte("started_at", startOfDay)
      .lte("started_at", endOfDay)
      .order("started_at", { ascending: false });

    const { data: shots } = await supabase
      .from("screenshots")
      .select("*")
      .eq("employee_id", employee.id)
      .gte("captured_at", startOfDay)
      .lte("captured_at", endOfDay)
      .order("captured_at", { ascending: false })
      .limit(24);

    setActivities(acts || []);
    setScreenshots(shots || []);
    setLoading(false);

    // signed URL তৈরি করা প্রতিটা স্ক্রিনশটের জন্য
    if (shots && shots.length) {
      const urls = {};
      for (const shot of shots) {
        const { data } = await supabase.storage
          .from("screenshots")
          .createSignedUrl(shot.storage_path, 3600);
        if (data) urls[shot.id] = data.signedUrl;
      }
      setScreenshotUrls(urls);
    }
  }

  if (!employee) return null;

  const totalToday = activities.reduce((sum, a) => sum + (a.duration_seconds || 0), 0);

  // ডোমেইন অনুযায়ী গ্রুপ করা
  const domainTotals = {};
  for (const a of activities) {
    domainTotals[a.domain] = (domainTotals[a.domain] || 0) + (a.duration_seconds || 0);
  }
  const sortedDomains = Object.entries(domainTotals).sort((a, b) => b[1] - a[1]);

  return (
    <div style={styles.wrap}>
      <div style={styles.headRow}>
        <div>
          <h2 style={styles.h2}>{employee.full_name}</h2>
          <div style={styles.email}>{employee.email}</div>
        </div>
        <div style={styles.totalBadge}>
          <span style={styles.totalLabel}>আজকের মোট সময়</span>
          <span style={styles.totalValue} className="mono">{formatDuration(totalToday)}</span>
        </div>
      </div>

      {loading ? (
        <div style={styles.empty}>লোড হচ্ছে...</div>
      ) : (
        <>
          <div style={styles.section}>
            <div style={styles.sectionLabel}>ভিজিট করা সাইট</div>
            <div style={styles.domainGrid}>
              {sortedDomains.length === 0 && (
                <div style={styles.emptySmall}>আজ কোনো কার্যক্রম রেকর্ড হয়নি।</div>
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
            <div style={styles.sectionLabel}>স্ক্রিনশট (সর্বশেষ)</div>
            {screenshots.length === 0 ? (
              <div style={styles.emptySmall}>এখনো কোনো স্ক্রিনশট নেওয়া হয়নি।</div>
            ) : (
              <div style={styles.screenshotGrid}>
                {screenshots.map((shot) => (
                  <div key={shot.id} style={styles.screenshotCard}>
                    {screenshotUrls[shot.id] ? (
                      <img
                        src={screenshotUrls[shot.id]}
                        alt={shot.active_domain}
                        style={styles.screenshotImg}
                      />
                    ) : (
                      <div style={styles.screenshotPlaceholder} />
                    )}
                    <div style={styles.screenshotMeta}>
                      <span style={styles.screenshotDomain}>{shot.active_domain || "—"}</span>
                      <span style={styles.screenshotTime} className="mono">
                        {formatTime(shot.captured_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.section}>
            <div style={styles.sectionLabel}>টাইমলাইন</div>
            <div style={styles.timeline}>
              {activities.map((a) => (
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
  );
}

const styles = {
  wrap: { padding: "24px 28px", flex: 1, overflowY: "auto" },
  headRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  h2: { fontSize: 20, color: "var(--text)", marginBottom: 4 },
  email: { fontSize: 12.5, color: "var(--text-dim)" },
  totalBadge: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    padding: "10px 16px",
    textAlign: "right",
  },
  totalLabel: { display: "block", fontSize: 11, color: "var(--text-dim)", marginBottom: 4 },
  totalValue: { fontSize: 18, fontWeight: 600, color: "var(--amber)" },
  section: { marginBottom: 26 },
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
  screenshotGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 10,
  },
  screenshotCard: {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    overflow: "hidden",
  },
  screenshotImg: { width: "100%", height: 100, objectFit: "cover", display: "block" },
  screenshotPlaceholder: { width: "100%", height: 100, background: "var(--panel-raised)" },
  screenshotMeta: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 10px",
    fontSize: 11.5,
  },
  screenshotDomain: {
    color: "var(--text-dim)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 100,
  },
  screenshotTime: { color: "var(--text-faint)" },
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
