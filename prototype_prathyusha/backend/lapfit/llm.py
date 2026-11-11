"""LLM provider abstraction. Only Ollama (open-weight, local) is implemented; swap by config, not code."""
from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Protocol

import httpx

from .config import settings


@dataclass
class LLMResult:
    data: dict | None
    raw: str
    secs: float
    model: str
    error: str | None = None


class LLMProvider(Protocol):
    model: str

    def chat_json(self, system: str, user: str, schema: dict) -> LLMResult: ...


class OllamaProvider:
    def __init__(self, model: str | None = None, host: str | None = None, num_ctx: int = 4096, timeout: float = 300.0, retries: int = 1, num_predict: int = 450):
        self.model = model or settings.llm_model
        self.host = (host or settings.ollama_host).rstrip("/")
        self.num_ctx, self.timeout, self.retries, self.num_predict = num_ctx, timeout, retries, num_predict

    def chat_json(self, system: str, user: str, schema: dict) -> LLMResult:
        body = {"model": self.model, "stream": False, "format": schema,
                "options": {"temperature": 0, "num_ctx": self.num_ctx, "seed": 7, "num_predict": self.num_predict},
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
        last = ""
        for attempt in range(self.retries + 1):
            t0 = time.time()
            try:
                r = httpx.post(f"{self.host}/api/chat", json=body, timeout=self.timeout)
                r.raise_for_status()
                raw = r.json()["message"]["content"]
                try:
                    return LLMResult(json.loads(raw), raw, time.time() - t0, self.model)
                except json.JSONDecodeError as e:
                    last = f"invalid_json: {e}"
            except Exception as e:  # network/model errors: bounded retry then report
                last = f"{type(e).__name__}: {e}"
                time.sleep(1.0)
        return LLMResult(None, "", 0.0, self.model, error=last)
