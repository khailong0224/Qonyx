# Qonyx user guide

Qonyx has two distinct layers:

- **Agent Studio** and the global kill switch are backed by the local API.
- The dashboard strategy cards, Bot Control page, illustrative Risk Center
  metrics, and Strategy Lab's Create Bot action are local demonstrations. They
  do not place orders.

Qonyx is experimental software, not financial advice. Begin with the built-in
paper workflow.

## Start Qonyx

### Local development

Install Node.js 22 or newer, then run:

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:5173`. The API listens on
`http://127.0.0.1:8787`.

### Isolated Docker sandbox

```powershell
docker compose up --build
```

Open `http://127.0.0.1:8080`. The supplied compose configuration disables both
live adapters and mainnet trading.

## First paper run

1. Open **Agent Studio**.
2. Keep **Qonyx paper sandbox** selected.
3. Enter a crypto pair such as `BTC/USD`.
4. Set the agent fund, maximum order, realized-loss stop for the run, maximum
   position, cycle interval, and cycle limit.
5. Leave all three AI-provider selectors on **Built-in deterministic sandbox**.
6. Select **Start three-agent workflow**.
7. Watch **Runtime activity log** for lifecycle, agent, risk, order, and system
   events. Each completed stage includes its duration.
8. Filter the log by category or warnings/errors. Select **Refresh** for an
   immediate update or **Export JSON** to download the current run's audit log.
9. Use **Run one cycle now** for an immediate cycle, or **Force stop agent** to
   stop the run and request order cancellation.

A cycle limit of `0` means continuous scheduling. A positive limit cancels open
orders before the run is marked complete.

## Feature map

| Page | What it does | Places orders? |
| --- | --- | --- |
| Dashboard | Local sample metrics, strategy cards, navigation, and real global kill switch | Only the kill switch calls the API |
| Strategy Lab | Runs a simplified 60-day backtest with public Coinbase candles | No |
| Bots | Edits local prototype bot state | No |
| Agent Studio | Runs the three-agent API workflow through the risk engine and exchange adapter | Yes, in paper mode or an explicitly enabled live adapter |
| AI Research | Produces a rule-based BTC-USD summary from public Coinbase data | No |
| Risk Center | Shows illustrative metrics and the real global kill switch | The kill switch cancels/stops; metrics are illustrative |
| Exchanges | Configures AI and venue connections in the server's memory vault | Connection tests only |

Strategy Lab does not model trading fees or slippage, so its results are
historical estimates rather than execution forecasts.

## Add an AI provider

1. Open **Exchanges**.
2. Choose an OpenAI-compatible service, local Ollama, or the built-in sandbox.
3. Enter the model, base URL when needed, and key when required.
4. Save the connection.
5. Select **Test**. Qonyx verifies valid structured output for the analyst,
   trader, and reporter roles.
6. Return to **Agent Studio** and assign a provider independently to each role.

Keys are sent to the API, held in process memory, and never returned to the
browser. Restarting the API clears all connections.

Ollama is restricted to localhost. Remote provider URLs must use HTTPS. URLs
containing a username or password are rejected; use the API-key field instead.

## Protect the API with a session token

Set a server-only environment variable:

```powershell
$env:QONYX_SESSION_TOKEN = "use-a-long-random-value"
npm.cmd run dev
```

Open **Exchanges**, paste the same value into **Qonyx session token**, and select
**Apply token**. The browser keeps it only in memory for the current tab. A
refresh clears it, and it is never written to local storage.

For direct API calls:

```powershell
$headers = @{ "X-Qonyx-Session" = "use-a-long-random-value" }
Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/health" -Headers $headers
```

## Use an exchange testnet

1. Create an exchange testnet or sandbox key with withdrawals disabled.
2. Open **Exchanges**, choose Binance, Bitget, or Bybit, keep
   **Use exchange sandbox / testnet** enabled, and save the credentials.
3. Test the connection.
4. Stop Qonyx.
5. Enable live adapters on the API process:

```powershell
$env:QONYX_ENABLE_LIVE_TRADING = "true"
npm.cmd run dev
```

6. In **Agent Studio**, choose **Live / exchange testnet**, select the tested
   connection, use a small fund, and start the workflow.

This flag enables exchange adapters; it does not enable mainnet. A non-sandbox
connection additionally requires:

```powershell
$env:QONYX_ALLOW_MAINNET_TRADING = "true"
```

Do not enable mainnet until the same strategy, cancellation path, and loss limit
have been validated on testnet. Qonyx does not persist its live per-run ledger.
After an API restart, reconcile open orders and positions directly at the venue
before starting another live run.

## Moomoo and custom gateways

Qonyx provides an HTTP gateway contract, not a bundled Futu OpenD bridge. Run a
local bridge that implements [exchange-gateway.md](exchange-gateway.md), then:

1. Add a **Moomoo / Futu OpenD** or **Custom Webhook** connection.
2. Enter its HTTPS URL, or an HTTP loopback URL such as
   `http://127.0.0.1:9000`.
3. Test the connection.
4. In Agent Studio enter the venue symbol, for example `US.AAPL`.

Gateway account, market, health, and order responses are schema-validated before
Qonyx uses them.

## Stops and reports

- The Runtime activity log updates every three seconds while a run is active.
  It keeps the newest 2,000 structured events for each in-memory run.
- **Export JSON** downloads the run identity, status, symbol, platform, mode,
  export time, and event stream. It does not include connection credentials.
- **Force stop agent** aborts the active AI call, clears its next timer, and asks
  the venue to cancel open orders.
- **Force stop all** does the same for every active run and locks new runs.
- **Unlock system** removes the global lock but does not restart stopped runs.
- If cancellation cannot be confirmed, the run becomes failed and displays
  **manual exchange cancellation is required**. Check the venue immediately,
  cancel there if necessary, then retry the stop action.
- Run history and reports are available until the API process restarts.
- Direct API clients can retrieve the same event stream from
  `GET /api/agent-runs/:id/events`.
