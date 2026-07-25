# Debugging Qonyx

## Start with the complete check

From the repository root:

```powershell
npm.cmd run check
```

This runs strict API and web typechecks, 39 unit/integration tests, and both
production builds. To narrow a failure:

```powershell
npm.cmd run typecheck:api
npm.cmd run typecheck:web
npm.cmd run test:api
npm.cmd run test:web
npm.cmd run build
```

## Development logs

Run both services:

```powershell
npm.cmd run dev
```

The terminal prefixes API and web output separately. Check:

- API startup at `http://127.0.0.1:8787`
- Vite at `http://127.0.0.1:5173`
- request validation or adapter errors in the API output
- compilation errors in the Vite output

Test the API directly:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/health"
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/system/status"
```

If `QONYX_SESSION_TOKEN` is configured, add:

```powershell
$headers = @{ "X-Qonyx-Session" = "your-token" }
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/health" -Headers $headers
```

## Inspect a running agent

The Runtime activity log in **Agent Studio** is the fastest way to follow a
three-agent run. It refreshes automatically every three seconds while the run is
active and records agent handoffs, stage durations, risk decisions, order
results, stop requests, and failures.

To inspect the same structured events from PowerShell:

```powershell
$qonyxApi = "http://127.0.0.1:8787"
$latestRun = (Invoke-RestMethod -Uri "$qonyxApi/api/agent-runs").runs[0]
$runId = $latestRun.id
(Invoke-RestMethod -Uri "$qonyxApi/api/agent-runs/$runId/events").events |
  Select-Object timestamp, level, category, role, cycleSequence, durationMs, message
```

If API session protection is enabled, add `-Headers $headers` to both requests.
Use the event's timestamp and cycle number to correlate it with API terminal
output or exchange/testnet logs. Qonyx keeps the newest 2,000 events per run in
memory; restarting the API clears them.

## Docker debugging

Build and start:

```powershell
docker compose up --build
```

Inspect status and logs:

```powershell
docker compose ps
docker compose logs api
docker compose logs web
```

Rebuild from a clean container state when an image looks stale:

```powershell
docker compose down
docker compose build --no-cache
docker compose up
```

The web URL is `http://127.0.0.1:8080`. Its `/api` requests are proxied to the
API container.

## Browser debugging

Open browser developer tools and use:

- **Console** for React/runtime errors.
- **Network** to inspect failed `/api/*` requests and Coinbase public-data
  requests.
- The failed response's JSON `error` and `issues` fields for exact validation
  details.

No Vercel Analytics script is loaded. A normal local page load should not make a
request to `/_vercel/insights/script.js`.

## Common failures

| Message or symptom | Cause | Action |
| --- | --- | --- |
| `A valid Qonyx session token is required` | API session protection is enabled | Enter the token on Exchanges or send `X-Qonyx-Session` |
| `Live trading is disabled` | Live adapters are off | Validate paper mode, then set `QONYX_ENABLE_LIVE_TRADING=true` on the API |
| `Mainnet trading is disabled` | A non-sandbox connection was selected | Use testnet, or deliberately set the second mainnet opt-in |
| `manual exchange cancellation is required` | Venue cancellation failed or could not be confirmed | Inspect and cancel orders at the venue immediately, then retry stop |
| `Request validation failed` | A form or AI/gateway payload failed its schema | Read the returned issue path; check symbol, limit price, and numeric bounds |
| `gateway returned an invalid response` | Custom bridge response does not match the contract | Compare it with `docs/exchange-gateway.md` |
| `AI provider returned invalid JSON` | Model included prose or malformed JSON | Test the connection, use a JSON-capable model, and inspect provider logs |
| Ollama cannot connect | Ollama is stopped or the model is missing | Start Ollama, pull the selected model, and test its local `/v1` endpoint |
| Coinbase backtest/brief fails | Public Coinbase request is blocked or rate-limited | Inspect Network, verify internet access, and retry later |
| Port already in use | Another API, Vite, or Docker process owns the port | Stop that process or change `QONYX_API_PORT`; stop Docker before local dev |

## Debug an external integration safely

1. Use paper mode to reproduce the agent and risk behavior.
2. Use an exchange testnet or a gateway stub.
3. Test the saved connection before starting a run.
4. Set a one-cycle limit and the smallest practical fund.
5. Confirm both a normal completion and a force stop at the venue.
6. Inspect open orders and balances directly at the venue.
7. Never use a key with withdrawal permission.

Real Binance, Bitget, Bybit, Moomoo, and third-party AI behavior cannot be
validated by the repository test suite without operator-provided sandbox
credentials or a running gateway. Treat adapter compilation and mocked contract
tests as necessary but not sufficient for a real integration.
