from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from typing import Literal, List
import json

from .ollama_client import OllamaClient
from .word_service import WordService

router = APIRouter(prefix="/chat", tags=["chat"])
ollama_client = OllamaClient()
word_service = WordService()

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class WordChatRequest(BaseModel):
    message: str
    conversation_history: List[ChatMessage] = []
    model: Literal["gpt-oss:20b"] = "gpt-oss:20b"

class ChatRequest(BaseModel):
    message: str
    model: Literal["gpt-oss:20b"] = "gpt-oss:20b"

@router.post("/word/{word}")
async def chat_about_word(word: str, request: WordChatRequest):
    """Stream chat about a specific word with system prompt"""
    # Get word context from backend
    word_context = word_service.get_word_context(word, max_examples=10)
    if not word_context:
        raise HTTPException(status_code=404, detail=f"Word '{word}' not found")
    
    # Create system prompt
    system_prompt = word_service.create_system_prompt(word_context)
    
    # Build conversation messages
    messages = []
    # Add conversation history if provided
    for msg in request.conversation_history:
        messages.append({"role": msg.role, "content": msg.content})
    # Add current user message
    messages.append({"role": "user", "content": request.message})
    
    async def generate():
        async for chunk in ollama_client.chat_stream(request.model, messages, system_prompt):
            yield f"data: {json.dumps(chunk)}\n\n"
    
    return StreamingResponse(generate(), media_type="text/plain")

@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """Stream chat with Ollama model"""
    messages = [{"role": "user", "content": request.message}]
    
    async def generate():
        async for chunk in ollama_client.chat_stream(request.model, messages):
            yield f"data: {json.dumps(chunk)}\n\n"
    
    return StreamingResponse(generate(), media_type="text/plain")