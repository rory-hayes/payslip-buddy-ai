import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str | None
    supabase_storage_bucket: str
    openai_api_key: str | None
    redis_url: str
    llm_spend_daily_cap_usd: float
    log_level: str
    internal_auth_token: str | None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        supabase_url=os.environ.get("SUPABASE_URL", ""),
        supabase_service_role_key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
        supabase_anon_key=os.environ.get("SUPABASE_ANON_KEY"),
        supabase_storage_bucket=os.environ.get("SUPABASE_STORAGE_BUCKET", "payslips"),
        openai_api_key=os.environ.get("OPENAI_API_KEY"),
        redis_url=os.environ.get("REDIS_URL", "redis://redis:6379/0"),
        llm_spend_daily_cap_usd=float(os.environ.get("LLM_SPEND_DAILY_CAP_USD", "10")),
        log_level=os.environ.get("LOG_LEVEL", "INFO"),
        internal_auth_token=os.environ.get("INTERNAL_AUTH_TOKEN"),
    )
