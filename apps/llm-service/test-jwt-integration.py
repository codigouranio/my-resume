#!/usr/bin/env python3
"""Test JWT authentication integration"""
import os
import sys

# Set environment variables
os.environ["API_SERVICE_URL"] = "http://localhost:3000"
os.environ["LLM_SERVICE_USERNAME"] = "llm-service"
os.environ["LLM_SERVICE_PASSWORD"] = "IEkIrJbziQ7Q4GHFVznHu6z7AYk2WTZ6EUwwNTvNj7w="

print("=" * 60)
print("Testing JWT Authentication Integration")
print("=" * 60)

# Test 1: Initialize token manager
print("\n1. Initializing token manager...")
try:
    from token_manager import init_token_manager

    init_token_manager(
        api_url="http://localhost:3000",
        username="llm-service",
        password="IEkIrJbziQ7Q4GHFVznHu6z7AYk2WTZ6EUwwNTvNj7w=",
        start_background=False,  # Don't start background for test
    )
    print("✅ Token manager initialized")
except Exception as e:
    print(f"❌ Failed to initialize token manager: {e}")
    sys.exit(1)

# Test 2: Check api_client headers
print("\n2. Testing api_client JWT header generation...")
try:
    from api_client import get_headers

    headers = get_headers()
    print(f"   Headers: {list(headers.keys())}")

    if "Authorization" in headers and headers["Authorization"].startswith("Bearer "):
        print("✅ JWT Bearer token being used")
    else:
        print("❌ JWT token not in headers")
        sys.exit(1)
except Exception as e:
    print(f"❌ Error getting headers: {e}")
    sys.exit(1)

# Test 3: Load resume via API with JWT
print("\n3. Testing resume loading with JWT authentication...")
try:
    from api_client import load_resume_from_api

    resume_data = load_resume_from_api("hola")

    if resume_data:
        print(f"✅ Successfully loaded resume via JWT")
        print(f"   Resume: {resume_data.get('name', 'N/A')}")
    else:
        print("❌ No resume data returned")
        sys.exit(1)
except Exception as e:
    print(f"❌ Error loading resume: {e}")
    sys.exit(1)

print("\n" + "=" * 60)
print("✅ All JWT Integration Tests PASSED!")
print("=" * 60)
