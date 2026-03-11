import { useState, useRef, useEffect } from "react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const COLORS = ["#4CAF8C", "#5B8FD4", "#D4845B", "#9B6FD4", "#D4C25B", "#D45B8A"];
const PX_PER_MIN = 2.2;
const START_HOUR = 7;
const START_MINUTE = 30;
const END_HOUR = 17;
const END_MINUTE = 30;
const TOTAL_MINS = (END_HOUR * 60 + END_MINUTE) - (START_HOUR * 60 + START_MINUTE);

const SLOT_NUMBERS = [1, 2, 3, 4, 5, 6];
const SLOT_LETTERS = ["A", "B", "C", "D"];

const TIME_OPTIONS = (() => {
  const opts = [];
  let cur = START_HOUR * 60 + START_MINUTE;
  const end = END_HOUR * 60 + END_MINUTE;
  while (cur <= end) { opts.push({ hour: Math.floor(cur / 60), minute: cur % 60 }); cur += 5; }
  return opts;
})();

const toMinutes = (hour, minute) => hour * 60 + minute;
const fromMinutes = (mins) => ({ hour: Math.floor(mins / 60), minute: mins % 60 });
const DAY_START = toMinutes(START_HOUR, START_MINUTE);
const DAY_END = toMinutes(END_HOUR, END_MINUTE);

const formatTime = (hour, minute = 0) => {
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const m = minute.toString().padStart(2, "0");
  return `${h}:${m} ${hour >= 12 ? "PM" : "AM"}`;
};

const parseTimeInput = (val) => {
  val = val.trim().toUpperCase().replace(/\s+/g, " ");
  const match = val.match(/^(\d{1,2}):?(\d{0,2})\s*(AM|PM)?$/);
  if (!match) return null;
  let hour = parseInt(match[1]);
  let minute = match[2] ? parseInt(match[2]) || 0 : 0;
  minute = Math.round(minute / 5) * 5;
  if (minute === 60) { minute = 0; hour++; }
  const ampm = match[3];
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  if (toMinutes(hour, minute) < DAY_START || toMinutes(hour, minute) > DAY_END) return null;
  return { hour, minute };
};

const getWeekStart = (offset = 0) => {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getWeekDates = (weekOffset = 0) => {
  const monday = getWeekStart(weekOffset);
  return DAYS.map((_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
};

const formatDate = (date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const layoutAppts = (appts) => {
  const sorted = [...appts].sort((a, b) => toMinutes(a.hour, a.minute) - toMinutes(b.hour, b.minute));
  const columns = [];
  const result = [];
  for (const appt of sorted) {
    const start = toMinutes(appt.hour, appt.minute), end = start + appt.duration;
    let placed = false;
    for (let col = 0; col < columns.length; col++) {
      if (columns[col] <= start) { columns[col] = end; result.push({ ...appt, col }); placed = true; break; }
    }
    if (!placed) { columns.push(end); result.push({ ...appt, col: columns.length - 1 }); }
  }
  for (let i = 0; i < result.length; i++) {
    const s = toMinutes(result[i].hour, result[i].minute), e = s + result[i].duration;
    let maxCol = result[i].col;
    for (let j = 0; j < result.length; j++) {
      const s2 = toMinutes(result[j].hour, result[j].minute), e2 = s2 + result[j].duration;
      if (s2 < e && e2 > s && !(s2 === e || e2 === s)) maxCol = Math.max(maxCol, result[j].col);
    }
    result[i].totalCols = maxCol + 1;
  }
  return result;
};

const getOpenSlots = (appts, day) => {
  const sorted = [...appts].sort((a, b) => toMinutes(a.hour, a.minute) - toMinutes(b.hour, b.minute));
  const slots = [];
  let cursor = DAY_START;
  for (const appt of sorted) {
    const apptStart = toMinutes(appt.hour, appt.minute);
    if (apptStart > cursor) slots.push({ day, startMins: cursor, endMins: apptStart });
    cursor = Math.max(cursor, apptStart + appt.duration);
  }
  if (cursor < DAY_END) slots.push({ day, startMins: cursor, endMins: DAY_END });
  return slots;
};

const STORAGE_KEY = "pt-scheduler-appointments";

const loadAppointments = async () => {
  try {
    const result = await window.storage.get(STORAGE_KEY);
    return result ? JSON.parse(result.value) : [];
  } catch { return []; }
};

const saveAppointments = async (appts) => {
  try { await window.storage.set(STORAGE_KEY, JSON.stringify(appts)); } catch {}
};

function TimeDropdown({ value, onChange, error }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(value || "");
  const ref = useRef();
  const listRef = useRef();
  useEffect(() => { setTyped(value || ""); }, [value]);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  useEffect(() => {
    if (open && listRef.current) {
      const sel = listRef.current.querySelector("[data-selected='true']");
      if (sel) sel.scrollIntoView({ block: "center" });
    }
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ display: "flex", border: `1.5px solid ${error ? "#D45B5B" : open ? "#4CAF8C" : "#E8E3DC"}`, borderRadius: 8, background: "#FAFAF8", overflow: "hidden" }}>
        <input value={typed} onChange={e => { setTyped(e.target.value); onChange(e.target.value); }} onFocus={() => setOpen(true)}
          placeholder="e.g. 9:00 AM" style={{ flex: 1, padding: "9px 10px", border: "none", background: "transparent", fontSize: 13, color: "#1a1a1a", outline: "none", fontFamily: "inherit" }} />
        <button type="button" onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }}
          style={{ padding: "0 10px", background: "none", border: "none", cursor: "pointer", color: "#A09A92", fontSize: 11, flexShrink: 0 }}>{open ? "▲" : "▼"}</button>
      </div>
      {open && (
        <div ref={listRef} style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #E8E3DC", borderRadius: 8, height: 200, overflowY: "auto", zIndex: 300, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
          {TIME_OPTIONS.map(opt => {
            const label = formatTime(opt.hour, opt.minute);
            const isSelected = label === typed;
            return (
              <div key={`${opt.hour}-${opt.minute}`} data-selected={isSelected}
                onMouseDown={() => { setTyped(label); onChange(label); setOpen(false); }}
                style={{ padding: "7px 12px", fontSize: 13, cursor: "pointer", color: isSelected ? "#fff" : "#1a1a1a", background: isSelected ? "#4CAF8C" : "transparent", fontWeight: isSelected ? 600 : 400 }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#F0EDE8"; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>
                {label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdditionalPatients({ patients = [], onChange }) {
  const [input, setInput] = useState("");
  const add = () => { const t = input.trim(); if (!t || patients.includes(t)) return; onChange([...patients, t]); setInput(""); };
  const remove = (name) => onChange(patients.filter(p => p !== name));
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Add patient name…" style={{ flex: 1, padding: "8px 11px", border: "1.5px solid #E8E3DC", borderRadius: 8, fontSize: 13, color: "#1a1a1a", background: "#FAFAF8", outline: "none", fontFamily: "inherit" }}
          onFocus={e => e.target.style.borderColor = "#4CAF8C"} onBlur={e => e.target.style.borderColor = "#E8E3DC"} />
        <button type="button" onClick={add} style={{ padding: "8px 14px", background: "#4CAF8C", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Add</button>
      </div>
      {patients.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {patients.map(p => (
            <div key={p} style={{ display: "flex", alignItems: "center", gap: 5, background: "#EEF4FF", borderRadius: 20, padding: "4px 10px 4px 12px", fontSize: 12, color: "#5B8FD4", fontWeight: 500 }}>
              {p}<button onClick={() => remove(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "#5B8FD4", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SlotSelector({ selected = [], onChange }) {
  const toggle = (val) => {
    const s = String(val);
    onChange(selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s]);
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {SLOT_NUMBERS.map(n => {
        const s = String(n), active = selected.includes(s);
        return <button key={s} type="button" onClick={() => toggle(s)} style={{ width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${active ? "#4CAF8C" : "#E8E3DC"}`, background: active ? "#4CAF8C" : "#FAFAF8", color: active ? "#fff" : "#555", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>{n}</button>;
      })}
      <div style={{ width: 1, background: "#E8E3DC", margin: "0 4px" }} />
      {SLOT_LETTERS.map(l => {
        const active = selected.includes(l);
        return <button key={l} type="button" onClick={() => toggle(l)} style={{ width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${active ? "#5B8FD4" : "#E8E3DC"}`, background: active ? "#5B8FD4" : "#FAFAF8", color: active ? "#fff" : "#555", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>{l}</button>;
      })}
    </div>
  );
}

export default function PTScheduler() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [nextId, setNextId] = useState(1);
  const [activeDay, setActiveDay] = useState("Monday");
  const [view, setView] = useState("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [startError, setStartError] = useState("");
  const [endError, setEndError] = useState("");
  const [detailAppt, setDetailAppt] = useState(null);
  const [openSlotsExpanded, setOpenSlotsExpanded] = useState(true);

  // Load from storage on mount
  useEffect(() => {
    loadAppointments().then(appts => {
      setAppointments(appts);
      if (appts.length > 0) setNextId(Math.max(...appts.map(a => a.id)) + 1);
      setLoading(false);
    });
  }, []);

  // Save to storage whenever appointments change
  useEffect(() => {
    if (!loading) saveAppointments(appointments);
  }, [appointments, loading]);

  const weekDates = getWeekDates(weekOffset);
  const weekStart = getWeekStart(weekOffset);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 4);
  const isCurrentWeek = weekOffset === 0;
  const weekLabel = isCurrentWeek ? "This Week" : weekOffset === 1 ? "Next Week" : weekOffset === -1 ? "Last Week" : `${formatDate(weekStart)} – ${formatDate(weekEnd)}`;

  const visibleAppointments = appointments.filter(a =>
    a.recurring ? true : (a.weekOffset === undefined ? weekOffset === 0 : a.weekOffset === weekOffset)
  );

  const openAdd = (day = activeDay, startMins = null, endMins = null) => {
    const defStart = DAY_START + 60;
    const sM = startMins !== null ? Math.round(startMins / 5) * 5 : defStart;
    const eM = endMins !== null ? Math.round(endMins / 5) * 5 : Math.min(sM + 60, DAY_END);
    const start = fromMinutes(sM), end = fromMinutes(eM);
    setForm({ name: "", additionalPatients: [], day, hour: start.hour, minute: start.minute, duration: eM - sM, color: COLORS[Math.floor(Math.random() * COLORS.length)], recurring: false, location: "", info: "", slots: [] });
    setStartInput(formatTime(start.hour, start.minute));
    setEndInput(formatTime(end.hour, end.minute));
    setStartError(""); setEndError("");
    setModal({ mode: "add" });
  };

  const openEdit = (appt) => {
    const end = fromMinutes(toMinutes(appt.hour, appt.minute) + appt.duration);
    setForm({ ...appt, additionalPatients: appt.additionalPatients || [], slots: appt.slots || [] });
    setStartInput(formatTime(appt.hour, appt.minute));
    setEndInput(formatTime(end.hour, end.minute));
    setStartError(""); setEndError("");
    setModal({ mode: "edit", appt });
    setDetailAppt(null);
  };

  const validateAndSave = () => {
    let valid = true;
    const start = parseTimeInput(startInput), end = parseTimeInput(endInput);
    if (!start) { setStartError("Enter a valid start time"); valid = false; } else setStartError("");
    if (!end) { setEndError("Enter a valid end time"); valid = false; } else setEndError("");
    if (start && end && toMinutes(end.hour, end.minute) <= toMinutes(start.hour, start.minute)) { setEndError("End must be after start"); valid = false; }
    if (!form.name?.trim()) valid = false;
    if (!valid) return;
    const duration = toMinutes(end.hour, end.minute) - toMinutes(start.hour, start.minute);
    const finalForm = { ...form, hour: start.hour, minute: start.minute, duration, name: form.name.trim() };
    if (modal.mode === "add") {
      setAppointments(prev => [...prev, { ...finalForm, id: nextId, weekOffset: finalForm.recurring ? undefined : weekOffset }]);
      setNextId(n => n + 1);
    } else {
      setAppointments(prev => prev.map(a => a.id === modal.appt.id ? { ...finalForm, id: a.id, weekOffset: finalForm.recurring ? undefined : weekOffset } : a));
    }
    setModal(null);
  };

  const deleteAppt = (id) => { setAppointments(prev => prev.filter(a => a.id !== id)); setDeleteConfirm(null); setModal(null); setDetailAppt(null); };

  const dayAppts = (day) => visibleAppointments.filter(a => a.day === day);
  const displayDays = view === "week" ? DAYS : [activeDay];
  const allOpenSlots = DAYS.flatMap(day => getOpenSlots(dayAppts(day), day));

  const GRID_HEIGHT = TOTAL_MINS * PX_PER_MIN;
  const labelStyle = { fontSize: 11, fontWeight: 600, color: "#7A8490", display: "block", marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase" };
  const inputBase = { width: "100%", padding: "9px 12px", border: "1.5px solid #E8E3DC", borderRadius: 8, fontSize: 13, color: "#1a1a1a", background: "#FAFAF8", outline: "none", fontFamily: "inherit" };

  const halfHourLabels = [];
  for (let m = DAY_START; m <= DAY_END; m += 30) halfHourLabels.push(fromMinutes(m));

  const handlePrint = () => window.print();

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "'DM Sans',sans-serif", color: "#888", fontSize: 14 }}>
      Loading schedule…
    </div>
  );

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", background: "#F0EDE8", color: "#1a1a1a" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@600&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #c8c0b5; border-radius: 3px; }
        .appt-block { transition: transform 0.12s, box-shadow 0.12s; cursor: pointer; }
        .appt-block:hover { transform: scale(1.012); box-shadow: 0 4px 16px rgba(0,0,0,0.15); z-index: 10 !important; }
        .btn { transition: all 0.15s; cursor: pointer; border: none; font-family: inherit; }
        .btn:hover { opacity: 0.85; }
        .modal-overlay { animation: fadeIn 0.18s ease; }
        .modal-box { animation: slideUp 0.22s ease; }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        input, select, textarea { font-family: inherit; color: #1a1a1a; }
        input::placeholder, textarea::placeholder { color: #B0A89E; }
        .open-slot-row:hover { background: #F0F7FF !important; }

        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-container { padding: 0 !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .print-only { display: none; }
      `}</style>

      {/* Print header (only shows when printing) */}
      <div className="print-only" style={{ padding: "16px 28px 8px", borderBottom: "2px solid #1C2B3A", marginBottom: 16 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: "#1C2B3A" }}>PT Scheduler — Weekly Schedule</div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 3 }}>{weekLabel} · Printed {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
      </div>

      {/* Header */}
      <div className="no-print" style={{ background: "#1C2B3A", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#4CAF8C,#5B8FD4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🩺</div>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, color: "#fff" }}>PT Scheduler</div>
            <div style={{ fontSize: 10, color: "#7A9BB5", letterSpacing: 0.5 }}>Physical Therapy Practice</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#2A3E51", borderRadius: 8, padding: "5px 10px" }}>
            <button className="btn" onClick={() => setWeekOffset(w => w - 1)} style={{ background: "none", color: "#7A9BB5", fontSize: 15, padding: "0 3px" }}>‹</button>
            <span style={{ fontSize: 12, color: "#fff", fontWeight: 500, minWidth: 86, textAlign: "center" }}>{weekLabel}</span>
            <button className="btn" onClick={() => setWeekOffset(w => w + 1)} style={{ background: "none", color: "#7A9BB5", fontSize: 15, padding: "0 3px" }}>›</button>
          </div>
          {!isCurrentWeek && <button className="btn" onClick={() => setWeekOffset(0)} style={{ background: "#2A3E51", color: "#7A9BB5", padding: "6px 10px", borderRadius: 8, fontSize: 11 }}>Today</button>}
          <div style={{ display: "flex", background: "#2A3E51", borderRadius: 8, padding: 3 }}>
            {["week", "day"].map(v => (
              <button key={v} className="btn" onClick={() => setView(v)} style={{ padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: view === v ? "#4CAF8C" : "transparent", color: view === v ? "#fff" : "#7A9BB5", border: "none" }}>{v === "week" ? "Week" : "Day"}</button>
            ))}
          </div>
          <button className="btn" onClick={handlePrint} style={{ background: "#2A3E51", color: "#7A9BB5", padding: "7px 14px", borderRadius: 8, fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
            🖨️ Print
          </button>
          <button className="btn" onClick={() => openAdd(activeDay)} style={{ background: "#4CAF8C", color: "#fff", padding: "7px 16px", borderRadius: 8, fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 15 }}>+</span> New Appointment
          </button>
        </div>
      </div>

      {/* Day tabs */}
      <div className={view === "day" ? "" : "no-print"} style={{ display: view === "day" ? "block" : "none" }}>
        <div style={{ background: "#fff", borderBottom: "1px solid #E8E3DC", display: "flex", padding: "0 28px", overflowX: "auto" }}>
          {DAYS.map((day, i) => {
            const count = dayAppts(day).length;
            const date = weekDates[i];
            const isToday = isCurrentWeek && date.toDateString() === new Date().toDateString();
            return (
              <button key={day} className="btn" onClick={() => setActiveDay(day)} style={{ padding: "10px 16px", fontSize: 12, fontWeight: 600, border: "none", background: "transparent", borderBottom: activeDay === day ? "2px solid #4CAF8C" : "2px solid transparent", color: activeDay === day ? "#4CAF8C" : "#888", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
                <span>{day.slice(0, 3)}</span>
                <span style={{ fontSize: 10, color: isToday ? "#4CAF8C" : "#aaa", fontWeight: isToday ? 700 : 400 }}>{formatDate(date)}</span>
                {count > 0 && <span style={{ background: activeDay === day ? "#4CAF8C" : "#ddd", color: activeDay === day ? "#fff" : "#888", borderRadius: 10, padding: "1px 6px", fontSize: 10 }}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendar */}
      <div className="print-container" style={{ padding: "20px 28px", overflowX: "auto" }}>
        <div style={{ display: "flex", minWidth: view === "week" ? 860 : 480 }}>
          {/* Time axis */}
          <div style={{ width: 62, flexShrink: 0, marginTop: 52 }}>
            <div style={{ position: "relative", height: GRID_HEIGHT }}>
              {halfHourLabels.map((t, i) => (
                <div key={i} style={{ position: "absolute", top: i * 30 * PX_PER_MIN - 7, right: 8, fontSize: 10, color: i % 2 === 0 ? "#888" : "#B0A89E", fontWeight: i % 2 === 0 ? 600 : 400, whiteSpace: "nowrap" }}>
                  {formatTime(t.hour, t.minute)}
                </div>
              ))}
            </div>
          </div>

          {/* Day columns */}
          {displayDays.map((day, i) => {
            const appts = dayAppts(day);
            const laid = layoutAppts(appts);
            const dateIndex = view === "week" ? i : DAYS.indexOf(activeDay);
            const date = weekDates[dateIndex];
            const isToday = isCurrentWeek && date.toDateString() === new Date().toDateString();

            return (
              <div key={day} style={{ flex: 1, minWidth: 0, marginLeft: 6 }}>
                <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", paddingRight: 2, paddingBottom: 4 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isToday ? "#4CAF8C" : "#1C2B3A" }}>{day.slice(0, 3)}</span>
                      <span style={{ fontSize: 11, color: isToday ? "#4CAF8C" : "#A09A92", background: isToday ? "#E8F5EF" : "transparent", borderRadius: 5, padding: isToday ? "1px 5px" : 0, fontWeight: isToday ? 600 : 400 }}>{formatDate(date)}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#A09A92", marginTop: 1 }}>{appts.length} appt{appts.length !== 1 ? "s" : ""}</div>
                  </div>
                  <button className="btn no-print" onClick={() => openAdd(day)} style={{ background: "#E8F5EF", color: "#4CAF8C", border: "none", width: 22, height: 22, borderRadius: 5, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>+</button>
                </div>

                <div style={{ position: "relative", background: "#fff", borderRadius: 10, border: "1px solid #E8E3DC", overflow: "hidden", height: GRID_HEIGHT, cursor: "crosshair" }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const clickedMins = DAY_START + Math.round(y / PX_PER_MIN / 5) * 5;
                    openAdd(day, clickedMins, Math.min(clickedMins + 60, DAY_END));
                  }}>
                  {halfHourLabels.map((_, idx) => {
                    const top = idx * 30 * PX_PER_MIN;
                    const isHour = idx % 2 === 0;
                    return <div key={idx} style={{ position: "absolute", top, left: 0, right: 0, borderTop: idx === 0 ? "none" : `1px ${isHour ? "solid" : "dashed"} ${isHour ? "#EDE9E3" : "#F3F0EB"}`, pointerEvents: "none" }} />;
                  })}

                  {/* Empty state per column */}
                  {appts.length === 0 && (
                    <div className="no-print" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                      <div style={{ fontSize: 11, color: "#C8C0B8", textAlign: "center" }}>Click to add</div>
                    </div>
                  )}

                  {laid.map(appt => {
                    const top = (toMinutes(appt.hour, appt.minute) - DAY_START) * PX_PER_MIN;
                    const height = appt.duration * PX_PER_MIN;
                    const endT = fromMinutes(toMinutes(appt.hour, appt.minute) + appt.duration);
                    const colW = 100 / appt.totalCols;
                    const allPatients = [appt.name, ...(appt.additionalPatients || [])];
                    const apptSlots = appt.slots || [];
                    return (
                      <div key={appt.id} className="appt-block"
                        onClick={e => { e.stopPropagation(); setDetailAppt(appt); }}
                        style={{ position: "absolute", top, left: `calc(${appt.col * colW}% + 2px)`, width: `calc(${colW}% - 4px)`, height, background: appt.color + "1E", borderLeft: `3px solid ${appt.color}`, borderRadius: 5, padding: "5px 7px", overflow: "hidden", zIndex: 2 }}>
                        <div style={{ fontSize: 10, color: appt.color, fontWeight: 700, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {formatTime(appt.hour, appt.minute)} – {formatTime(endT.hour, endT.minute)} {appt.recurring ? "🔁" : ""}
                        </div>
                        {allPatients.map((p, pi) => (
                          <div key={pi} style={{ fontSize: 11, fontWeight: pi === 0 ? 700 : 500, color: pi === 0 ? "#1C2B3A" : "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.4 }}>
                            {pi > 0 ? "+ " : ""}{p}
                          </div>
                        ))}
                        {appt.location && <div style={{ fontSize: 9.5, color: "#888", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>📍 {appt.location}</div>}
                        {apptSlots.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginTop: 3 }}>
                            {apptSlots.map(s => <span key={s} style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: isNaN(s) ? "#5B8FD4" : "#4CAF8C", color: "#fff" }}>{s}</span>)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Open Appointment Slots */}
      <div className="no-print" style={{ padding: "0 28px 16px" }}>
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8E3DC", overflow: "hidden" }}>
          <div onClick={() => setOpenSlotsExpanded(e => !e)} style={{ padding: "14px 18px", borderBottom: openSlotsExpanded ? "1px solid #F3EFE9" : "none", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>🕐</span>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#1C2B3A" }}>Open Appointment Slots</div>
              <span style={{ background: "#EEF4FF", color: "#5B8FD4", borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{allOpenSlots.length}</span>
            </div>
            <span style={{ color: "#A09A92", fontSize: 12 }}>{openSlotsExpanded ? "▲" : "▼"}</span>
          </div>
          {openSlotsExpanded && (
            <div>
              {allOpenSlots.length === 0
                ? <div style={{ padding: 24, textAlign: "center", color: "#A09A92", fontSize: 13 }}>No open slots — schedule is fully booked!</div>
                : DAYS.map(day => {
                  const slots = allOpenSlots.filter(s => s.day === day);
                  if (!slots.length) return null;
                  return (
                    <div key={day}>
                      <div style={{ padding: "8px 18px 4px", fontSize: 10, fontWeight: 700, color: "#A09A92", letterSpacing: 0.6, textTransform: "uppercase", background: "#FAFAF8", borderTop: "1px solid #F3EFE9" }}>{day}</div>
                      {slots.map((slot, si) => {
                        const duration = slot.endMins - slot.startMins;
                        const start = fromMinutes(slot.startMins), end = fromMinutes(slot.endMins);
                        return (
                          <div key={si} className="open-slot-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 18px", borderTop: "1px solid #F7F5F2", background: "#fff", transition: "background 0.15s" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div style={{ width: 3, height: 28, borderRadius: 2, background: "#E0DBD4" }} />
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "#1C2B3A" }}>{formatTime(start.hour, start.minute)} – {formatTime(end.hour, end.minute)}</div>
                                <div style={{ fontSize: 11, color: "#A09A92" }}>{duration} min available</div>
                              </div>
                            </div>
                            <button className="btn" onClick={() => openAdd(slot.day, slot.startMins, slot.endMins)}
                              style={{ background: "#E8F5EF", color: "#4CAF8C", border: "1.5px solid #C8E8D8", borderRadius: 7, padding: "6px 12px", fontWeight: 600, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: 13 }}>+</span> Add Appointment
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              }
            </div>
          )}
        </div>
      </div>

      {/* Appointments list */}
      <div className="no-print" style={{ padding: "0 28px 28px" }}>
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8E3DC", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #F3EFE9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#1C2B3A" }}>{weekLabel} — Appointments</div>
            <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#A09A92" }}>
              <span>🔁 {visibleAppointments.filter(a => a.recurring).length} recurring</span>
              <span>📅 {visibleAppointments.filter(a => !a.recurring).length} one-time</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 1, background: "#F3EFE9" }}>
            {visibleAppointments.length === 0
              ? <div style={{ gridColumn: "1/-1", padding: 28, textAlign: "center", color: "#A09A92", fontSize: 13 }}>No appointments this week. Click <strong>+ New Appointment</strong> to get started.</div>
              : [...visibleAppointments].sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || toMinutes(a.hour, a.minute) - toMinutes(b.hour, b.minute)).map(appt => {
                const endT = fromMinutes(toMinutes(appt.hour, appt.minute) + appt.duration);
                const extras = appt.additionalPatients?.length || 0;
                return (
                  <div key={appt.id} style={{ background: "#fff", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setDetailAppt(appt)}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: appt.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                        {appt.name}
                        {extras > 0 && <span style={{ fontSize: 10, color: "#5B8FD4", fontWeight: 500 }}>+{extras}</span>}
                        {(appt.slots || []).map(s => <span key={s} style={{ fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: isNaN(s) ? "#5B8FD4" : "#4CAF8C", color: "#fff" }}>{s}</span>)}
                        {appt.recurring && <span>🔁</span>}
                      </div>
                      <div style={{ fontSize: 10, color: "#A09A92" }}>{appt.day} · {formatTime(appt.hour, appt.minute)} – {formatTime(endT.hour, endT.minute)}{appt.location ? ` · ${appt.location}` : ""}</div>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>
      </div>

      {/* Detail popover */}
      {detailAppt && (() => {
        const endT = fromMinutes(toMinutes(detailAppt.hour, detailAppt.minute) + detailAppt.duration);
        return (
          <div className="modal-overlay no-print" onClick={() => setDetailAppt(null)} style={{ position: "fixed", inset: 0, background: "rgba(28,43,58,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 900, padding: 20 }}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 20px 50px rgba(0,0,0,0.18)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: detailAppt.color, flexShrink: 0, marginTop: 4 }} />
                  <div>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: "#1C2B3A" }}>{detailAppt.name}</div>
                    {(detailAppt.additionalPatients || []).map((p, i) => <div key={i} style={{ fontSize: 12, color: "#5B8FD4", fontWeight: 500, marginTop: 1 }}>+ {p}</div>)}
                    {(detailAppt.slots || []).length > 0 && (
                      <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                        {detailAppt.slots.map(s => <span key={s} style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: isNaN(s) ? "#5B8FD4" : "#4CAF8C", color: "#fff" }}>{s}</span>)}
                      </div>
                    )}
                  </div>
                </div>
                <button className="btn" onClick={() => setDetailAppt(null)} style={{ background: "#F3EFE9", border: "none", width: 26, height: 26, borderRadius: 7, fontSize: 14, color: "#888", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "#555" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ fontSize: 14 }}>📅</span><span>{detailAppt.day} · {formatDate(weekDates[DAYS.indexOf(detailAppt.day)])}</span></div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ fontSize: 14 }}>🕐</span><span>{formatTime(detailAppt.hour, detailAppt.minute)} – {formatTime(endT.hour, endT.minute)} ({detailAppt.duration} min)</span></div>
                {detailAppt.location && <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ fontSize: 14 }}>📍</span><span>{detailAppt.location}</span></div>}
                {detailAppt.recurring && <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ fontSize: 14 }}>🔁</span><span>Recurring every week</span></div>}
                {detailAppt.info && <div style={{ marginTop: 4, padding: "10px 12px", background: "#F8F6F3", borderRadius: 8, fontSize: 12, color: "#555", lineHeight: 1.5 }}>{detailAppt.info}</div>}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <button className="btn" onClick={() => setDeleteConfirm(detailAppt.id)} style={{ flex: 1, padding: 9, background: "#FFF0EE", color: "#D45B5B", border: "1.5px solid #F5CECE", borderRadius: 8, fontWeight: 600, fontSize: 12 }}>Delete</button>
                <button className="btn" onClick={() => openEdit(detailAppt)} style={{ flex: 2, padding: 9, background: "#4CAF8C", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 12 }}>Edit</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-overlay no-print" onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(28,43,58,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 26, width: "100%", maxWidth: 480, boxShadow: "0 24px 60px rgba(0,0,0,0.2)", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 19, color: "#1C2B3A" }}>{modal.mode === "add" ? "New Appointment" : "Edit Appointment"}</div>
              <button className="btn" onClick={() => setModal(null)} style={{ background: "#F3EFE9", border: "none", width: 28, height: 28, borderRadius: 7, fontSize: 15, color: "#888", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Primary Patient *</label>
              <input value={form.name || ""} placeholder="Full name" onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                style={inputBase} onFocus={e => e.target.style.borderColor = "#4CAF8C"} onBlur={e => e.target.style.borderColor = "#E8E3DC"} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Additional Patients <span style={{ color: "#B0A89E", fontWeight: 400, textTransform: "none", fontSize: 10 }}>(optional)</span></label>
              <AdditionalPatients patients={form.additionalPatients || []} onChange={pts => setForm(f => ({ ...f, additionalPatients: pts }))} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Day *</label>
              <select value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value }))} style={{ ...inputBase, appearance: "none" }}>
                {DAYS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
              <div>
                <label style={labelStyle}>Start Time *</label>
                <TimeDropdown value={startInput} onChange={v => { setStartInput(v); setStartError(""); }} error={startError} />
                {startError && <div style={{ fontSize: 10, color: "#D45B5B", marginTop: 4 }}>{startError}</div>}
              </div>
              <div>
                <label style={labelStyle}>End Time *</label>
                <TimeDropdown value={endInput} onChange={v => { setEndInput(v); setEndError(""); }} error={endError} />
                {endError && <div style={{ fontSize: 10, color: "#D45B5B", marginTop: 4 }}>{endError}</div>}
              </div>
            </div>

            <div style={{ marginBottom: 14, marginTop: 14 }}>
              <label style={labelStyle}>Location <span style={{ color: "#B0A89E", fontWeight: 400, textTransform: "none", fontSize: 10 }}>(optional)</span></label>
              <input value={form.location || ""} placeholder="e.g. Room 1, Gym, Telehealth" onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                style={inputBase} onFocus={e => e.target.style.borderColor = "#4CAF8C"} onBlur={e => e.target.style.borderColor = "#E8E3DC"} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Appointment Info <span style={{ color: "#B0A89E", fontWeight: 400, textTransform: "none", fontSize: 10 }}>(optional)</span></label>
              <textarea value={form.info || ""} placeholder="Notes, treatment details, goals..." rows={3}
                onChange={e => setForm(f => ({ ...f, info: e.target.value }))}
                style={{ ...inputBase, resize: "vertical", lineHeight: 1.5 }}
                onFocus={e => e.target.style.borderColor = "#4CAF8C"} onBlur={e => e.target.style.borderColor = "#E8E3DC"} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Slot Labels <span style={{ color: "#B0A89E", fontWeight: 400, textTransform: "none", fontSize: 10 }}>(optional)</span></label>
              <SlotSelector selected={form.slots || []} onChange={s => setForm(f => ({ ...f, slots: s }))} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Color</label>
              <div style={{ display: "flex", gap: 8 }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer", border: form.color === c ? "3px solid #1C2B3A" : "3px solid transparent", transition: "border 0.15s" }} />
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 22, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F8F6F3", borderRadius: 9, padding: "11px 14px" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1C2B3A" }}>Recurring appointment</div>
                <div style={{ fontSize: 10, color: "#A09A92", marginTop: 1 }}>Shows every week automatically</div>
              </div>
              <div onClick={() => setForm(f => ({ ...f, recurring: !f.recurring }))}
                style={{ width: 42, height: 22, borderRadius: 11, background: form.recurring ? "#4CAF8C" : "#D0CAC3", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                <div style={{ position: "absolute", top: 3, left: form.recurring ? 22 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {modal.mode === "edit" && (
                <button className="btn" onClick={() => setDeleteConfirm(modal.appt.id)} style={{ flex: 1, padding: 10, background: "#FFF0EE", color: "#D45B5B", border: "1.5px solid #F5CECE", borderRadius: 8, fontWeight: 600, fontSize: 12 }}>Delete</button>
              )}
              <button className="btn" onClick={validateAndSave} disabled={!form.name?.trim()} style={{ flex: 2, padding: 10, background: form.name?.trim() ? "#4CAF8C" : "#c8e6da", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 12 }}>
                {modal.mode === "add" ? "Add Appointment" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-overlay no-print" style={{ position: "fixed", inset: 0, background: "rgba(28,43,58,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 20 }}>
          <div className="modal-box" style={{ background: "#fff", borderRadius: 14, padding: 26, maxWidth: 340, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🗑️</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, marginBottom: 7 }}>Delete Appointment?</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 22 }}>This action cannot be undone.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn" onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: 10, background: "#F3EFE9", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 12 }}>Cancel</button>
              <button className="btn" onClick={() => deleteAppt(deleteConfirm)} style={{ flex: 1, padding: 10, background: "#D45B5B", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 12 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}