#!/usr/bin/env python3
import aws_cdk as cdk
from stacks.cloudfront_stack import CloudFrontStack

app = cdk.App()

# Get environment and account from context or environment variables
env = cdk.Environment(
    account=app.node.try_get_context("account") or None,
    region=app.node.try_get_context("region") or "us-east-1",
)

# Create the CloudFront stack
CloudFrontStack(
    app,
    "MyResumeCloudFrontStack",
    env=env,
    description="CloudFront distribution for React resume app",
)

app.synth()
