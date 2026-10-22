#!/usr/bin/env python3
# A real terminal for the panel's Terminal page: runs a login shell in a pseudo-terminal and
# passes bytes between it and the panel. Messages from the panel are JSON lines on stdin:
#   {"t": "in", "d": "<text typed>"}   {"t": "size", "cols": 80, "rows": 24}
# Everything the shell prints goes to stdout as-is.
import fcntl, json, os, pty, select, signal, struct, sys, termios

pid, fd = pty.fork()
if pid == 0:
    os.environ["TERM"] = "xterm-256color"
    os.environ.pop("AGENTBOX_DATA_DIR", None)
    os.chdir(os.path.expanduser("~"))
    shell = os.environ.get("SHELL", "/bin/zsh")
    os.execv(shell, [shell, "-l"])

def resize(cols, rows):
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
    os.kill(pid, signal.SIGWINCH)

resize(100, 30)
buf = b""
stdin = sys.stdin.fileno()
while True:
    try:
        r, _, _ = select.select([fd, stdin], [], [])
    except InterruptedError:
        continue
    if fd in r:
        try:
            data = os.read(fd, 65536)
        except OSError:
            break
        if not data:
            break
        os.write(1, data)
    if stdin in r:
        chunk = os.read(stdin, 65536)
        if not chunk:
            break
        buf += chunk
        while b"\n" in buf:
            line, buf = buf.split(b"\n", 1)
            try:
                m = json.loads(line)
            except ValueError:
                continue
            if m.get("t") == "in":
                os.write(fd, m.get("d", "").encode())
            elif m.get("t") == "size":
                resize(int(m.get("cols", 80)), int(m.get("rows", 24)))
try:
    os.kill(pid, signal.SIGHUP)
except OSError:
    pass
