import React from "react";
import { formatDuration } from "./utils";

export default function EmployeeSidebar({ employees, selectedId, onSelect, totalsToday }) {
  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={styles.headerLabel}>টিম</span>
        <span style={styles.headerCount}>{employees.length}</span>
      </div>
      <div style={styles.list}>
        <button
          style={{
            ...styles.row,
            ...(selectedId === null ? styles.rowActive : {}),
          }}
          onClick={() => onSelect(null)}
        >
          <span style={styles.rowName}>সবাই — সারসংক্ষেপ</span>
        </button>
        {employees.map((emp) => {
          const secs = totalsToday[emp.id] || 0;
          const isOnline = secs > 0;
          return (
            <button
              key={emp.id}
              style={{
                ...styles.row,
                ...(selectedId === emp.id ? styles.rowActive : {}),
              }}
              onClick={() => onSelect(emp.id)}
            >
              <div style={styles.rowTop}>
                <span
                  style={{
                    ...styles.dot,
                    background: isOnline ? "var(--green)" : "var(--text-faint)",
                  }}
                />
                <span style={styles.rowName}>{emp.full_name}</span>
              </div>
              <span style={styles.rowTime} className="mono">
                {formatDuration(secs)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    width: 240,
    flexShrink: 0,
    borderRight: "1px solid var(--line)",
    height: "100%",
    overflowY: "auto",
    paddingTop: 8,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 16px",
    color: "var(--text-dim)",
    fontSize: 11.5,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  headerCount: { color: "var(--text-faint)" },
  list: { display: "flex", flexDirection: "column", padding: "4px 8px", gap: 2 },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "transparent",
    border: "none",
    borderRadius: 8,
    padding: "10px 10px",
    color: "var(--text)",
    textAlign: "left",
    fontSize: 13.5,
  },
  rowActive: {
    background: "var(--panel-raised)",
  },
  rowTop: { display: "flex", alignItems: "center", gap: 8 },
  dot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
  rowName: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rowTime: { color: "var(--text-dim)", fontSize: 12 },
};
