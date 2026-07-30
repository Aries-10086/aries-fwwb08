from ai_service.schemas import ProviderOverride


def test_provider_override_as_updates_skips_empty() -> None:
    override = ProviderOverride(
        chat_base_url="https://example.com/v1",
        chat_api_key="sk-test",
        chat_model="qwen-plus",
        embedding_api_key="",
    )
    updates = override.as_updates()
    assert updates["chat_base_url"] == "https://example.com/v1"
    assert updates["chat_api_key"] == "sk-test"
    assert updates["chat_model"] == "qwen-plus"
    assert "embedding_api_key" not in updates
    assert "embedding_model" not in updates
