# Raspberry Pi MCP

There is no single official “Raspberry Pi MCP.” This kit entry uses [`ssh-mcp`](https://www.npmjs.com/package/ssh-mcp) so Cursor can run commands on a Pi over SSH (services, packages, logs, files, GPIO tooling you install on the device).

## Prerequisites

1. Enable SSH on the Pi (`sudo raspi-config` → Interface Options → SSH).
2. Prefer key-based auth from your laptop to the Pi.
3. Export connection details for the environment that launches Cursor:

```bash
export RASPBERRY_PI_HOST='192.168.1.50'
export RASPBERRY_PI_USER='pi'
export RASPBERRY_PI_SSH_KEY="${HOME}/.ssh/id_ed25519"
```

Optional local overrides (edit composed `args`): `--port=22`, `--password=...`, `--sudoPassword=...`, `--timeout=120000`.

## Install

```bash
wk mcp lab --install
# or merge into personal:
# wk mcp personal --install
```

## When to use

- Deploying or restarting services on a home lab Pi
- Checking device health, disks, temps, journalctl
- Running on-device scripts (including GPIO tools installed on the Pi)

Treat the Pi as a privileged remote host: keep this in `lab` / `personal`, not shared app repos.

## Hardware / GPIO alternative (Orbit OS)

If the Pi runs [Orbit OS MCP](https://www.hackster.io/zero-onetech/control-raspberry-pi-with-cursor-ai-via-mcp-server-7e01c8) (on-device HTTP MCP with GPIO/I2C tools), use a remote URL instead of SSH:

```json
{
  "raspberry-pi": {
    "url": "http://192.168.1.50:9999/mcp"
  }
}
```

Or set that URL in a local override of the composed config. Do not confuse this with npm’s `pi-mcp-server`, which wraps the **Pi coding agent**, not Raspberry Pi hardware.
