#!/usr/bin/env python3
"""
GPU Cluster Monitoring Script
Sends metrics to AWS CloudWatch for centralized monitoring
"""

import subprocess
import json
import boto3
import time
from datetime import datetime

# Configuration
CLUSTER_NAME = "home-gpu-cluster"
AWS_REGION = "us-east-1"
NAMESPACE = "HomeGPUCluster"


def get_gpu_metrics():
    """Get GPU metrics using nvidia-smi"""
    cmd = [
        "nvidia-smi",
        "--query-gpu=index,temperature.gpu,utilization.gpu,utilization.memory,memory.used,memory.total,power.draw",
        "--format=csv,noheader,nounits",
    ]

    output = subprocess.check_output(cmd).decode("utf-8")
    metrics = []

    for line in output.strip().split("\n"):
        index, temp, gpu_util, mem_util, mem_used, mem_total, power = line.split(", ")
        metrics.append(
            {
                "gpu_id": int(index),
                "temperature": float(temp),
                "gpu_utilization": float(gpu_util),
                "memory_utilization": float(mem_util),
                "memory_used_mb": float(mem_used),
                "memory_total_mb": float(mem_total),
                "power_watts": float(power),
            }
        )

    return metrics


def get_ollama_metrics():
    """Get metrics from each Ollama instance"""
    metrics = []

    for i in range(3):
        port = 11434 + i
        try:
            import requests

            response = requests.get(f"http://localhost:{port}/api/tags", timeout=5)
            if response.status_code == 200:
                models = response.json().get("models", [])
                metrics.append(
                    {
                        "gpu_id": i,
                        "port": port,
                        "status": "healthy",
                        "model_count": len(models),
                    }
                )
            else:
                metrics.append(
                    {"gpu_id": i, "port": port, "status": "unhealthy", "model_count": 0}
                )
        except Exception as e:
            metrics.append(
                {"gpu_id": i, "port": port, "status": "error", "model_count": 0}
            )

    return metrics


def send_to_cloudwatch(metrics):
    """Send metrics to AWS CloudWatch"""
    cloudwatch = boto3.client("cloudwatch", region_name=AWS_REGION)

    metric_data = []
    timestamp = datetime.utcnow()

    for gpu_metric in metrics["gpu"]:
        gpu_id = gpu_metric["gpu_id"]

        metric_data.extend(
            [
                {
                    "MetricName": "GPUTemperature",
                    "Dimensions": [
                        {"Name": "Cluster", "Value": CLUSTER_NAME},
                        {"Name": "GPU", "Value": f"GPU{gpu_id}"},
                    ],
                    "Value": gpu_metric["temperature"],
                    "Unit": "None",
                    "Timestamp": timestamp,
                },
                {
                    "MetricName": "GPUUtilization",
                    "Dimensions": [
                        {"Name": "Cluster", "Value": CLUSTER_NAME},
                        {"Name": "GPU", "Value": f"GPU{gpu_id}"},
                    ],
                    "Value": gpu_metric["gpu_utilization"],
                    "Unit": "Percent",
                    "Timestamp": timestamp,
                },
                {
                    "MetricName": "MemoryUtilization",
                    "Dimensions": [
                        {"Name": "Cluster", "Value": CLUSTER_NAME},
                        {"Name": "GPU", "Value": f"GPU{gpu_id}"},
                    ],
                    "Value": gpu_metric["memory_utilization"],
                    "Unit": "Percent",
                    "Timestamp": timestamp,
                },
                {
                    "MetricName": "PowerDraw",
                    "Dimensions": [
                        {"Name": "Cluster", "Value": CLUSTER_NAME},
                        {"Name": "GPU", "Value": f"GPU{gpu_id}"},
                    ],
                    "Value": gpu_metric["power_watts"],
                    "Unit": "None",
                    "Timestamp": timestamp,
                },
            ]
        )

    for ollama_metric in metrics["ollama"]:
        gpu_id = ollama_metric["gpu_id"]

        metric_data.append(
            {
                "MetricName": "ServiceHealth",
                "Dimensions": [
                    {"Name": "Cluster", "Value": CLUSTER_NAME},
                    {"Name": "GPU", "Value": f"GPU{gpu_id}"},
                ],
                "Value": 1 if ollama_metric["status"] == "healthy" else 0,
                "Unit": "None",
                "Timestamp": timestamp,
            }
        )

    # Send metrics in batches (CloudWatch limit: 20 metrics per request)
    for i in range(0, len(metric_data), 20):
        batch = metric_data[i : i + 20]
        cloudwatch.put_metric_data(Namespace=NAMESPACE, MetricData=batch)


def main():
    """Main monitoring loop"""
    print(f"🔍 Starting GPU cluster monitoring (every 60s)")
    print(f"📊 Sending metrics to CloudWatch: {NAMESPACE}")

    while True:
        try:
            gpu_metrics = get_gpu_metrics()
            ollama_metrics = get_ollama_metrics()

            metrics = {"gpu": gpu_metrics, "ollama": ollama_metrics}

            # Print summary
            print(f"\n📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            for m in gpu_metrics:
                print(
                    f"GPU {m['gpu_id']}: {m['temperature']}°C, "
                    f"{m['gpu_utilization']}% GPU, "
                    f"{m['memory_utilization']}% MEM, "
                    f"{m['power_watts']}W"
                )

            for m in ollama_metrics:
                status_emoji = "✅" if m["status"] == "healthy" else "❌"
                print(f"{status_emoji} Ollama GPU {m['gpu_id']}: {m['status']}")

            # Send to CloudWatch
            send_to_cloudwatch(metrics)
            print("✅ Metrics sent to CloudWatch")

        except Exception as e:
            print(f"❌ Error: {e}")

        time.sleep(60)


if __name__ == "__main__":
    main()
