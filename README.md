# Qonyx

Qonyx is a local-first AI quantitative-trading command center. It separates
market analysis, trade proposal, deterministic risk approval, exchange
execution, and reporting so an AI model never receives exchange credentials or
direct exchange access.

> Qonyx is experimental trading software, not financial advice. Start in the
> paper sandbox. Live trading is disabled unless the server operator explicitly
> enables it.

## What is implemented

- Three-agent workflow:
  - **Atlas Analyst** produces structured market analysis.
  - **Vector Trader** receives the analysis and proposes one buy, sell, or hold.
  - **Ledger Reporter** records the analysis, risk decision, execution, and budget.
- Bring-your-own AI provider:
  - OpenAI-compatible `/chat/completions` APIs.
  - Local Ollama through its OpenAI-compatible endpoint.
  - Built-in deterministic agents for credential-free sandbox testing.
- Deterministic safety gate:
  - Hard agent fund ceiling.
  - Per-run live ledger that excludes positions owned outside Qonyx.
  - Maximum order and position allocation.
  - Per-run realized-loss stop.
  - No leverage or short selling.
  - AI output is schema-validated and cannot bypass the gate.
- Force stop:
  - Per-agent stop.
  - Global emergency stop.
  - In-flight AI calls are aborted and open-order cancellation is requested.
  - A failed cancellation is surfaced as a manual venue action, never hidden.
- Exchanges:
  - Fully functional local paper exchange.
  - Binance, Bitget, and Bybit spot adapters through CCXT.
  - Moomoo/Futu OpenD and other platforms through the exchange-gateway contract.
- Secret handling:
  - Keys are submitted to the API server, kept in memory, and never returned.
  - The web application never stores an AI or exchange key.
  - Live trading is off by default.
  - Mainnet trading requires a second, separate server opt-in.
- Reports and observability:
  - Per-cycle agent steps, risk adjustments, account snapshots, orders, and reports.
  - Health, platform, connection, run, report, stop, and unlock APIs.

## Run locally

Requires Node.js 22 or newer.

```powershell
npm.cmd install
npm.cmd run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The API listens on
`http://127.0.0.1:8787`.

Paper mode requires no credentials. Add Ollama or another AI connection in
**Exchanges → AI provider**, then assign it separately to the three roles in
**Agent Studio**.

## Isolated Docker sandbox

Docker keeps live trading disabled and exposes the web application at
[http://127.0.0.1:8080](http://127.0.0.1:8080).

```powershell
docker compose up --build
```

Stop and remove the sandbox containers with:

```powershell
docker compose down
```

No host credential file is mounted by the provided compose configuration.

## Verify

```powershell
npm.cmd run check
```

The check gate runs API and web typechecks, 39 tests, and both production builds.

## Live exchange opt-in

1. Validate the workflow with a paper run.
2. Create a restricted exchange testnet key with withdrawals disabled.
3. Save and test the connection in Qonyx.
4. Stop the server.
5. Set `QONYX_ENABLE_LIVE_TRADING=true` in the server environment.
6. Restart Qonyx and select **Live / exchange testnet**.

Live mode still uses the exact same deterministic fund, position, order, loss,
and emergency-stop gates. Do not expose the API publicly without setting
`QONYX_SESSION_TOKEN` and placing it behind authenticated TLS.

Mainnet connections remain blocked even when live adapters are enabled. Only
after testnet validation, set `QONYX_ALLOW_MAINNET_TRADING=true` as a second
explicit opt-in. Keep withdrawals disabled and use the smallest practical fund.

## API summary

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | API and live-trading policy |
| `GET` | `/api/platforms` | Exchange capabilities |
| `GET/POST` | `/api/connections` | Redacted session-vault connections |
| `POST` | `/api/connections/:id/test` | Validate an AI or exchange connection |
| `GET/POST` | `/api/agent-runs` | List or start agent workflows |
| `POST` | `/api/agent-runs/:id/cycle` | Run one complete cycle |
| `POST` | `/api/agent-runs/:id/stop` | Force stop one workflow |
| `GET` | `/api/agent-runs/:id/events` | Retrieve structured runtime activity |
| `GET` | `/api/agent-runs/:id/reports` | Retrieve cycle reports |
| `POST` | `/api/system/emergency-stop` | Stop all runs and lock trading |
| `POST` | `/api/system/unlock` | Remove the global lock |

See [docs/USER_GUIDE.md](docs/USER_GUIDE.md) for the complete feature guide,
[docs/DEBUGGING.md](docs/DEBUGGING.md) for troubleshooting,
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for safety boundaries, and
[docs/exchange-gateway.md](docs/exchange-gateway.md) for the custom venue contract.

## Repository structure

```text
apps/
  api/             Express API, agent orchestration, risk engine, adapters, tests
  web/             Vite + React Onyx Terminal UI
docker/            Isolated paper-sandbox images and reverse proxy
docs/              Architecture and custom exchange-gateway contract
```
