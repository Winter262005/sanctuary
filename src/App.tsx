import React, { useState, useEffect, useRef } from "react";
// Direct import for local system access - will bypass browser sandboxing
import { invoke } from "@tauri-apps/api/core";

const CORE_RULES = [
  "Wake up one hour earlier than usual",
  "Go for a 20-minute walk every day",
  "Eat enough protein and stop skipping meals",
  "Start posting content even if you feel scared",
  "Read 10 pages daily",
  "Journal your thoughts instead of bottling them up",
  "Track where your money is going every week",
  "Start faceless content creation if you're afraid to show your face",
  "Fix your sleep schedule and protect your nights",
  "Drink at least 2 liters of water daily",
  "Reduce mindless scrolling to under 30 minutes",
  "Practice speaking confidently, even when alone",
  "Clean and organize your room and digital space",
  "Surround yourself with growth-focused people online",
  "Stop telling everyone your plans",
  "Set weekly non-negotiable goals",
  "Choose discipline over temporary comfort",
  "Save and invest before you spend",
  "Start building a small income stream online",
  "Dress like the man you are becoming",
  "Stretch your body and improve your posture",
  "Spend time in prayer, meditation, or silence",
  "Learn to say no without over-explaining",
  "Distance yourself from environments that drain you",
  "Track your habits daily",
];

// Security obfuscation for the local storage key
const scramble = (str: string) => btoa(str).split("").reverse().join("");

function App() {
  // --- AUTH STATE ---
  const [isLocked, setIsLocked] = useState(true);
  const [hasMasterKey, setHasMasterKey] = useState(
    () => !!localStorage.getItem("sanctuary_master_key"),
  );
  const [accessKey, setAccessKey] = useState("");
  const [authError, setAuthError] = useState(false);

  // --- VAULT STATE ---
  const [journal, setJournal] = useState("");
  const [fileName, setFileName] = useState("untitled_log");
  const [fileList, setFileList] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRulesExpanded, setIsRulesExpanded] = useState(false);

  // --- MISSION STATE ---
  const [tasks, setTasks] = useState<
    { id: number; text: string; completed: boolean; critical: boolean }[]
  >(() => {
    const saved = localStorage.getItem("sanctuary_tasks");
    return saved ? JSON.parse(saved) : [];
  });
  const [newTask, setNewTask] = useState("");

  // --- SYSTEM STATE ---
  const [time, setTime] = useState(new Date());
  const [systemStatus, setSystemStatus] = useState("INITIALIZING...");
  const isInitialMount = useRef(true);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now);
      // Midnight Reset logic
      if (
        now.getHours() === 0 &&
        now.getMinutes() === 0 &&
        now.getSeconds() === 0
      ) {
        setTasks([]);
        syncTasksToVault([]);
      }
    }, 1000);

    const initSystem = async () => {
      try {
        const status = await invoke("get_system_status");
        setSystemStatus(status as string);

        // Handshake: Pull persistent task manifest from Rust
        try {
          const vaultTasksRaw = await invoke("load_vault_file", {
            name: "__tasks_manifest",
          });
          if (vaultTasksRaw && vaultTasksRaw !== "[]") {
            setTasks(JSON.parse(vaultTasksRaw as string));
          }
        } catch (e) {
          console.warn("Kernel: No task manifest found.");
        }

        refreshFileList();
      } catch (e) {
        setSystemStatus("OFFLINE_MODE");
      }
    };

    initSystem();
    return () => clearInterval(timer);
  }, []);

  // Sync Mission state to both LocalStorage and Rust Backend
  useEffect(() => {
    localStorage.setItem("sanctuary_tasks", JSON.stringify(tasks));
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      syncTasksToVault(tasks);
    }
  }, [tasks]);

  const syncTasksToVault = async (currentTasks: any) => {
    try {
      await invoke("save_vault_file", {
        name: "__tasks_manifest",
        content: JSON.stringify(currentTasks),
      });
    } catch (e) {
      console.error("Mission sync failed.");
    }
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessKey.trim()) return;
    if (!hasMasterKey) {
      localStorage.setItem("sanctuary_master_key", scramble(accessKey));
      setHasMasterKey(true);
      setIsLocked(false);
      setAccessKey("");
    } else {
      const storedKey = localStorage.getItem("sanctuary_master_key");
      if (storedKey && scramble(accessKey) === storedKey) {
        setIsLocked(false);
        setAuthError(false);
        setAccessKey("");
      } else {
        setAuthError(true);
        setAccessKey("");
        setTimeout(() => setAuthError(false), 1000);
      }
    }
  };

  const refreshFileList = async () => {
    try {
      const files = await invoke("get_vault_files");
      const filtered = (files as string[]).filter(
        (f) => f !== "__tasks_manifest",
      );
      setFileList(filtered);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveFile = async () => {
    if (!fileName.trim()) return;
    setIsSyncing(true);
    try {
      await invoke("save_vault_file", { name: fileName, content: journal });
      await refreshFileList();
      setTimeout(() => setIsSyncing(false), 800);
    } catch (e) {
      setIsSyncing(false);
    }
  };

  const handleLoadFile = async (name: string) => {
    try {
      const content = await invoke("load_vault_file", { name });
      setJournal(content as string);
      setFileName(name);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteFile = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    try {
      await invoke("delete_vault_file", { name });
      if (fileName === name) {
        setFileName("untitled_log");
        setJournal("");
      }
      await refreshFileList();
    } catch (e) {
      console.error(e);
    }
  };

  const createNewFile = () => {
    setJournal("");
    setFileName(`log_${new Date().getTime().toString().slice(-4)}`);
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    setTasks([
      ...tasks,
      {
        id: Date.now(),
        text: newTask,
        completed: false,
        critical: newTask.includes("!"),
      },
    ]);
    setNewTask("");
  };

  const completedTasksCount = tasks.filter((t) => t.completed).length;
  const progressPercent =
    tasks.length > 0 ? (completedTasksCount / tasks.length) * 100 : 0;

  const getTimeToBurn = () => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight.getTime() - now.getTime();
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${h.toString().padStart(2, "0")}H ${m.toString().padStart(2, "0")}M`;
  };

  if (isLocked) {
    return (
      <main className="sanctuary-auth">
        <style>{`
          .sanctuary-auth { height: 100vh; width: 100vw; background: #000; display: flex; align-items: center; justify-content: center; font-family: ui-monospace, monospace; color: #52525b; overflow: hidden; }
          .auth-terminal { 
            width: 360px; padding: 3rem; 
            border: 1px solid #1a1a1a; background: #050505; 
            text-align: center; position: relative;
            animation: pulse-border 4s infinite;
          }
          @keyframes pulse-border { 0%, 100% { border-color: #1a1a1a; } 50% { border-color: #333; } }
          .auth-terminal h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6em; margin-bottom: 2.5rem; color: #3f3f46; }
          .auth-terminal input { 
            width: 100%; background: transparent; border: none; border-bottom: 2px solid #1a1a1a; 
            color: white; text-align: center; padding: 15px 0; outline: none; font-family: inherit; 
            margin-bottom: 2rem; letter-spacing: 0.8em; font-size: 18px; transition: border-color 0.3s;
          }
          .auth-terminal input:focus { border-color: white; }
          .auth-terminal p { font-size: 10px; text-transform: uppercase; color: #27272a; margin: 0; letter-spacing: 0.1em; }
          .error-text { color: #991b1b !important; animation: shake 0.3s ease-in-out; }
          @keyframes shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
        `}</style>
        <div className="auth-terminal">
          <h2>{hasMasterKey ? "TERMINAL_GATE" : "VAULT_INITIALIZE"}</h2>
          <form onSubmit={handleAuthSubmit}>
            <input
              type="password"
              value={accessKey}
              autoFocus
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder={hasMasterKey ? "••••••" : "SET_KEY"}
            />
            <p className={authError ? "error-text" : ""}>
              {hasMasterKey
                ? authError
                  ? "ACCESS_DENIED"
                  : "AWAITING_KEY_SEQUENCE"
                : "ESTABLISH_MASTER_CREDENTIAL"}
            </p>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="sanctuary-root">
      <style>{`
        :root { --bg: #050505; --panel: #0a0a0a; --border: #1a1a1a; --text-dim: #52525b; --text-main: #a1a1aa; --accent: #ffffff; --danger: #ef4444; }
        * { box-sizing: border-box; }
        body, html { margin: 0; padding: 0; background: var(--bg); color: var(--text-main); font-family: ui-monospace, monospace; cursor: crosshair !important; overflow: hidden; height: 100vh; width: 100vw; }
        .sanctuary-root { display: flex; flex-direction: column; height: 100vh; padding: 2rem 3rem; background: var(--bg); }
        
        header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; margin-bottom: 2rem; flex-shrink: 0; }
        .title-block h1 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5em; color: var(--text-dim); margin: 0 0 6px 0; }
        .title-block p { font-size: 2rem; font-weight: 900; color: white; margin: 0; font-style: italic; letter-spacing: -0.05em; text-transform: uppercase; line-height: 1; }
        
        .header-meta { display: flex; align-items: flex-end; gap: 3rem; }
        .lock-btn { font-size: 10px; color: #3f3f46; background: transparent; border: 1px solid #1a1a1a; padding: 4px 12px; cursor: pointer; text-transform: uppercase; transition: 0.2s; letter-spacing: 0.1em; }
        .lock-btn:hover { color: white; border-color: white; background: #111; }
        .system-time b { font-size: 18px; color: white; font-weight: bold; tabular-nums; }

        .progress-container { width: 100%; height: 6px; background: #0f0f0f; margin-bottom: 2.5rem; position: relative; flex-shrink: 0; border-radius: 3px; overflow: hidden; }
        .progress-fill { height: 100%; background: white; transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 0 20px rgba(255,255,255,0.4); }

        .content-layout { display: grid; grid-template-columns: 240px 1fr 320px; gap: 3.5rem; flex: 1; overflow: hidden; }

        .sidebar-archives { display: flex; flex-direction: column; border-right: 1px solid var(--border); padding-right: 2rem; }
        .sidebar-archives h3 { font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.3em; margin: 0 0 2rem 0; }
        .file-list { flex: 1; overflow-y: auto; scrollbar-width: none; }
        .file-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid transparent; cursor: pointer; transition: 0.2s; }
        .file-row:hover { border-bottom: 1px solid #222; }
        .file-item { font-size: 13px; color: #52525b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; transition: 0.2s; }
        .file-row:hover .file-item { color: white; }
        .file-row.active .file-item { color: white; font-weight: bold; border-left: 3px solid white; padding-left: 10px; }
        .del-x { font-size: 9px; color: #1a1a1a; opacity: 0; transition: 0.2s; padding: 2px 6px; }
        .file-row:hover .del-x { opacity: 0.4; color: #52525b; }
        .del-x:hover { color: var(--danger) !important; opacity: 1 !important; }

        .editor-main { display: flex; flex-direction: column; height: 100%; min-width: 0; }
        .editor-controls { display: flex; gap: 1.5rem; align-items: center; margin-bottom: 1.5rem; }
        .editor-controls input { background: transparent; border: none; border-bottom: 2px solid var(--border); color: white; font-family: inherit; font-size: 16px; padding: 8px 0; outline: none; flex: 1; letter-spacing: 0.05em; transition: border-color 0.3s; }
        .editor-controls input:focus { border-color: #444; }
        .save-btn { background: white; color: black; border: none; font-size: 11px; font-weight: 900; padding: 10px 24px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.1em; transition: 0.2s; }
        .save-btn:hover { background: #d4d4d8; transform: translateY(-1px); }

        textarea { flex: 1; background: var(--panel); border: 1px solid var(--border); padding: 3rem; color: #e4e4e7; outline: none; resize: none; font-family: inherit; font-size: 16px; line-height: 1.9; transition: border-color 0.4s; }
        textarea:focus { border-color: #333; background: #080808; }

        .sidebar-meta { display: flex; flex-direction: column; gap: 3rem; overflow-y: auto; scrollbar-width: none; }
        .rules-widget { border: 1px solid var(--border); background: #070707; }
        .rules-head { padding: 16px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
        .rules-head h3 { font-size: 11px; text-transform: uppercase; color: var(--text-dim); margin: 0; letter-spacing: 0.2em; }
        .rules-body { max-height: 0; overflow-y: auto; transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1); scrollbar-width: none; }
        .rules-body.open { max-height: 380px; padding: 0 16px 16px 16px; }
        .rule-line { font-size: 11px; color: #3f3f46; padding: 8px 0; border-bottom: 1px solid #111; line-height: 1.5; text-transform: uppercase; }
        .rule-line span { color: #a1a1aa; margin-right: 12px; font-weight: bold; }

        .burn-widget { border-top: 1px solid var(--border); padding-top: 2rem; flex: 1; display: flex; flex-direction: column; }
        .burn-title { font-size: 11px; color: var(--danger); font-weight: 900; margin-bottom: 2rem; text-transform: uppercase; letter-spacing: 0.2em; display: flex; align-items: center; gap: 8px; }
        .burn-title::before { content: ''; display: block; width: 8px; height: 8px; background: var(--danger); border-radius: 50%; animation: pulse-red 2s infinite; }
        @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }

        .mission-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; cursor: pointer; padding: 4px 0; border-radius: 4px; }
        .mission-text { display: flex; gap: 1rem; font-size: 14px; flex: 1; transition: 0.2s; }
        .mission-text.done { opacity: 0.2; text-decoration: line-through; }
        .del-mission { font-size: 11px; color: #18181b; padding: 0 8px; opacity: 0; transition: 0.2s; }
        .mission-row:hover .del-mission { opacity: 0.6; color: #52525b; }
        
        .mission-input { width: 100%; background: transparent; border: none; border-bottom: 1px solid var(--border); padding: 12px 0; color: white; font-family: inherit; font-size: 13px; outline: none; transition: border-color 0.3s; }
        .mission-input:focus { border-color: #52525b; }

        footer { border-top: 1px solid var(--border); padding: 1.5rem 0 0 0; margin-top: 2rem; display: flex; justify-content: space-between; font-size: 10px; color: #27272a; text-transform: uppercase; letter-spacing: 0.5em; flex-shrink: 0; }
        .sync-active { color: #22c55e; animation: blink 1s infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>

      <header>
        <div className="header-meta">
          <div className="title-block">
            <h1>Sanctuary // Version_1.2</h1>
            <p>The only way out is through.</p>
          </div>
          <button className="lock-btn" onClick={() => setIsLocked(true)}>
            Secure_Session
          </button>
        </div>
        <div className="system-time">
          <span
            style={{
              fontSize: "10px",
              color: "var(--text-dim)",
              display: "block",
              marginBottom: "6px",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
            }}
          >
            SYSTEM_TIME
          </span>
          <b>{time.toLocaleTimeString([], { hour12: false })}</b>
        </div>
      </header>

      <div className="progress-container">
        <div
          className="progress-fill"
          style={{ width: `${progressPercent}%` }}
        ></div>
      </div>

      <div className="content-layout">
        {/* COLUMN 1: ARCHIVES */}
        <aside className="sidebar-archives">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "2.5rem",
            }}
          >
            <h4>Archives</h4>
            <button
              className="lock-btn"
              style={{ padding: "2px 8px" }}
              onClick={createNewFile}
            >
              + NEW
            </button>
          </div>
          <div className="file-list">
            {fileList.length > 0 ? (
              fileList.map((f) => (
                <div
                  key={f}
                  className={`file-row ${f === fileName ? "active" : ""}`}
                  onClick={() => handleLoadFile(f)}
                >
                  <div className="file-item">{f.toUpperCase()}.VAULT</div>
                  <span
                    className="del-x"
                    onClick={(e) => handleDeleteFile(e, f)}
                  >
                    [PURGE]
                  </span>
                </div>
              ))
            ) : (
              <div
                style={{
                  fontSize: "11px",
                  color: "#18181b",
                  fontStyle: "italic",
                }}
              >
                No archives detected...
              </div>
            )}
          </div>
        </aside>

        {/* COLUMN 2: EDITOR */}
        <section className="editor-main">
          <div className="editor-controls">
            <input
              value={fileName}
              onChange={(e) =>
                setFileName(e.target.value.replace(/[^a-z0-9_]/gi, ""))
              }
              placeholder="Filename..."
              spellCheck="false"
            />
            <button className="save-btn" onClick={handleSaveFile}>
              {isSyncing ? "SYNCING..." : "COMMIT_VAULT"}
            </button>
          </div>
          <textarea
            value={journal}
            onChange={(e) => setJournal(e.target.value)}
            placeholder="How was your day...."
            spellCheck="false"
          />
        </section>

        {/* COLUMN 3: DIRECTIVES & MISSIONS */}
        <aside className="sidebar-meta">
          <div className="rules-widget">
            <div
              className="rules-head"
              onClick={() => setIsRulesExpanded(!isRulesExpanded)}
            >
              <h3>Core_Directives</h3>
              <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>
                {isRulesExpanded ? "[-]" : "[+]"}
              </span>
            </div>
            <div className={`rules-body ${isRulesExpanded ? "open" : ""}`}>
              {CORE_RULES.map((rule, i) => (
                <div key={i} className="rule-line">
                  <span>{String(i + 1).padStart(2, "0")}</span> {rule}
                </div>
              ))}
            </div>
          </div>

          <div className="burn-widget">
            <h2 className="burn-title">Burn_Status</h2>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                scrollbarWidth: "none",
                paddingRight: "10px",
              }}
            >
              {tasks.length > 0 ? (
                tasks.map((t) => (
                  <div
                    key={t.id}
                    className="mission-row"
                    onClick={() =>
                      setTasks(
                        tasks.map((x) =>
                          x.id === t.id ? { ...x, completed: !x.completed } : x,
                        ),
                      )
                    }
                  >
                    <div
                      className={`mission-text ${t.completed ? "done" : ""}`}
                    >
                      <span
                        style={{
                          color:
                            t.critical && !t.completed
                              ? "var(--danger)"
                              : "var(--text-dim)",
                        }}
                      >
                        {t.completed ? "→" : t.critical ? "!" : ">"}
                      </span>
                      <span style={{ flex: 1 }}>{t.text}</span>
                    </div>
                    <span
                      className="del-mission"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTasks(tasks.filter((x) => x.id !== t.id));
                      }}
                    >
                      [X]
                    </span>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#18181b",
                    marginBottom: "1.5rem",
                    fontStyle: "italic",
                  }}
                >
                  Buffer empty...
                </div>
              )}
            </div>
            <form onSubmit={addTask} style={{ marginTop: "2rem" }}>
              <input
                type="text"
                className="mission-input"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="+ Add new task..."
              />
            </form>
            <div
              style={{
                fontSize: "9px",
                marginTop: "1.5rem",
                color: "#3f3f46",
                fontStyle: "italic",
                letterSpacing: "0.1em",
              }}
            >
              AUTO_PURGE: {getTimeToBurn()}
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: "1.5rem",
              marginTop: "auto",
            }}
          >
            <span
              className={isSyncing ? "sync-active" : ""}
              style={{
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              ● {systemStatus}
            </span>
          </div>
        </aside>
      </div>

      <footer>
        <div>Bunker_Status: ACTIVE</div>
        <div>
          {Math.round(progressPercent)}% EFFICIENCY //{" "}
          {new Date().getFullYear()}
        </div>
      </footer>
    </main>
  );
}

export default App;
