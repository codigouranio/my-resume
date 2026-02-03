from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_iam as iam,
    RemovalPolicy,
    CfnOutput,
    Duration,
)
from constructs import Construct


class SimpleCloudFrontStack(Stack):
    """Simplified CloudFront stack without Lambda-based S3 deployment"""

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # S3 bucket to host the static website
        website_bucket = s3.Bucket(
            self,
            "WebsiteBucket",
            bucket_name=f"my-resume-website-{self.account}",
            public_read_access=False,  # CloudFront will access via OAI
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=RemovalPolicy.DESTROY,
            versioned=False,
            encryption=s3.BucketEncryption.S3_MANAGED,
        )

        # CloudFront Origin Access Identity (OAI)
        oai = cloudfront.OriginAccessIdentity(
            self, "OAI", comment="OAI for my resume website"
        )

        # Grant CloudFront read access to the bucket
        website_bucket.grant_read(oai)

        # CloudFront distribution
        distribution = cloudfront.Distribution(
            self,
            "Distribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3Origin(website_bucket, origin_access_identity=oai),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                cached_methods=cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
                compress=True,
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
            ),
            default_root_object="index.html",
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_page_path="/index.html",
                    response_http_status=200,
                    ttl=Duration.minutes(5),
                ),
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_page_path="/index.html",
                    response_http_status=200,
                    ttl=Duration.minutes(5),
                ),
            ],
            price_class=cloudfront.PriceClass.PRICE_CLASS_100,  # US, Canada, Europe
            enabled=True,
        )

        # Output the distribution domain name
        CfnOutput(
            self,
            "DistributionDomainName",
            value=distribution.distribution_domain_name,
            description="CloudFront distribution domain name",
            export_name="MyResumeDistributionDomain",
        )

        # Output the S3 bucket name
        CfnOutput(
            self,
            "BucketName",
            value=website_bucket.bucket_name,
            description="S3 bucket name for manual upload",
            export_name="MyResumeBucketName",
        )

        # Output the distribution ID for cache invalidation
        CfnOutput(
            self,
            "DistributionId",
            value=distribution.distribution_id,
            description="CloudFront distribution ID",
            export_name="MyResumeDistributionId",
        )
