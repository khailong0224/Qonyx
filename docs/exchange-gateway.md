# Qonyx exchange-gateway contract

Use this small HTTP contract to connect Moomoo/Futu OpenD or another platform
that is not exposed directly by CCXT.

Gateway URLs must use HTTPS, except `http://127.0.0.1`, `http://localhost`, or
`http://[::1]`. If a gateway token is configured, Qonyx sends:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

## Health

```http
GET /health
```

```json
{ "ok": true, "message": "Moomoo OpenD paper account connected." }
```

## Market snapshot

```http
GET /market?symbol=BTC%2FUSD
```

```json
{
  "ask": 118020,
  "bid": 117980,
  "changePercent24h": 1.4,
  "price": 118000,
  "symbol": "BTC/USD",
  "timestamp": "2026-07-25T08:00:00.000Z",
  "volume24h": 21000
}
```

## Account

```http
GET /account?symbol=BTC%2FUSD
```

```json
{
  "availableCashUsd": 9000,
  "equityUsd": 10020,
  "exposureUsd": 1020,
  "positionBase": 0.00864,
  "realizedPnlUsd": 20,
  "symbol": "BTC/USD"
}
```

## Place order

```http
POST /orders
```

```json
{
  "symbol": "BTC/USD",
  "intent": {
    "action": "buy",
    "notionalUsd": 500,
    "orderType": "market",
    "reason": "Risk-approved momentum entry"
  }
}
```

The response must match the Qonyx `OrderResult` shape:

```json
{
  "action": "buy",
  "amountBase": 0.00423,
  "averagePrice": 118100,
  "feeUsd": 0.5,
  "id": "venue-order-id",
  "notionalUsd": 500,
  "platform": "moomoo",
  "status": "filled",
  "symbol": "BTC/USD",
  "timestamp": "2026-07-25T08:00:03.000Z"
}
```

## Cancel all open orders

```http
DELETE /orders?symbol=BTC%2FUSD
```

Return any `2xx` JSON response. This route must be idempotent because Qonyx
calls it during every force-stop operation.
