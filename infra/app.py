#!/usr/bin/env python3
import aws_cdk as cdk
from stacks.s3_website_stack import S3WebsiteStack

app = cdk.App()

# Get environment and account from context or environment variables
env = cdk.Environment(
    account=app.node.try_get_context("account") or None,
    region=app.node.try_get_context("region") or "us-east-1",
)

# Create S3 static website stack (no CloudFront - account not verified yet)
S3WebsiteStack(
    app,
    "MyResumeWebsiteStack",
    env=env,
    description="S3 static website for React resume app",
)

app.synth()
