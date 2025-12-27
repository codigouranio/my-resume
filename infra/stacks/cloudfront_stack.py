from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_s3_deployment as s3_deployment,
    aws_certificatemanager as acm,
    aws_iam as iam,
    RemovalPolicy,
    CfnOutput,
    Duration,
)
from constructs import Construct


class CloudFrontStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # S3 bucket to host the static website
        website_bucket = s3.Bucket(
            self,
            "WebsiteBucket",
            bucket_name=f"my-resume-website-{self.account}",
            public_read_access=False,  # CloudFront will access via OAI
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=RemovalPolicy.DESTROY,  # Change to RETAIN for production
            auto_delete_objects=True,  # Change to False for production
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
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
                compress=True,
            ),
            default_root_object="index.html",
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=200,
                    response_page_path="/index.html",
                    ttl=Duration.minutes(5),
                ),
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=200,
                    response_page_path="/index.html",
                    ttl=Duration.minutes(5),
                ),
            ],
            price_class=cloudfront.PriceClass.PRICE_CLASS_100,  # US, Canada, Europe
            comment="My Resume CloudFront Distribution",
            # Uncomment and configure for custom domain:
            # domain_names=["resume.yourdomain.com"],
            # certificate=acm.Certificate.from_certificate_arn(
            #     self,
            #     "Certificate",
            #     "arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERTIFICATE_ID"
            # ),
        )

        # Deploy site contents to S3 bucket
        # Note: This will deploy during CDK deployment
        # For CI/CD, you might want to handle this separately
        s3_deployment.BucketDeployment(
            self,
            "DeployWebsite",
            sources=[s3_deployment.Source.asset("../apps/my-resume/dist")],
            destination_bucket=website_bucket,
            distribution=distribution,
            distribution_paths=["/*"],
        )

        # Outputs
        CfnOutput(
            self,
            "BucketName",
            value=website_bucket.bucket_name,
            description="S3 Bucket Name",
            export_name="WebsiteBucketName",
        )

        CfnOutput(
            self,
            "DistributionId",
            value=distribution.distribution_id,
            description="CloudFront Distribution ID",
            export_name="DistributionId",
        )

        CfnOutput(
            self,
            "DistributionDomainName",
            value=distribution.distribution_domain_name,
            description="CloudFront Distribution Domain Name",
            export_name="DistributionDomainName",
        )

        CfnOutput(
            self,
            "WebsiteURL",
            value=f"https://{distribution.distribution_domain_name}",
            description="Website URL",
            export_name="WebsiteURL",
        )
