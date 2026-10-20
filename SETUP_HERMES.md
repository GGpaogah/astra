# SETUP_HERMES — Hermes Agent (VM Proxmox) + VS Code Windows via Remote-SSH

> **Status:** The Hermes Agent VM is currently offline.
> **Kiro AI is the active primary coding agent** for this project.
> This document describes an optional remote development workflow for when the VM is restored.
> The standard workflow (Kiro AI running directly on Windows) does not require any of the steps below.

---

Workflow: VS Code on Windows → SSH → VM Proxmox (`<VM_IP>`) where Hermes Agent
and the project repository reside. Application testing (Electron + Windows binaries) is
performed on Windows via Git.

```
[Windows]                        [VM Proxmox <VM_IP>]
VS Code (UI)  ── SSH (port 22) ──► VS Code Server
                                   ├─ Hermes Agent (hermes acp)
                                   └─ ~/projects/astra  (git repo)
      ▲
      └── git pull ◄──── git push ──┘   (test and run on Windows)
```

> Note: extension names, CLI commands, and configuration keys for Hermes may change.
> Verify against the installed version and official documentation before following these steps:
> - https://hermes-agent.nousresearch.com/
> - https://github.com/NousResearch/hermes-agent

---

## Status
- [x] SSH from VS Code Windows to VM working
- [ ] Hermes verified (`hermes acp --check`)
- [ ] Hermes extension installed on the SSH remote side
- [ ] Git repo + remote configured

## 1. Prerequisites
- A running Linux VM (Ubuntu/Debian) reachable from Windows
- OpenSSH server active on the VM
- VS Code with the **Remote - SSH** extension (Microsoft) installed on Windows
- Git on both the VM and Windows
- Node.js 22.12+ on the VM (for `npm install`, typecheck, lint)

## 2. Prepare SSH on the VM
```bash
sudo apt update && sudo apt install -y openssh-server git curl
sudo systemctl enable --now ssh
sudo systemctl status ssh
```
Find the VM's IP address: `ip a`. Assign a static IP or DHCP reservation to keep it stable.

## 3. SSH Key from Windows (PowerShell)
```powershell
ssh-keygen -t ed25519 -C "windows-vscode"
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh USER@<VM_IP> "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
ssh USER@<VM_IP>     # should connect without a password prompt
```
Replace `USER` with your VM username and `<VM_IP>` with the actual IP address.

## 4. SSH Config (Windows)
Edit `C:\Users\<you>\.ssh\config`:
```
Host astra-vm
    HostName <VM_IP>
    User USER
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 30
    ServerAliveCountMax 4
```

## 5. Connect VS Code
1. Press `F1` → **Remote-SSH: Connect to Host…** → select `astra-vm`
2. Wait for VS Code Server to install on the VM
3. **File → Open Folder** → `~/projects/astra`

## 6. Install and verify Hermes on the VM
Verify whether it is already installed:
```bash
which hermes
hermes --version
hermes model            # verify provider/model is configured
hermes acp --check      # verify ACP mode is ready
```
If not installed, follow the official installation instructions (verify the URL first):
```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
```
Hermes configuration is stored at `~/.hermes/config.yaml`.

## 7. Install the Hermes extension on the SSH remote
Inside the VS Code window connected via SSH, open Extensions and search for:
- **Hermes Agent for VS Code**
- **ACP Client** (or the equivalent ACP extension for the installed version)

Click **Install in SSH: astra-vm** (not the local install). After installation:
- If `hermes` is not found, set the full path in extension settings
  (e.g. `hermes.cliPath` → `/home/USER/.local/bin/hermes`)
- Reload the window, then select **Hermes Agent** in the agent panel

## 8. Quick test
In the Hermes panel, send: *"Read README.md and describe the project structure."*
If Hermes can read the file, the integration is working.

## 9. Daily workflow
**On the VM (Hermes edits code):**
```bash
cd ~/projects/astra
git add <files>
git commit -m "feat: ..."
git push
```
**On Windows (test the application):**
```powershell
git pull
npm install        # re-run after any dependency changes
npm run dev        # requires Electron and Windows binaries in bin/
```
Routine:
1. Hermes codes on the VM → commit → `git push`
2. Windows: `git pull` → `npm run dev` → test
3. Error? Copy the error message or contents of `logs/*.log` to the Hermes chat
4. Repeat

The `bin/`, `data/`, `logs/`, `etc/`, `tmp/` folders are in `.gitignore`.
Windows binaries (Apache, PHP, MariaDB) only need to exist on the Windows machine.

## 10. Troubleshooting
| Problem | Solution |
|---|---|
| `Connection timed out` | Check VM IP, firewall, and that the `ssh` service is running |
| Password prompt persists | Check permissions: `~/.ssh` (700) and `authorized_keys` (600); verify key was copied |
| `hermes not found` in extension | Set the full binary path in extension settings; ensure extension is installed on the SSH side |
| Model list empty | Run `hermes model` once on the VM |
| Agent error on start | Check **Output** panel → Hermes/ACP channel; run `hermes acp --check` |
| VS Code Server fails to install | Verify VM has internet access, sufficient disk, and `curl`/`wget` available |
| Intermittent disconnections | Add `ServerAliveInterval` to SSH config (already included above) |

## 11. Security
- Use SSH keys; disable password login once stable
  (`PasswordAuthentication no` in `/etc/ssh/sshd_config`)
- Do not expose the VM's SSH port to the internet; keep it on the local network
- Store provider API keys only on the VM (`~/.hermes/`); never commit them to Git
- Review every change and command the agent requests before approving
