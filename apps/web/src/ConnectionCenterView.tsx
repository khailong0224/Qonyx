import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Link2,
  LoaderCircle,
  LockKeyhole,
  PlugZap,
  ServerCog,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  qonyxApi,
  type AiProviderKind,
  type ConnectionSummary,
  type ExchangePlatform,
  type PlatformCapability,
} from "./services/qonyxApi";

export function ConnectionCenterView() {
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [platforms, setPlatforms] = useState<PlatformCapability[]>([]);
  const [aiProvider, setAiProvider] = useState<AiProviderKind>("openai-compatible");
  const [aiLabel, setAiLabel] = useState("My AI provider");
  const [aiModel, setAiModel] = useState("gpt-4.1-mini");
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [exchangePlatform, setExchangePlatform] =
    useState<ExchangePlatform>("binance");
  const [exchangeLabel, setExchangeLabel] = useState("My exchange");
  const [exchangeApiKey, setExchangeApiKey] = useState("");
  const [exchangeSecret, setExchangeSecret] = useState("");
  const [exchangePassphrase, setExchangePassphrase] = useState("");
  const [exchangeBaseUrl, setExchangeBaseUrl] = useState("");
  const [exchangeSandbox, setExchangeSandbox] = useState(true);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const refresh = async () => {
    const [connectionResult, platformResult] = await Promise.all([
      qonyxApi.getConnections(),
      qonyxApi.getPlatforms(),
    ]);
    setConnections(connectionResult.connections);
    setPlatforms(platformResult.platforms);
  };

  useEffect(() => {
    refresh().catch((refreshError: unknown) =>
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to reach the Qonyx API.",
      ),
    );
  }, []);

  const perform = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(undefined);
    setNotice(undefined);
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.");
    } finally {
      setBusy(undefined);
    }
  };

  const addAiConnection = () =>
    perform("add-ai", async () => {
      await qonyxApi.createAiConnection({
        apiKey: aiApiKey || undefined,
        baseUrl: aiBaseUrl || undefined,
        label: aiLabel,
        model: aiModel,
        provider: aiProvider,
      });
      setAiApiKey("");
      await refresh();
      setNotice("AI connection stored in server memory. The key was not returned to the browser.");
    });

  const addExchangeConnection = () =>
    perform("add-exchange", async () => {
      await qonyxApi.createExchangeConnection({
        apiKey: exchangeApiKey || undefined,
        baseUrl: exchangeBaseUrl || undefined,
        label: exchangeLabel,
        passphrase: exchangePassphrase || undefined,
        platform: exchangePlatform,
        sandbox: exchangeSandbox,
        secret: exchangeSecret || undefined,
      });
      setExchangeApiKey("");
      setExchangeSecret("");
      setExchangePassphrase("");
      await refresh();
      setNotice("Exchange credentials stored in server memory.");
    });

  const testConnection = (connection: ConnectionSummary) =>
    perform(`test-${connection.id}`, async () => {
      const result = await qonyxApi.testConnection(connection.id);
      setNotice(`${connection.label}: ${result.message}`);
    });

  const deleteConnection = (connection: ConnectionSummary) =>
    perform(`delete-${connection.id}`, async () => {
      await qonyxApi.deleteConnection(connection.id);
      await refresh();
      setNotice(`${connection.label} removed from the credential vault.`);
    });

  const needsGateway = exchangePlatform === "moomoo" || exchangePlatform === "webhook";

  return (
    <div className="view-stack connection-center">
      <section className="connection-hero onyx-card">
        <div>
          <div className="inline-label violet">
            <LockKeyhole size={16} />
            Bring your own keys
          </div>
          <h1>Connections & Secret Vault</h1>
          <p>
            API keys are sent directly to the local Qonyx server, held only in memory,
            redacted in every response, and never written to browser storage.
          </p>
        </div>
        <div className="secret-policy">
          <ShieldCheck size={24} />
          <div>
            <strong>Server-side only</strong>
            <span>No VITE_* secret variables</span>
          </div>
        </div>
      </section>

      {error && (
        <div className="agent-message error-message" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="agent-message success-message">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      <section className="connection-form-grid">
        <div className="onyx-card connection-form-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">AI provider</p>
              <h2>Analysis, trading, reports</h2>
            </div>
            <KeyRound size={22} />
          </div>
          <div className="stacked-fields">
            <label className="field">
              <span>Provider</span>
              <select
                value={aiProvider}
                onChange={(event) => {
                  const provider = event.target.value as AiProviderKind;
                  setAiProvider(provider);
                  setAiBaseUrl(
                    provider === "ollama" ? "http://127.0.0.1:11434/v1" : "",
                  );
                  if (provider === "sandbox") {
                    setAiModel("qonyx-sandbox");
                  }
                }}
              >
                <option value="openai-compatible">OpenAI-compatible API</option>
                <option value="ollama">Ollama on this computer</option>
                <option value="sandbox">Built-in deterministic sandbox</option>
              </select>
            </label>
            <label className="field">
              <span>Connection name</span>
              <input
                value={aiLabel}
                onChange={(event) => setAiLabel(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Model</span>
              <input
                value={aiModel}
                onChange={(event) => setAiModel(event.target.value)}
              />
            </label>
            {aiProvider !== "sandbox" && (
              <label className="field">
                <span>Base URL {aiProvider === "ollama" ? "" : "(optional)"}</span>
                <input
                  placeholder={
                    aiProvider === "ollama"
                      ? "http://127.0.0.1:11434/v1"
                      : "https://api.openai.com/v1"
                  }
                  value={aiBaseUrl}
                  onChange={(event) => setAiBaseUrl(event.target.value)}
                />
              </label>
            )}
            {aiProvider === "openai-compatible" && (
              <label className="field">
                <span>API key</span>
                <input
                  autoComplete="off"
                  placeholder="Stored in server memory"
                  type="password"
                  value={aiApiKey}
                  onChange={(event) => setAiApiKey(event.target.value)}
                />
              </label>
            )}
          </div>
          <button
            className="btn btn-primary full-width"
            disabled={Boolean(busy)}
            type="button"
            onClick={addAiConnection}
          >
            {busy === "add-ai" ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <KeyRound size={18} />
            )}
            Save AI connection
          </button>
        </div>

        <div className="onyx-card connection-form-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Trading venue</p>
              <h2>Exchange or gateway</h2>
            </div>
            <PlugZap size={22} />
          </div>
          <div className="stacked-fields">
            <label className="field">
              <span>Platform</span>
              <select
                value={exchangePlatform}
                onChange={(event) =>
                  setExchangePlatform(event.target.value as ExchangePlatform)
                }
              >
                {platforms
                  .filter((platform) => platform.id !== "paper")
                  .map((platform) => (
                    <option key={platform.id} value={platform.id}>
                      {platform.label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>Connection name</span>
              <input
                value={exchangeLabel}
                onChange={(event) => setExchangeLabel(event.target.value)}
              />
            </label>
            {needsGateway ? (
              <label className="field">
                <span>Gateway base URL</span>
                <input
                  placeholder="https://gateway.example.com"
                  value={exchangeBaseUrl}
                  onChange={(event) => setExchangeBaseUrl(event.target.value)}
                />
              </label>
            ) : (
              <>
                <label className="field">
                  <span>API key</span>
                  <input
                    autoComplete="off"
                    type="password"
                    value={exchangeApiKey}
                    onChange={(event) => setExchangeApiKey(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>API secret</span>
                  <input
                    autoComplete="off"
                    type="password"
                    value={exchangeSecret}
                    onChange={(event) => setExchangeSecret(event.target.value)}
                  />
                </label>
                {exchangePlatform === "bitget" && (
                  <label className="field">
                    <span>Passphrase</span>
                    <input
                      autoComplete="off"
                      type="password"
                      value={exchangePassphrase}
                      onChange={(event) => setExchangePassphrase(event.target.value)}
                    />
                  </label>
                )}
              </>
            )}
            {needsGateway && (
              <label className="field">
                <span>Gateway token (optional)</span>
                <input
                  autoComplete="off"
                  type="password"
                  value={exchangeApiKey}
                  onChange={(event) => setExchangeApiKey(event.target.value)}
                />
              </label>
            )}
            <label className="checkbox-field">
              <input
                checked={exchangeSandbox}
                type="checkbox"
                onChange={(event) => setExchangeSandbox(event.target.checked)}
              />
              <span>Use exchange sandbox / testnet</span>
            </label>
          </div>
          <button
            className="btn btn-secondary full-width"
            disabled={Boolean(busy)}
            type="button"
            onClick={addExchangeConnection}
          >
            {busy === "add-exchange" ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Link2 size={18} />
            )}
            Save exchange connection
          </button>
        </div>
      </section>

      <section className="onyx-card saved-connections">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Session vault</p>
            <h2>Saved connections</h2>
          </div>
          <span className="status-badge paper">{connections.length} in memory</span>
        </div>
        {connections.length === 0 ? (
          <div className="agent-empty">
            <ServerCog size={26} />
            <p>No credentials are stored. Paper agents work without any connection.</p>
          </div>
        ) : (
          <div className="connection-list">
            {connections.map((connection) => (
              <article key={connection.id} className="connection-row">
                <div className="connection-icon">
                  {connection.kind === "ai" ? <KeyRound size={20} /> : <PlugZap size={20} />}
                </div>
                <div className="connection-copy">
                  <strong>{connection.label}</strong>
                  <span>
                    {connection.kind === "ai"
                      ? `${connection.provider} · ${connection.model}`
                      : `${connection.platform} · ${connection.sandbox ? "sandbox" : "live"}`}
                  </span>
                </div>
                <span className="secret-last-four">
                  {connection.secretLast4 ? `•••• ${connection.secretLast4}` : "No secret"}
                </span>
                <div className="connection-actions">
                  <button
                    className="btn btn-secondary"
                    disabled={Boolean(busy)}
                    type="button"
                    onClick={() => testConnection(connection)}
                  >
                    {busy === `test-${connection.id}` ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    Test
                  </button>
                  <button
                    aria-label={`Delete ${connection.label}`}
                    className="icon-button"
                    disabled={Boolean(busy)}
                    type="button"
                    onClick={() => deleteConnection(connection)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="platform-capability-grid">
        {platforms.map((platform) => (
          <article key={platform.id} className="onyx-card platform-capability">
            <div>
              <PlugZap size={19} />
              <strong>{platform.label}</strong>
            </div>
            <p>{platform.note}</p>
            <span className={`status-badge ${platform.id === "paper" ? "paper" : "neutral"}`}>
              {platform.id === "paper" ? "Ready" : "Adapter available"}
            </span>
          </article>
        ))}
      </section>
    </div>
  );
}
