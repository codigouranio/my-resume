#!/usr/bin/env python3
"""
CloudFront cache invalidation script.
Use this after updating your website to immediately see changes.
"""
import boto3
import time
from datetime import datetime

# Get CloudFront distribution ID from CDK outputs or specify manually
DISTRIBUTION_ID = None  # e.g., "E1234567890ABC"


def get_distribution_id():
    """Get distribution ID from CloudFormation stack outputs."""
    cf_client = boto3.client("cloudformation")

    try:
        response = cf_client.describe_stacks(StackName="MyResumeCloudFrontStack")

        for output in response["Stacks"][0]["Outputs"]:
            if output["OutputKey"] == "DistributionId":
                return output["OutputValue"]
    except Exception as e:
        print(f"Error getting distribution ID from CloudFormation: {e}")
        return None


def invalidate_cache(distribution_id, paths=["/*"]):
    """Create CloudFront invalidation."""
    cf_client = boto3.client("cloudfront")

    invalidation = cf_client.create_invalidation(
        DistributionId=distribution_id,
        InvalidationBatch={
            "Paths": {"Quantity": len(paths), "Items": paths},
            "CallerReference": str(datetime.now().timestamp()),
        },
    )

    invalidation_id = invalidation["Invalidation"]["Id"]
    print(f"✅ Created invalidation: {invalidation_id}")
    print(f"📝 Status: {invalidation['Invalidation']['Status']}")

    return invalidation_id


def wait_for_invalidation(distribution_id, invalidation_id):
    """Wait for invalidation to complete."""
    cf_client = boto3.client("cloudfront")

    print("⏳ Waiting for invalidation to complete...")

    while True:
        response = cf_client.get_invalidation(
            DistributionId=distribution_id, Id=invalidation_id
        )

        status = response["Invalidation"]["Status"]
        print(f"   Status: {status}")

        if status == "Completed":
            print("✅ Invalidation completed!")
            break

        time.sleep(5)


def main():
    """Main function."""
    global DISTRIBUTION_ID

    print("🔄 CloudFront Cache Invalidation")
    print("-" * 50)

    # Get distribution ID if not specified
    if not DISTRIBUTION_ID:
        print("📋 Getting distribution ID from CloudFormation...")
        DISTRIBUTION_ID = get_distribution_id()

        if not DISTRIBUTION_ID:
            print("❌ Could not find distribution ID.")
            print("Please set DISTRIBUTION_ID in the script or run 'cdk deploy' first.")
            return

    print(f"🎯 Distribution ID: {DISTRIBUTION_ID}")

    # Create invalidation
    invalidation_id = invalidate_cache(DISTRIBUTION_ID)

    # Wait for completion
    wait_for_invalidation(DISTRIBUTION_ID, invalidation_id)

    print("\n✅ Cache invalidated successfully!")
    print("🌐 Your website changes should be visible now.")


if __name__ == "__main__":
    main()
