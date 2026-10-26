// KI-Anbindung. Standard ist Pollinations.ai: kostenlos, ohne Anmeldung und
// ohne API-Key. Das Free-Tier erlaubt ca. 1 Antwort pro 30 Sekunden pro IP,
// deshalb werden mehrere Wochen pro Anfrage gebündelt.

const AI_PROVIDERS = {
  pollinations: {
    label: "Pollinations.ai (kostenlos, ohne Anmeldung)",
    url: "https://text.pollinations.ai/openai",
    model: "openai",
    minInterval: 31000,
  },
  custom: { label: "Eigener API-Key (OpenAI-kompatibel)", minInterval: 0 },
  offline: { label: "Offline-Vorlagen (ohne KI)" },
};

const AI_PRESETS = {
  groq: {
    label: "Groq (Free-Tier)",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "meta-llama/llama-3.3-70b-instruct:free",
  },
  ollama: {
    label: "Ollama (lokal)",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.1",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
};

let lastReplyAt = 0;
// Wird kurzzeitig auf "custom" gesetzt, wenn die kostenlose KI ausfällt
let providerOverride = null;

function activeProvider() {
  return providerOverride || state.ai.provider;
}

// Reserve: Fällt die kostenlose KI aus und ist ein eigener Schlüssel eingerichtet,
// wird die Anfrage damit wiederholt.
function canUseFallback() {
  const { ai } = state;
  return (
    ai.provider === "pollinations" &&
    ai.fallbackToCustom &&
    Boolean(ai.baseUrl && ai.model) &&
    // Bekannte Anbieter brauchen einen Schlüssel; eigene Server oder Ollama nicht
    (Boolean(ai.apiKey) || !/api\.groq\.com|api\.openai\.com|openrouter\.ai/.test(ai.baseUrl))
  );
}

async function withFallback(task, onStatus) {
  try {
    return await task();
  } catch (error) {
    if (error.name === "AbortError" || providerOverride || !canUseFallback()) {
      throw error;
    }
    onStatus?.("Die kostenlose KI antwortet nicht. Ich nutze deinen eigenen Schlüssel.");
    providerOverride = "custom";
    try {
      return await task();
    } finally {
      providerOverride = null;
    }
  }
}

class RateLimitError extends Error {
  constructor(message, waitMs) {
    super(message);
    this.waitMs = waitMs;
  }
}

function abortableWait(ms, signal, onTick) {
  return new Promise((resolve, reject) => {
    const until = Date.now() + ms;
    const tick = () => {
      if (signal?.aborted) {
        clearInterval(timer);
        reject(new DOMException("Abgebrochen", "AbortError"));
        return;
      }
      const remaining = until - Date.now();
      if (remaining <= 0) {
        clearInterval(timer);
        resolve();
        return;
      }
      onTick?.(Math.ceil(remaining / 1000));
    };
    const timer = setInterval(tick, 250);
    tick();
  });
}

async function requestCompletion(messages, signal) {
  const provider = activeProvider();
  let url;
  const headers = { "Content-Type": "application/json" };
  const body = { messages, temperature: 0.8 };

  if (provider === "pollinations") {
    url = AI_PROVIDERS.pollinations.url;
    body.model = AI_PROVIDERS.pollinations.model;
    body.response_format = { type: "json_object" };
    body.seed = Math.floor(Math.random() * 1e9);
    // Das Gratis-Modell ist ein Reasoning-Modell: wenig "Nachdenken" lässt
    // mehr Budget für die eigentliche Antwort (sonst oft leer/abgeschnitten)
    body.reasoning_effort = "low";
    body.max_tokens = 6000;
  } else {
    url = `${state.ai.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    body.model = state.ai.model;
    if (state.ai.apiKey) {
      headers.Authorization = `Bearer ${state.ai.apiKey}`;
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (response.status === 402 || response.status === 429) {
    const text = await response.text();
    const retryHeader = Number(response.headers.get("retry-after"));
    const retryMatch = text.match(/retry after (\d+)\s*s/i);
    const waitSeconds = retryMatch ? Number(retryMatch[1]) + 1 : retryHeader || 30;
    throw new RateLimitError("Rate-Limit erreicht", waitSeconds * 1000);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`KI-Dienst antwortet mit ${response.status} ${text.slice(0, 160)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Leere Antwort vom KI-Dienst");
  }
  return content;
}

// Eine Anfrage mit Limit-Wartezeit und bis zu 3 Versuchen. Liefert den Rohtext.
async function completeWithRetry(messages, { signal, onStatus }) {
  const minInterval = AI_PROVIDERS[activeProvider()]?.minInterval || 0;
  let failures = 0;
  let rateLimits = 0;

  for (;;) {
    const waitMs = lastReplyAt + minInterval - Date.now();
    if (waitMs > 0) {
      await abortableWait(waitMs, signal, (seconds) =>
        onStatus?.(`Nächste Anfrage in ${seconds} s (Limit der kostenlosen KI)`),
      );
    }
    onStatus?.("Die KI schreibt");
    try {
      const content = await requestCompletion(messages, signal);
      lastReplyAt = Date.now();
      return content;
    } catch (error) {
      if (error.name === "AbortError") {
        throw error;
      }
      if (error instanceof RateLimitError) {
        rateLimits += 1;
        if (rateLimits > 12) {
          throw new Error("Kostenloses Limit dauerhaft erreicht", { cause: error });
        }
        await abortableWait(Math.max(error.waitMs, minInterval, 5000), signal, (seconds) =>
          onStatus?.(`Die kostenlose KI braucht eine Pause. Weiter in ${seconds} s`),
        );
        continue;
      }
      lastReplyAt = Date.now();
      failures += 1;
      if (failures >= 3) {
        throw error;
      }
      onStatus?.("Kein Ergebnis, neuer Versuch");
    }
  }
}
