import os
import sys
import time
import shutil
import subprocess
import threading
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

# Configuration
PORT = int(os.environ.get("PORT", "10000"))
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
REPO_URL_TEMPLATE = "https://x-access-token:{token}@github.com/SH20FK/TurboProbe.git"

# Status State
state = {
    "is_running": False,
    "last_run": "Никогда",
    "last_duration": "0s",
    "vpn_count": 0,
    "tg_count": 0,
    "best_ping": "N/A",
    "avg_ping": "N/A",
    "status": "🟢 Готов к работе (IDLE)",
    "logs": ["🚀 TurboProbe Daemon запущен на Render.com!"],
}
state_lock = threading.Lock()

def add_log(msg: str):
    with state_lock:
        ts = datetime.now().strftime("%H:%M:%S")
        line = f"[{ts}] {msg}"
        state["logs"].append(line)
        if len(state["logs"]) > 200:
            state["logs"].pop(0)
        print(line, flush=True)

def run_command_streaming(cmd: list, cwd: str, env: dict):
    """Runs command and streams stdout/stderr line by line in real-time."""
    try:
        proc = subprocess.Popen(
            cmd,
            cwd=cwd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            errors="replace",
        )
        for line in proc.stdout:
            clean = line.strip()
            if clean:
                add_log(clean)
        proc.wait()
        return proc.returncode
    except Exception as e:
        add_log(f"💥 Ошибка запуска команды {cmd[0]}: {e}")
        return 1

def install_engine_binaries():
    """Ensures Xray-core and Mihomo binaries are installed in /tmp/bin."""
    bin_dir = "/tmp/bin"
    os.makedirs(bin_dir, exist_ok=True)
    os.environ["PATH"] = f"{bin_dir}:{os.environ.get('PATH', '')}"

    xray_bin = os.path.join(bin_dir, "xray")
    if not os.path.exists(xray_bin):
        add_log("📦 [Setup] Установка Xray-core v26.3.27...")
        subprocess.run(["curl", "-fL", "-s", "-o", "/tmp/xray.zip", "https://github.com/XTLS/Xray-core/releases/download/v26.3.27/Xray-linux-64.zip"])
        subprocess.run(["unzip", "-o", "-q", "/tmp/xray.zip", "-d", bin_dir])
        if os.path.exists(xray_bin):
            os.chmod(xray_bin, 0o755)
            add_log("✅ [Setup] Xray-core успешно установлен!")

    mihomo_bin = os.path.join(bin_dir, "mihomo")
    if not os.path.exists(mihomo_bin):
        add_log("📦 [Setup] Установка Mihomo v1.19.16...")
        subprocess.run(["curl", "-fL", "-s", "-o", "/tmp/mihomo.gz", "https://github.com/MetaCubeX/mihomo/releases/download/v1.19.16/mihomo-linux-amd64-v1.19.16.gz"])
        subprocess.run(["gzip", "-d", "-f", "/tmp/mihomo.gz"])
        if os.path.exists("/tmp/mihomo"):
            shutil.move("/tmp/mihomo", mihomo_bin)
            os.chmod(mihomo_bin, 0o755)
            add_log("✅ [Setup] Mihomo успешно установлен!")

def run_update_cycle():
    """Executes full update cycle with real-time log streaming and auto GitHub sync."""
    with state_lock:
        if state["is_running"]:
            add_log("⚠️ Сбор уже выполняется, повторный запуск пропущен.")
            return
        state["is_running"] = True
        state["status"] = "⏳ Выполняется сбор и валидация..."

    t0 = time.time()
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    root_dir = os.path.dirname(os.path.abspath(__file__))

    try:
        add_log("=" * 60)
        add_log("🚀 [TurboProbe Pipeline] Запуск полного цикла сбора и валидации...")
        add_log("=" * 60)

        # 1. Setup engine binaries
        install_engine_binaries()

        env = os.environ.copy()
        env["PATH"] = f"/tmp/bin:{env.get('PATH', '')}"
        if token:
            env["GITHUB_TOKEN"] = token

        # 2. Git Config
        subprocess.run(["git", "config", "user.name", "SH20FK"], cwd=root_dir, env=env)
        subprocess.run(["git", "config", "user.email", "salamatinsana940@gmail.com"], cwd=root_dir, env=env)

        # 3. Pull latest changes if remote was updated
        if token:
            push_url = f"https://x-access-token:{token}@github.com/SH20FK/TurboProbe.git"
            subprocess.run(["git", "pull", "--rebase", push_url, "main"], cwd=root_dir, env=env, capture_output=True)

        # 4. TGProxy Collection
        add_log("📡 [1/3] Запуск сбора Telegram MTProto & Web-прокси...")
        run_command_streaming([sys.executable, "tgproxy/tg_aggregator.py"], cwd=root_dir, env=env)

        # 5. VPN Aggregator & Deep Prober
        add_log("⚡ [2/3] Запуск глубокого сбора VPN узлов (Tier-1 + Prober)...")
        run_command_streaming([sys.executable, "tools/aggregator.py", "--fast"], cwd=root_dir, env=env)

        # 6. Sync sub to docs/sub
        add_log("📁 [3/3] Синхронизация файлов подписок (sub -> docs/sub)...")
        sub_dir = os.path.join(root_dir, "sub")
        docs_sub = os.path.join(root_dir, "docs", "sub")
        if os.path.exists(sub_dir):
            for item in os.listdir(sub_dir):
                s = os.path.join(sub_dir, item)
                d = os.path.join(docs_sub, item)
                if os.path.isdir(s):
                    shutil.copytree(s, d, dirs_exist_ok=True)
                else:
                    shutil.copy2(s, d)

        # 7. Read latest stats
        try:
            stats_path = os.path.join(sub_dir, "stats.json")
            if os.path.exists(stats_path):
                with open(stats_path, "r", encoding="utf-8") as f:
                    st = json.load(f)
                    state["vpn_count"] = st.get("online_nodes", 0)
                    state["best_ping"] = f"{st.get('best_ping_ms', 0)} ms"
                    state["avg_ping"] = f"{st.get('avg_ping_ms', 0)} ms"

            tg_path = os.path.join(root_dir, "docs", "tg", "proxies.json")
            if os.path.exists(tg_path):
                with open(tg_path, "r", encoding="utf-8") as f:
                    tg_st = json.load(f)
                    state["tg_count"] = len(tg_st.get("items", []))
        except Exception as e:
            add_log(f"⚠️ Ошибка чтения stats: {e}")

        # 8. Git Commit & Push
        add_log("🚀 Публикация обновлений в GitHub...")
        subprocess.run(["git", "add", "-A"], cwd=root_dir, env=env)
        git_st = subprocess.run(["git", "status", "--porcelain"], cwd=root_dir, env=env, capture_output=True, text=True).stdout
        if git_st.strip() and token:
            now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            commit_msg = f"chore(render): auto-update VPN & TGProxy databases [{now_str}]"
            subprocess.run(["git", "commit", "-m", commit_msg, "--author=SH20FK <salamatinsana940@gmail.com>"], cwd=root_dir, env=env)
            push_url = f"https://x-access-token:{token}@github.com/SH20FK/TurboProbe.git"
            push_res = subprocess.run(["git", "push", push_url, "HEAD:main"], cwd=root_dir, env=env, capture_output=True, text=True)
            if push_res.returncode == 0:
                add_log("🎉 ВСЁ УСПЕШНО! Свежая база отправлена в GitHub!")
            else:
                add_log(f"⚠️ Ошибка git push: {push_res.stderr}")
        elif not token:
            add_log("⚠️ GITHUB_TOKEN не задан в Environment Variables, git push пропущен.")
        else:
            add_log("✨ Базы уже актуальны, изменений нет.")

        duration = round(time.time() - t0, 1)
        state["last_run"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        state["last_duration"] = f"{duration}s"
        add_log(f"🏁 Цикл завершён за {duration} секунд!")

    except Exception as e:
        add_log(f"💥 Ошибка: {e}")
    finally:
        with state_lock:
            state["is_running"] = False
            state["status"] = "🟢 Готов к работе (IDLE)"

def background_scheduler_loop():
    """Background loop that runs immediately on startup and every 4 hours thereafter."""
    time.sleep(5)
    while True:
        run_update_cycle()
        add_log("😴 Следующий автоматический сбор через 4 часа...")
        time.sleep(14400)

class SimpleHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/run":
            threading.Thread(target=run_update_cycle, daemon=True).start()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "started", "message": "Сбор запущен в фоне!"}, ensure_ascii=False).encode())
            return

        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"OK")
            return

        # Main HTML Dashboard
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()

        log_text = "\n".join(state["logs"])
        badge_cls = "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse" if state["is_running"] else "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
        
        html = f'''<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TurboProbe 24/7 Cloud Daemon</title>
    <meta http-equiv="refresh" content="5">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {{ background: #0B0F19; color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
    </style>
</head>
<body class="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
    <div class="border border-slate-800 bg-slate-900/80 backdrop-blur rounded-2xl p-6 shadow-xl">
        <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    🚀 TurboProbe 24/7 Cloud Collector
                </h1>
                <p class="text-slate-400 text-sm mt-1">Автономный демон сбора и валидации прокси на Render.com</p>
            </div>
            <div class="flex items-center gap-3">
                <span class="px-3 py-1 rounded-full text-xs font-semibold {badge_cls}">
                    {state['status']}
                </span>
                <button onclick="fetch('/run').then(() => location.reload())" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all cursor-pointer shadow-lg shadow-blue-500/20">
                    ⚡ Запустить сейчас
                </button>
            </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <div class="text-xs text-slate-400">VPN узлов ONLINE</div>
                <div class="text-xl font-bold text-blue-400 mt-1">{state['vpn_count']}</div>
            </div>
            <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <div class="text-xs text-slate-400">TG прокси ONLINE</div>
                <div class="text-xl font-bold text-sky-400 mt-1">{state['tg_count']}</div>
            </div>
            <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <div class="text-xs text-slate-400">Средний пинг</div>
                <div class="text-xl font-bold text-emerald-400 mt-1">{state['avg_ping']}</div>
            </div>
            <div class="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <div class="text-xs text-slate-400">Последний цикл</div>
                <div class="text-xs font-mono text-slate-300 mt-1">{state['last_run']} ({state['last_duration']})</div>
            </div>
        </div>

        <div>
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Живой лог демона (Realtime Stream)</span>
                <span class="text-xs text-slate-500">Render 24/7 Worker</span>
            </div>
            <pre class="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-xs font-mono text-slate-300 h-72 overflow-y-auto whitespace-pre-wrap">{log_text}</pre>
        </div>
    </div>
</body>
</html>'''
        self.wfile.write(html.encode("utf-8"))

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    daemon_thread = threading.Thread(target=background_scheduler_loop, daemon=True)
    daemon_thread.start()

    server_address = ("0.0.0.0", PORT)
    httpd = HTTPServer(server_address, SimpleHandler)
    print(f"🚀 [TurboProbe Daemon] HTTP Server listening on port {PORT}...", flush=True)
    httpd.serve_forever()
