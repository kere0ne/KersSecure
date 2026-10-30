from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    database_url: str
    service_api_token: str
    license_hash_secret: str
    obfuscator_url: str = 'http://127.0.0.1:8100'
    discord_bot_internal_token: str = ''

settings = Settings()
