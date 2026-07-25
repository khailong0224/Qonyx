# Qonyx architecture

## Safety boundary

```text
market + account
       |
       v
 Atlas Analyst
       |
  typed analysis
       v
 Vector Trader
       |
 typed trade intent
       v
 deterministic risk engine ---- emergency stop
       |
 approved/adjusted intent
       v
 exchange adapter
       |
 account + execution result
       v
 Ledger Reporter
```

AI agents are pure decision services. They receive only market, account, risk,
and prior-agent data. They do not receive API keys, do not import exchange
adapters, and cannot call order methods.

The orchestrator is the only component that can pass a trade intent to the risk
engine. The risk engine is the only route to an exchange adapter. Schema
validation rejects malformed AI output before it reaches either component.

## Fund invariant

For buy orders the approved notional is:

```text
min(
  AI requested notional,
  maximum order,
  agent fund - current exposure,
  maximum position - current exposure,
  available cash after fee reserve
)
```

Sell orders are limited to the funded long position. Qonyx does not propose or
execute leverage, margin, or short positions.

The paper exchange independently clamps a fill to available cash. This
defence-in-depth means an invalid caller cannot make the simulated account spend
past its funded balance.

## Force stop

The global stop flag is checked before a run and before every risk decision.
Activating it:

1. blocks new runs and cycles;
2. marks active runs as stopping;
3. aborts the current AI provider request;
4. clears the next-cycle timer;
5. asks each adapter to cancel open orders;
6. records the run as stopped.

Unlocking removes the global flag but never restarts a stopped run.

## Credentials

The browser submits credentials over the API connection. The server stores them
in a process-memory vault and returns only metadata plus the last four
characters of an API key. Refreshing or restarting the API clears the vault.

For a multi-user hosted deployment, replace the in-memory vault with an
authenticated per-user encrypted secret store or KMS. Do not persist plaintext
credentials in a relational or vector database.

## AI providers

- **Sandbox:** deterministic local logic for repeatable tests.
- **Ollama:** restricted to localhost and called through `/v1/chat/completions`.
- **OpenAI-compatible:** HTTPS is required except on localhost.

Each role can use a different provider connection and model. A 30-second
provider timeout and an abort signal prevent a stuck model request from blocking
force stop.

## Trading platforms

- Paper: built-in, synchronous spot fills.
- Binance, Bitget, Bybit: CCXT spot API.
- Moomoo/Futu OpenD: local gateway implementing the Qonyx HTTP contract.
- Other venue: HTTPS gateway implementing the same contract.

Live adapters are unreachable unless `QONYX_ENABLE_LIVE_TRADING=true`.

## Persistence

Connections and run history are intentionally process-local in this version.
This keeps the sandbox stateless and prevents accidental credential persistence.
Production persistence can store run/cycle/report records in PostgreSQL or
Supabase, but credentials should remain in a dedicated encrypted secret store.
