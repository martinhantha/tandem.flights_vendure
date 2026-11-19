# Self-hosted logs (Loki + logcli) on Coolify

Coolify ships container logs to **Loki** via Fluent Bit. Loki runs in **`compose-base.yml`** (same Coolify resource as Postgres/ES/backup). Query history over **SSH** with **logcli**.

## 1. Enable log drain (once per server)

1. **Server** → **Configuration** → **Log Drains** → **Custom FluentBit**.
2. Paste `fluent-bit-coolify.conf` → save → turn **Enabled** on.

Creates `log-drains_default` and starts `coolify-log-drain`.

## 2. Deploy Loki (compose-base)

Redeploy your existing **compose-base** Coolify resource (must run **after** step 1 so `log-drains_default` exists).

Check on the server:

```bash
docker ps --filter name=coolify-log-drain
docker logs --tail 50 coolify-log-drain
curl -s http://127.0.0.1:3100/ready
```

## 3. Drain Vendure logs

1. Vendure resource → **Advanced** → **Drain Logs** → on.
2. Add `compose.logging-drain.yml` alongside `compose.yml` → redeploy.

## 4. Query with logcli (on the server)

```bash
export LOKI_ADDR=http://127.0.0.1:3100
logcli query '{job="fluentbit"}' --limit=50
logcli query '{job="fluentbit"} |= "error"' --since=24h
```

Install `logcli` or use:

```bash
docker run --rm --network host grafana/logcli:3.4.2 \
  query '{job="fluentbit"}' --addr=http://127.0.0.1:3100 --limit=20
```

### From your Mac (Docker SSH context)

Port **3100** is published on the **server’s** `127.0.0.1`, not your Mac. Switching `docker context` lets you run `docker logs` remotely, but `curl http://127.0.0.1:3100` locally still hits your laptop.

**SSH tunnel** (then `LOKI_ADDR=http://127.0.0.1:3100` works on the Mac):

```bash
ssh -L 3100:127.0.0.1:3100 root@coolify.<project>.hantha.digital
```

**Or query via remote context** (get Loki container id from `docker --context <name> ps`):

```bash
docker --context <name> exec <loki-container> wget -qO- http://127.0.0.1:3100/ready
docker --context <name> run --rm --network container:<loki-container> grafana/logcli:3.4.2 \
  query '{job="fluentbit"}' --addr=http://127.0.0.1:3100 --limit=20
```

**Loki crash:** `loki-config.yaml: is a directory` — on the server under the Coolify deploy path run `rm -rf observability/loki-config.yaml` (only if it is a directory), then redeploy. Loki config is **baked into the image** (`observability/Dockerfile.loki`), not bind-mounted.

## 5. Retention

Edit `observability/loki-config.yaml` → `limits_config.retention_period` (default **720h**; **8760h** ≈ 1 year).

## Files

| File | Purpose |
|------|--------|
| `compose-base.yml` | `loki` service + volumes/networks |
| `observability/loki-config.yaml` | Retention and storage |
| `observability/fluent-bit-coolify.conf` | Coolify server log drain |
| `compose.logging-drain.yml` | Vendure fluentd logging when drain is on |
