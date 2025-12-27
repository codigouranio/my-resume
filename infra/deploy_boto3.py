#!/usr/bin/env python3
"""
Standalone deployment script using boto3.
Alternative to CDK for simpler deployments.
"""
import os
import json
import boto3
import hashlib
from pathlib import Path
from botocore.exceptions import ClientError

# Configuration
BUCKET_NAME = "my-resume-website"  # Change this to your desired bucket name
REGION = "us-east-1"
BUILD_DIR = "../apps/my-resume/dist"
CLOUDFRONT_COMMENT = "My Resume CloudFront Distribution"


def create_s3_bucket(s3_client, bucket_name, region):
    """Create S3 bucket if it doesn't exist."""
    try:
        if region == "us-east-1":
            s3_client.create_bucket(Bucket=bucket_name)
        else:
            s3_client.create_bucket(
                Bucket=bucket_name,
                CreateBucketConfiguration={"LocationConstraint": region},
            )
        print(f"✅ Created S3 bucket: {bucket_name}")

        # Enable versioning
        s3_client.put_bucket_versioning(
            Bucket=bucket_name, VersioningConfiguration={"Status": "Enabled"}
        )

    except ClientError as e:
        if e.response["Error"]["Code"] == "BucketAlreadyOwnedByYou":
            print(f"ℹ️  Bucket {bucket_name} already exists")
        else:
            raise


def upload_files_to_s3(s3_client, bucket_name, build_dir):
    """Upload all files from build directory to S3."""
    build_path = Path(build_dir)

    if not build_path.exists():
        raise FileNotFoundError(f"Build directory not found: {build_dir}")

    content_types = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".ttf": "font/ttf",
        ".eot": "application/vnd.ms-fontobject",
    }

    uploaded_files = []
    for file_path in build_path.rglob("*"):
        if file_path.is_file():
            relative_path = file_path.relative_to(build_path)
            s3_key = str(relative_path).replace("\\", "/")

            content_type = content_types.get(
                file_path.suffix.lower(), "binary/octet-stream"
            )

            extra_args = {
                "ContentType": content_type,
            }

            # Add cache control headers
            if file_path.suffix in [".js", ".css"]:
                extra_args["CacheControl"] = "public, max-age=31536000"
            elif file_path.suffix == ".html":
                extra_args["CacheControl"] = "public, max-age=0, must-revalidate"

            s3_client.upload_file(
                str(file_path), bucket_name, s3_key, ExtraArgs=extra_args
            )
            uploaded_files.append(s3_key)
            print(f"📤 Uploaded: {s3_key}")

    return uploaded_files


def create_cloudfront_distribution(cf_client, s3_client, bucket_name, region):
    """Create CloudFront distribution for the S3 bucket."""

    # Create Origin Access Identity
    try:
        oai_response = cf_client.create_cloud_front_origin_access_identity(
            CloudFrontOriginAccessIdentityConfig={
                "CallerReference": f"my-resume-{hashlib.md5(bucket_name.encode()).hexdigest()[:8]}",
                "Comment": "OAI for my resume website",
            }
        )
        oai_id = oai_response["CloudFrontOriginAccessIdentity"]["Id"]
        print(f"✅ Created Origin Access Identity: {oai_id}")
    except ClientError as e:
        if "OriginAccessIdentityAlreadyExists" in str(e):
            # List existing OAIs and use the first one
            oais = cf_client.list_cloud_front_origin_access_identities()
            oai_id = oais["CloudFrontOriginAccessIdentityList"]["Items"][0]["Id"]
            print(f"ℹ️  Using existing OAI: {oai_id}")
        else:
            raise

    # Update bucket policy to allow CloudFront access
    bucket_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "AllowCloudFrontOAI",
                "Effect": "Allow",
                "Principal": {
                    "AWS": f"arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity {oai_id}"
                },
                "Action": "s3:GetObject",
                "Resource": f"arn:aws:s3:::{bucket_name}/*",
            }
        ],
    }

    s3_client.put_bucket_policy(Bucket=bucket_name, Policy=json.dumps(bucket_policy))

    # Create CloudFront distribution
    origin_id = f"S3-{bucket_name}"

    distribution_config = {
        "CallerReference": f"my-resume-{hashlib.md5(bucket_name.encode()).hexdigest()}",
        "Comment": CLOUDFRONT_COMMENT,
        "Enabled": True,
        "DefaultRootObject": "index.html",
        "Origins": {
            "Quantity": 1,
            "Items": [
                {
                    "Id": origin_id,
                    "DomainName": f"{bucket_name}.s3.{region}.amazonaws.com",
                    "S3OriginConfig": {
                        "OriginAccessIdentity": f"origin-access-identity/cloudfront/{oai_id}"
                    },
                }
            ],
        },
        "DefaultCacheBehavior": {
            "TargetOriginId": origin_id,
            "ViewerProtocolPolicy": "redirect-to-https",
            "AllowedMethods": {
                "Quantity": 3,
                "Items": ["GET", "HEAD", "OPTIONS"],
                "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]},
            },
            "ForwardedValues": {
                "QueryString": False,
                "Cookies": {"Forward": "none"},
            },
            "MinTTL": 0,
            "DefaultTTL": 86400,
            "MaxTTL": 31536000,
            "Compress": True,
        },
        "CustomErrorResponses": {
            "Quantity": 2,
            "Items": [
                {
                    "ErrorCode": 403,
                    "ResponsePagePath": "/index.html",
                    "ResponseCode": "200",
                    "ErrorCachingMinTTL": 300,
                },
                {
                    "ErrorCode": 404,
                    "ResponsePagePath": "/index.html",
                    "ResponseCode": "200",
                    "ErrorCachingMinTTL": 300,
                },
            ],
        },
        "PriceClass": "PriceClass_100",
    }

    try:
        response = cf_client.create_distribution(DistributionConfig=distribution_config)
        distribution = response["Distribution"]
        print(f"✅ Created CloudFront distribution: {distribution['Id']}")
        print(f"🌐 Domain: {distribution['DomainName']}")
        return distribution
    except ClientError as e:
        if "DistributionAlreadyExists" in str(e):
            print("ℹ️  Distribution already exists")
            # List distributions and find ours
            distributions = cf_client.list_distributions()
            for dist in distributions.get("DistributionList", {}).get("Items", []):
                if dist.get("Comment") == CLOUDFRONT_COMMENT:
                    print(f"🌐 Domain: {dist['DomainName']}")
                    return dist
        else:
            raise


def main():
    """Main deployment function."""
    print("🚀 Starting deployment to AWS CloudFront...")

    # Initialize AWS clients
    s3_client = boto3.client("s3", region_name=REGION)
    cf_client = boto3.client("cloudfront")

    # Step 1: Create S3 bucket
    print("\n📦 Step 1: Setting up S3 bucket...")
    create_s3_bucket(s3_client, BUCKET_NAME, REGION)

    # Step 2: Upload files
    print("\n📤 Step 2: Uploading files to S3...")
    upload_files_to_s3(s3_client, BUCKET_NAME, BUILD_DIR)

    # Step 3: Create CloudFront distribution
    print("\n☁️  Step 3: Setting up CloudFront distribution...")
    distribution = create_cloudfront_distribution(
        cf_client, s3_client, BUCKET_NAME, REGION
    )

    print("\n✅ Deployment complete!")
    print(
        f"\n🌐 Your website will be available at: https://{distribution['DomainName']}"
    )
    print("⏳ Note: CloudFront distribution may take 15-20 minutes to fully deploy.")


if __name__ == "__main__":
    main()
