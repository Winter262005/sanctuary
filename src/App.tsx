import React, { useState, useEffect, useRef } from "react";
// Direct import to bypass browser sandboxing and access the local system
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

// Simple obfuscation for local storage security
const scramble = (str: string) => btoa(str).split("").reverse().join("");
const descramble = (str: string) => atob(str.split("").reverse().join(""));

function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [hasMasterKey, setHasMasterKey] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [authError, setAuthError] = useState(false);

  const [journal, setJournal] = useState("");
  const [fileName, setFileName] = useState("untitled_log");
  const [fileList, setFileList] = useState<string[]>([]);
  const [time, setTime] = useState(new Date());
  const [systemStatus, setSystemStatus] = useState("INITIALIZING...");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRulesExpanded, setIsRulesExpanded] = useState(false);

  const [tasks, setTasks] = useState<
    { id: number; text: string; completed: boolean; critical: boolean }[]
  >([]);
  const [newTask, setNewTask] = useState("");

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if a master key already exists
    const storedKey = localStorage.getItem("sanctuary_master_key");
    if (storedKey) {
      setHasMasterKey(true);
    }

    const timer = setInterval(() => {
      const now = new Date();
      setTime(now);
      if (
        now.getHours() === 0 &&
        now.getMinutes() === 0 &&
        now.getSeconds() === 0
      ) {
        setTasks([]);
      }
    }, 1000);

    const initSystem = async () => {
      try {
        const status = await invoke("get_system_status");
        setSystemStatus(status as string);
        refreshFileList();
      } catch (e) {
        setSystemStatus("OFFLINE_MODE // NO_KERNEL_DETECTED");
      }
    };

    const savedTasks = localStorage.getItem("sanctuary_tasks");
    if (savedTasks)
      try {
        setTasks(JSON.parse(savedTasks));
      } catch (e) {}

    initSystem();
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem("sanctuary_tasks", JSON.stringify(tasks));
  }, [tasks]);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessKey.trim()) return;

    if (!hasMasterKey) {
      // Setup phase: Scramble and store the new key
      const scrambledKey = scramble(accessKey);
      localStorage.setItem("sanctuary_master_key", scrambledKey);
      setHasMasterKey(true);
      setIsLocked(false);
      setAccessKey("");
    } else {
      // Login phase: Compare current input with stored scrambled key
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
      setFileList(files as string[]);
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

  const toggleTask = (id: number) => {
    setTasks(
      tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
  };

  const removeTask = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const getTimeToBurn = () => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight.getTime() - now.getTime();
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${h.toString().padStart(2, "0")}H ${m.toString().padStart(2, "0")}M`;
  };

  const completedTasks = tasks.filter((t) => t.completed).length;
  const progressPercent =
    tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

  if (isLocked) {
    return (
      <main className="sanctuary-auth">
        <style>{`
          .sanctuary-auth {
            height: 100vh; width: 100vw; background: #000;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-family: ui-monospace, monospace; color: #a1a1aa;
          }
          .auth-terminal {
            width: 320px; padding: 2.5rem; border: 1px solid #1a1a1a; background: #050505;
            text-align: center; box-shadow: 0 0 50px rgba(0,0,0,1);
          }
          .auth-terminal h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5em; margin-bottom: 2rem; color: #52525b; }
          .auth-terminal input {
            width: 100%; background: transparent; border: none; border-bottom: 1px solid #27272a;
            color: white; text-align: center; padding: 12px 0; outline: none; font-family: inherit;
            margin-bottom: 1.5rem; letter-spacing: 0.5em; font-size: 14px;
          }
          .auth-terminal p { font-size: 9px; text-transform: uppercase; color: #3f3f46; margin: 0; line-height: 1.6; }
          .error-text { color: #991b1b !important; animation: shake 0.2s ease-in-out 0s 2; }
          @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        `}</style>
        <div className="auth-terminal">
          <h2>{hasMasterKey ? "Access_Gate" : "Vault_Setup"}</h2>
          <form onSubmit={handleAuthSubmit}>
            <input
              type="password"
              value={accessKey}
              autoFocus
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder={hasMasterKey ? "••••••" : "SET_PASSWORD"}
            />
            <p className={authError ? "error-text" : ""}>
              {hasMasterKey
                ? authError
                  ? "Invalid_Key"
                  : "Awaiting_Input"
                : "Initialize_Kernel_Access_Sequence"}
            </p>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="sanctuary-root">
      <style>{`
        :root { --bg: #050505; --panel: #0a0a0a; --border: #1a1a1a; --text-dim: #52525b; --text-main: #a1a1aa; --accent: #ffffff; --danger: #991b1b; }
        * { box-sizing: border-box; }
        body, html { margin: 0; padding: 0; background: var(--bg); color: var(--text-main); font-family: ui-monospace, monospace; cursor: crosshair !important; overflow: hidden; height: 100vh; width: 100vw; }
        .sanctuary-root { display: flex; flex-direction: column; height: 100vh; padding: 1.5rem 2.5rem; background: var(--bg); }
        
        header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 1.5rem; flex-shrink: 0; }
        .title-block { display: flex; flex-direction: column; }
        .title-block h1 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5em; color: var(--text-dim); margin: 0 0 8px 0; }
        .title-block p { font-size: 1.5rem; font-weight: 900; color: white; margin: 0; font-style: italic; letter-spacing: -0.04em; text-transform: uppercase; }
        
        .header-actions { display: flex; align-items: flex-end; gap: 2rem; }
        .lock-btn { font-size: 9px; color: #3f3f46; background: transparent; border: 1px solid #1a1a1a; padding: 2px 8px; cursor: pointer; text-transform: uppercase; margin-bottom: 4px; }
        .lock-btn:hover { color: white; border-color: white; }

        .system-time { text-align: right; }
        .system-time span { font-size: 10px; text-transform: uppercase; color: var(--text-dim); display: block; margin-bottom: 4px; }
        .system-time b { font-size: 14px; color: var(--text-main); font-weight: bold; tabular-nums; }

        .progress-container { width: 100%; height: 4px; background: #111; margin-bottom: 2rem; position: relative; flex-shrink: 0; border-radius: 2px; overflow: hidden; }
        .progress-fill { height: 100%; background: white; transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 0 15px rgba(255,255,255,0.4); }

        .content-layout { display: grid; grid-template-columns: 200px 1fr 300px; gap: 2.5rem; flex: 1; overflow: hidden; }

        .file-browser { display: flex; flex-direction: column; border-right: 1px solid var(--border); padding-right: 1.5rem; }
        .file-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .file-header h3 { font-size: 10px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.2em; margin: 0; }
        .new-btn { background: transparent; border: 1px solid #27272a; color: #52525b; font-size: 9px; padding: 2px 6px; cursor: pointer; }
        .new-btn:hover { border-color: white; color: white; }

        .file-list { flex: 1; overflow-y: auto; scrollbar-width: none; }
        .file-item { font-size: 11px; padding: 10px 0; color: #3f3f46; cursor: pointer; transition: 0.2s; border-bottom: 1px solid transparent; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .file-item:hover { color: white; border-bottom: 1px solid #27272a; }
        .file-item.active { color: white; font-weight: bold; border-bottom: 1px solid white; }

        .vault-area { display: flex; flex-direction: column; height: 100%; min-width: 0; }
        .editor-header { display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; }
        .editor-header input { background: transparent; border: none; border-bottom: 1px solid var(--border); color: white; font-family: inherit; font-size: 12px; padding: 4px 0; outline: none; flex: 1; }
        .save-btn { background: white; color: black; border: none; font-size: 9px; font-weight: 900; padding: 6px 14px; cursor: pointer; text-transform: uppercase; transition: 0.2s; }
        .save-btn:hover { background: #d4d4d8; letter-spacing: 0.1em; }

        textarea { flex: 1; background: var(--panel); border: 1px solid var(--border); padding: 2rem; color: #d4d4d8; outline: none; resize: none; font-family: inherit; font-size: 15px; line-height: 1.7; transition: all 0.2s ease; }
        textarea:focus { border-color: #333; background: #080808; }

        .sidebar-area { display: flex; flex-direction: column; gap: 2rem; overflow-y: auto; scrollbar-width: none; }
        
        .rules-container { border: 1px solid var(--border); background: #070707; transition: all 0.3s ease; }
        .rules-header { padding: 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border-bottom: 1px solid var(--border); }
        .rules-header h3 { font-size: 10px; text-transform: uppercase; color: var(--text-dim); margin: 0; letter-spacing: 0.2em; }
        .rules-header span { font-size: 10px; color: var(--text-dim); font-weight: bold; }
        .rules-content { max-height: 0; overflow-y: auto; transition: max-height 0.3s ease; scrollbar-width: none; }
        .rules-content::-webkit-scrollbar { display: none; }
        .rules-content.expanded { max-height: 350px; padding: 12px; }
        .rule-item { font-size: 10px; color: #52525b; padding: 6px 0; border-bottom: 1px solid #111; line-height: 1.4; text-transform: uppercase; }
        .rule-item:last-child { border-bottom: none; }
        .rule-item span { color: white; margin-right: 8px; font-style: italic; }

        .burn-list { border-top: 1px solid var(--border); padding-top: 1.5rem; }
        .burn-header { font-size: 10px; color: var(--danger); font-weight: 900; margin-bottom: 1.5rem; text-transform: uppercase; letter-spacing: 0.1em; }
        .task-container { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; cursor: pointer; transition: 0.2s; }
        .task { display: flex; gap: 0.75rem; font-size: 12px; transition: 0.2s; flex: 1; }
        .task.complete { opacity: 0.2; text-decoration: line-through; }
        .del-task { font-size: 10px; color: #18181b; opacity: 0; transition: 0.2s; padding: 0 4px; }
        .task-container:hover .del-task { opacity: 0.6; }
        .del-task:hover { color: var(--danger) !important; opacity: 1 !important; }
        
        form input { width: 100%; background: transparent; border: none; border-bottom: 1px solid var(--border); padding: 8px 0; color: var(--text-dim); font-family: inherit; font-size: 11px; outline: none; }

        footer { border-top: 1px solid var(--border); padding-top: 1.5rem; margin-top: 1.5rem; display: flex; justify-content: space-between; font-size: 9px; color: #27272a; text-transform: uppercase; letter-spacing: 0.4em; flex-shrink: 0; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .sync-blink { color: #22c55e; animation: blink 1s infinite; }
      `}</style>

      <header>
        <div className="header-actions">
          <div className="title-block">
            <h1>Sanctuary OS // v0.2</h1>
            <p>The only way out is through.</p>
          </div>
          <button className="lock-btn" onClick={() => setIsLocked(true)}>
            Lock_Session
          </button>
        </div>
        <div className="system-time">
          <span>System Time</span>
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
        <aside className="file-browser">
          <div className="file-header">
            <h3>Local_Vaults</h3>
            <button className="new-btn" onClick={createNewFile}>
              + NEW
            </button>
          </div>
          <div className="file-list">
            {fileList.length > 0 ? (
              fileList.map((f) => (
                <div
                  key={f}
                  className={`file-item ${f === fileName ? "active" : ""}`}
                  onClick={() => handleLoadFile(f)}
                >
                  {f}.vault
                </div>
              ))
            ) : (
              <div
                style={{ fontSize: "9px", color: "#18181b", marginTop: "1rem" }}
              >
                ARCHIVE_EMPTY
              </div>
            )}
          </div>
        </aside>

        <section className="vault-area">
          <div className="editor-header">
            <input
              value={fileName}
              onChange={(e) =>
                setFileName(e.target.value.replace(/[^a-z0-9_]/gi, ""))
              }
              placeholder="Filename..."
            />
            <button className="save-btn" onClick={handleSaveFile}>
              {isSyncing ? "SYNCING..." : "COMMIT_VAULT"}
            </button>
          </div>
          <textarea
            value={journal}
            onChange={(e) => setJournal(e.target.value)}
            placeholder="Input technical logic..."
            spellCheck="false"
          />
        </section>

        <aside className="sidebar-area">
          <div className="rules-container">
            <div
              className="rules-header"
              onClick={() => setIsRulesExpanded(!isRulesExpanded)}
            >
              <h3>Core_Directives</h3>
              <span>{isRulesExpanded ? "[-]" : "[+]"}</span>
            </div>
            <div
              className={`rules-content ${isRulesExpanded ? "expanded" : ""}`}
            >
              {CORE_RULES.map((rule, i) => (
                <div key={i} className="rule-item">
                  <span>{String(i + 1).padStart(2, "0")}</span> {rule}
                </div>
              ))}
            </div>
          </div>

          <div className="burn-list">
            <h2 className="burn-header">Burn_Status</h2>
            <div className="tasks-scroll">
              {tasks.length > 0 ? (
                tasks.map((t) => (
                  <div
                    key={t.id}
                    className="task-container"
                    onClick={() => toggleTask(t.id)}
                  >
                    <div className={`task ${t.completed ? "complete" : ""}`}>
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
                      <span>{t.text}</span>
                    </div>
                    <span
                      className="del-task"
                      onClick={(e) => removeTask(e, t.id)}
                    >
                      [X]
                    </span>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    fontSize: "10px",
                    color: "#18181b",
                    marginBottom: "1rem",
                  }}
                >
                  EMPTY_BUFFER
                </div>
              )}
            </div>
            <form onSubmit={addTask}>
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="+ Add mission..."
              />
            </form>
            <div
              style={{
                fontSize: "9px",
                marginTop: "1.5rem",
                color: "#3f3f46",
                fontStyle: "italic",
              }}
            >
              AUTO-PURGE IN: {getTimeToBurn()}
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: "1rem",
              marginTop: "auto",
            }}
          >
            <span className={isSyncing ? "sync-blink" : ""}>
              ● {systemStatus}
            </span>
          </div>
        </aside>
      </div>

      <footer>
        <div>Bunker Mode: ACTIVE</div>
        <div>
          {Math.round(progressPercent)}% EFFICIENCY //{" "}
          {new Date().getFullYear()}
        </div>
      </footer>
    </main>
  );
}

export default App;
