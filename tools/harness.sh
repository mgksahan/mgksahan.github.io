#!/usr/bin/env bash
# Mount one component on a blank page so you can drive it with Playwright without logging in.
#   tools/harness.sh start src/app/pages/TrackBoard.tsx BoardTab   -> http://localhost:5199/harness.html
#   tools/harness.sh stop
# Pages that use the tracker store work offline (localStorage), no auth needed. Files are git-ignored.
cd "$(dirname "$0")/.."
PID=.harness.pid
case "${1:-}" in
  start)
    file="${2%.tsx}"; name="$3"; port="${4:-5199}"
    cat > harness.html <<HTML
<!doctype html><html><body style="background:#0e0f12;margin:0;padding:20px"><script>window.global=window;</script><div id="r" style="width:1000px"></div><script type="module" src="/src/harness.tsx"></script></body></html>
HTML
    cat > src/harness.tsx <<TSX
import { createRoot } from 'react-dom/client';
import { $name } from './${file#src/}';
import './styles/index.css';
createRoot(document.getElementById('r')!).render(<$name />);
TSX
    nohup npx vite --port "$port" > .harness.log 2>&1 & echo $! > $PID
    sleep 4; echo "http://localhost:$port/harness.html" ;;
  stop)
    [ -f $PID ] && kill "$(cat $PID)" 2>/dev/null; pkill -P "$(cat $PID 2>/dev/null)" 2>/dev/null
    rm -f harness.html src/harness.tsx $PID .harness.log; echo stopped ;;
  *) sed -n 2,6p "$0" ;;
esac
