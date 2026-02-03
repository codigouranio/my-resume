#!/bin/bash
# Request handler for load balancer (handle_request.sh)

# Read the incoming request
read -r request_line
read -r headers

# Extract request body if POST
content_length=0
while IFS= read -r header; do
    header=$(echo "$header" | tr -d '\r')
    if [[ "$header" =~ ^Content-Length: ]]; then
        content_length="${header#Content-Length: }"
    fi
    [[ -z "$header" ]] && break
done

# Read request body
if [[ "$content_length" -gt 0 ]]; then
    read -n "$content_length" request_body
fi

# Choose GPU endpoint (round-robin for simplicity)
gpu_index=$((RANDOM % 3))
gpu_endpoints=(
    "http://172.16.23.127:11434"
    "http://172.16.23.127:11435"
    "http://172.16.23.127:11436"
)

endpoint="${gpu_endpoints[$gpu_index]}"

# Forward request
response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$request_body" \
    "$endpoint/api/generate")

# Send response
echo "HTTP/1.1 200 OK"
echo "Content-Type: application/json"
echo "Connection: close"
echo ""
echo "$response"