#!/bin/bash
# Multi-GPU Load Balancer for Ollama
# Routes requests to least busy GPU instance

# Configuration
GPU_ENDPOINTS=(
    "http://172.16.23.127:11434"
    "http://172.16.23.127:11435" 
    "http://172.16.23.127:11436"
)
LOAD_BALANCER_PORT=8080
LOG_FILE="/var/log/ollama-loadbalancer.log"

# Request counter per GPU
declare -A REQUEST_COUNTS
declare -A GPU_LOADS
declare -A LAST_RESET

# Initialize counters
for i in {0..2}; do
    REQUEST_COUNTS[$i]=0
    GPU_LOADS[$i]=0
    LAST_RESET[$i]=$(date +%s)
done

# Function to get current load on a GPU instance
get_gpu_load() {
    local endpoint=$1
    local response=$(curl -s -w "%{http_code}" -o /dev/null "$endpoint/api/tags")
    
    if [ "$response" = "200" ]; then
        echo "0"  # Available
    else
        echo "1"  # Unavailable
    fi
}

# Function to find least busy GPU
find_least_busy_gpu() {
    local min_load=999
    local best_gpu=0
    
    for i in {0..2}; do
        local current_load=${GPU_LOADS[$i]}
        
        # Check if endpoint is healthy
        local health=$(get_gpu_load "${GPU_ENDPOINTS[$i]}")
        
        if [ "$health" = "0" ] && [ "$current_load" -lt "$min_load" ]; then
            min_load=$current_load
            best_gpu=$i
        fi
    done
    
    echo $best_gpu
}

# Function to log to file
log_request() {
    local message="$1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $message" >> $LOG_FILE
}

# Function to handle individual request
handle_request() {
    local request_data=$1
    local request_id=$(date +%s%N)
    
    # Find least busy GPU
    local gpu_index=$(find_least_busy_gpu)
    local endpoint="${GPU_ENDPOINTS[$gpu_index]}"
    
    # Increment load counter
    REQUEST_COUNTS[$gpu_index]=$((${REQUEST_COUNTS[$gpu_index]} + 1))
    GPU_LOADS[$gpu_index]=$((${GPU_LOADS[$gpu_index]} + 1))
    
    log_request "Request $request_id routed to GPU $gpu_index ($endpoint)"
    
    # Forward request to selected GPU
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$request_data" \
        "$endpoint/api/generate" \
        -w "%{http_code}")
    
    # Decrement load counter
    GPU_LOADS[$gpu_index]=$((${GPU_LOADS[$gpu_index]} - 1))
    
    log_request "Request $request_id completed on GPU $gpu_index"
    
    # Return response
    echo "$response"
}

# Start load balancer
start_load_balancer() {
    echo "🚀 Starting Ollama Multi-GPU Load Balancer"
    echo "Load Balancer Port: $LOAD_BALANCER_PORT"
    echo "GPU Endpoints:"
    for i in {0..2}; do
        echo "  GPU $i: ${GPU_ENDPOINTS[$i]}"
    done
    echo "Log File: $LOG_FILE"
    
    # Create log directory
    sudo mkdir -p $(dirname $LOG_FILE)
    sudo touch $LOG_FILE
    sudo chmod 666 $LOG_FILE
    
    # Start HTTP server
    while true; do
        # Use socat or netcat for HTTP server
        socat TCP-LISTEN:$LOAD_BALANCER_PORT,reuseaddr,fork EXEC:handle_request.sh
    done
}

# Health check function
health_check() {
    echo "🏥 Performing health check on all GPUs..."
    
    for i in {0..2}; do
        local endpoint="${GPU_ENDPOINTS[$i]}"
        local health=$(get_gpu_load "$endpoint")
        local status="❌ DOWN"
        
        if [ "$health" = "0" ]; then
            status="✅ UP"
        fi
        
        echo "GPU $i ($endpoint): $status"
        
        # Reset counters every hour
        local current_time=$(date +%s)
        local last_reset=${LAST_RESET[$i]}
        local elapsed=$((current_time - last_reset))
        
        if [ $elapsed -gt 3600 ]; then
            REQUEST_COUNTS[$i]=0
            LAST_RESET[$i]=$current_time
            log_request "Reset counters for GPU $i"
        fi
    done
}

# Monitoring function
monitor_loads() {
    echo "📊 Current GPU Loads:"
    echo "Time: $(date)"
    echo "----------------------------------------"
    
    for i in {0..2}; do
        local requests=${REQUEST_COUNTS[$i]}
        local current_load=${GPU_LOADS[$i]}
        local endpoint="${GPU_ENDPOINTS[$i]}"
        
        printf "GPU $i (%s): %d requests total, %d currently processing\n" \
            "$endpoint" "$requests" "$current_load"
    done
    echo "----------------------------------------"
}

# Command line interface
case "${1:-start}" in
    start)
        start_load_balancer
        ;;
    health)
        health_check
        ;;
    monitor)
        monitor_loads
        ;;
    *)
        echo "Usage: $0 {start|health|monitor}"
        echo "  start    - Start load balancer"
        echo "  health   - Check health of all GPUs"
        echo "  monitor  - Show current loads"
        exit 1
        ;;
esac