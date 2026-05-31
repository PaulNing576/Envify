# Test fixture: clean file with no secrets
import os
import openai

api_key = os.getenv("OPENAI_API_KEY")
openai_client = openai.OpenAI(api_key=api_key)

message = "Hello, world!"
name = "sk-learn-model-v1"
description = "This is just a normal string"
