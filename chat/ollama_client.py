import httpx
from typing import AsyncGenerator
import json


class OllamaClient:
    def __init__(self, base_url: str = "http://jasons-macbook-pro:11434"):
        self.base_url = base_url
        
    async def chat_stream(self, model: str, messages: list, system_prompt: str = None) -> AsyncGenerator[dict, None]:
        """Stream chat with an Ollama model"""
        # Prepare messages with system prompt if provided
        formatted_messages = []
        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})
        formatted_messages.extend(messages)
        
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": model,
            "messages": formatted_messages,
            "stream": True
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.strip():
                        yield json.loads(line)