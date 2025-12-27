# Test script for LLM service

import requests
import json

BASE_URL = "http://localhost:5000"


def test_health():
    """Test health endpoint"""
    print("Testing /health endpoint...")
    response = requests.get(f"{BASE_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}\n")


def test_chat(message):
    """Test chat endpoint"""
    print(f"Testing /api/chat with message: '{message}'")
    response = requests.post(
        f"{BASE_URL}/api/chat",
        json={"message": message},
        headers={"Content-Type": "application/json"},
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Response: {data['response']}")
        print(f"Tokens used: {data.get('tokens_used', 'N/A')}\n")
    else:
        print(f"Error: {response.text}\n")


def test_resume():
    """Test resume context endpoint"""
    print("Testing /api/resume endpoint...")
    response = requests.get(f"{BASE_URL}/api/resume")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Context length: {len(data['context'])} characters\n")
    else:
        print(f"Error: {response.text}\n")


if __name__ == "__main__":
    print("=" * 60)
    print("LLM Service Test Suite")
    print("=" * 60 + "\n")

    # Test health
    test_health()

    # Test resume context
    test_resume()

    # Test various chat queries
    test_questions = [
        "What programming languages does Jose know?",
        "Tell me about Jose's experience at Asurion",
        "What cloud technologies has Jose worked with?",
        "Does Jose have experience with AI and machine learning?",
    ]

    for question in test_questions:
        test_chat(question)
        print("-" * 60 + "\n")
