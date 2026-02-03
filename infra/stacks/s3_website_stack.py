from aws_cdk import (
    Stack,
    aws_s3 as s3,
    RemovalPolicy,
    CfnOutput,
)
from constructs import Construct


class S3WebsiteStack(Stack):
    """Simple S3 static website hosting (no CloudFront needed)"""

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # S3 bucket configured for static website hosting
        website_bucket = s3.Bucket(
            self,
            "WebsiteBucket",
            bucket_name=f"my-resume-website-{self.account}",
            website_index_document="index.html",
            website_error_document="index.html",
            public_read_access=True,
            block_public_access=s3.BlockPublicAccess(
                block_public_acls=False,
                block_public_policy=False,
                ignore_public_acls=False,
                restrict_public_buckets=False,
            ),
            removal_policy=RemovalPolicy.DESTROY,
            versioned=False,
            encryption=s3.BucketEncryption.S3_MANAGED,
        )

        # Output the website URL
        CfnOutput(
            self,
            "WebsiteURL",
            value=website_bucket.bucket_website_url,
            description="S3 static website URL",
            export_name="MyResumeWebsiteURL",
        )

        # Output the S3 bucket name
        CfnOutput(
            self,
            "BucketName",
            value=website_bucket.bucket_name,
            description="S3 bucket name for uploads",
            export_name="MyResumeBucketName",
        )
