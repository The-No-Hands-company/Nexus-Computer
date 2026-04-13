"""
Model registry and routing for Nexus Computer.

Supports multiple AI model providers with capability tracking,
availability checking, and intelligent fallback routing.

Available models:
- nexus-ai (localhost:7866) — Local, private, default
- claude-opus-4 — Advanced reasoning, complex tasks
- claude-haiku — Fast, lightweight, low cost
"""

import os
import json
import httpx
from datetime import datetime, timezone
from typing import Optional


def _now():
    """Return current ISO timestamp."""
    return datetime.now(timezone.utc).isoformat()


class Model:
    """Represents an available model with metadata."""

    def __init__(self, id: str, name: str, provider: str, capabilities: dict, config: dict):
        self.id = id
        self.name = name
        self.provider = provider  # "nexus-ai", "anthropic", "ollama", etc.
        self.capabilities = capabilities  # {"chat": True, "code": True, "analysis": True, ...}
        self.config = config  # {"api_key": "...", "endpoint": "...", "model_name": "..."}
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
    """Registry of available models with capability tracking."""

    def __init__(self):
        self.models = {}
        self._initialize_default_models()

    def _initialize_default_models(self):
        """Set up default models."""
        # Nexus AI — local, private, always available
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
                "endpoint": os.environ.get("NEXUS_AI_URL", "http://localhost:7866"),
                "model_name": os.environ.get("NEXUS_MODEL", "nexus-ai"),
            },
        ))

        # Claude Opus — advanced reasoning, requires API key
        if os.environ.get("ANTHROPIC_API_KEY"):
            self.register(Model(
                id="claude-opus-4",
                name="Claude Opus 4",
                provider="anthropic",
                capabilities={
                    "chat": True,
                    "code": True,
                    "analysis": True,
                    "creative": True,
                    "long_context": True,
                },
                config={
                    "api_key": os.environ.get("ANTHROPIC_API_KEY"),
                    "model_name": "claude-opus-4-20250514",
                },
            ))

            # Claude Haiku — fast, lightweight
            self.register(Model(
                id="claude-haiku",
                name="Claude Haiku",
                provider="anthropic",
                capabilities={
                    "chat": True,
                    "code": True,
                    "analysis": False,
                    "fast": True,
                    "lightweight": True,
                },
                config={
                    "api_key": os.environ.get("ANTHROPIC_API_KEY"),
                    "model_name": "claude-3-5-haiku-20241022",
                },
            ))

    def register(self, model: Model):
        """Register a model."""
        self.models[model.id] = model

    def get_model(self, model_id: str) -> Optional[Model]:
        """Get a model by ID."""
        return self.models.get(model_id)

    def list_models(self):
        """List all available models."""
        return list(self.models.values())

    def find_capable_model(self, capability: str, avoid: list = None):
        """Find a model with a specific capability, optionally avoiding certain models.
        
        Args:
            capability: Capability string (e.g., "code", "analysis")
            avoid: List of model IDs to skip
        
        Returns:
            Model with capability, or None if none found
        """
        avoid = avoid or []
        for model in self.list_models():
            if (model.id not in avoid and
                model.available and
                model.capabilities.get(capability, False)):
                return model
        return None

    def get_default_model(self):
        """Get default model (Nexus AI)."""
        return self.get_model("nexus-ai")

    async def check_availability(self, model: Model) -> bool:
        """Check if a model is available by making a test request."""
        try:
            if model.provider == "nexus-ai":
                # Quick health check
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(
                        f"{model.config.get('endpoint')}/health",
                        follow_redirects=True,
                    )
                    model.available = resp.status_code == 200
            elif model.provider == "anthropic":
                # Anthropic SDK will validate API key on first use
                # For now, assume available if API key present
                model.available = bool(model.config.get("api_key"))
            else:
                model.available = True  # Unknown provider, assume available
        except Exception as e:
            model.available = False
            print(f"Model availability check failed for {model.id}: {e}")

        model.last_check = _now()
        return model.available

    def to_dict(self):
        """Serialize registry to dict."""
        return {
            model_id: model.to_dict()
            for model_id, model in self.models.items()
        }


# Global registry instance
_registry = None


def get_registry():
    """Get or create the global model registry."""
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
    return _registry


def get_model(model_id: str) -> Optional[Model]:
    """Get a model from the global registry."""
    return get_registry().get_model(model_id)


def list_models():
    """Get all models from the global registry."""
    return get_registry().list_models()


def get_default_model() -> Model:
    """Get default model."""
    return get_registry().get_default_model()


def find_capable_model(capability: str, avoid: list = None) -> Optional[Model]:
    """Find a model with specific capability."""
    return get_registry().find_capable_model(capability, avoid)


async def check_availability(model_id: str) -> bool:
    """Check if model is available."""
    model = get_model(model_id)
    if not model:
        return False
    registry = get_registry()
    return await registry.check_availability(model)
