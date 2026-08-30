from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    groq_api_key: str | None = None
    groq_main_model: str = "openai/gpt-oss-20b"
    groq_prompt_guard_model: str = "meta-llama/llama-prompt-guard-2-86m"
    groq_output_guard_model: str = "openai/gpt-oss-safeguard-20b"
    groq_output_guard_enabled: bool = False
    prompt_guard_required: bool = True
    database_url: str = "sqlite+aiosqlite:///./post_offer_hq.db"


@lru_cache
def get_settings() -> Settings:
    return Settings()
