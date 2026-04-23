"""
Model registry for Nexus Computer.

Nexus AI is the sole AI provider — the sovereign, self-hosted intelligence
layer of the Nexus ecosystem. No external API keys required.
"""

import os
import httpx
from datetime import datetime, timezone
from typing import Optional


def _now():
    return datetime.now(timezone.utc).isoformat()


class Model:
    def __init__(self, id: str, name: str, provider: str, capabilities: dict, config: dict):
        self.id = id
        self.name = name
        self.provider = provider
        self.capabilities = capabilities
        self.config = config
        self.available = True
        self.last_check = None

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "provider": self.provider,
            "capabilities": self.capabilities,
            "available": self.available,
            "last_check": self.last_check,
        }


class ModelRegistry:
    def __init__(self):
        self.models: dict[str, Model] = {}
        self._init()

    def _init(self):
        nexus_ai_url = os.environ.get("NEXUS_AI_URL", "http://localhost:7866").rstrip("/")

        self.register(Model(
            id="nexus-ai",
            name="Nexus AI",
            provider="nexus-ai",
            capabilities={
                "chat": True,
                "code": True,
                "analysis": True,
                "creative": True,
                "local": True,
                "private": True,
            },
            config={
                "endpoint": nexus_ai_url,
                "completions_url": f"{nexus_ai_url}/v1/chat/completions",
                "health_url": f"{nexus_ai_url}/health",
            },
        ))

    def register(self, model: Model):
        self.models[model.id] = model

    def get_model(self, model_id: str) -> Optional[Model]:
        return self.models.get(model_id)

    def list_models(self):
        return list(self.models.values())

    def get_default_model(self) -> Model:
        return self.models["nexus-ai"]

    async def check_availability(self, model: Model) -> bool:
        try:
            health_url = model.config.get("health_url", f"{model.config.get('endpoint', '')}/health")
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(health_url, follow_redirects=True)
                model.available = resp.status_code == 200
        except Exception:
            model.available = False
        model.last_check = _now()
        return model.available


_registry: Optional[ModelRegistry] = None


def get_registry() -> ModelRegistry:
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
    return _registry


def get_model(model_id: str) -> Optional[Model]:
    return get_registry().get_model(model_id)


def list_models():
    return get_registry().list_models()


def get_default_model() -> Model:
    return get_registry().get_default_model()


async def check_availability(model_id: str) -> bool:
    model = get_model(model_id)
    if not model:
        return False
    return await get_registry().check_availability(model)
