# AWS CDK Stack for Hybrid Cloud Deployment
# Frontend + API in AWS, LLM at home

from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_s3_deployment as s3_deployment,
    aws_ecs as ecs,
    aws_ecs_patterns as ecs_patterns,
    aws_ec2 as ec2,
    aws_rds as rds,
    aws_secretsmanager as secretsmanager,
    aws_elasticloadbalancingv2 as elbv2,
    CfnOutput,
    Duration,
    RemovalPolicy,
)
from constructs import Construct


class HybridCloudStack(Stack):
    """
    AWS infrastructure for hybrid cloud deployment:
    - Frontend: CloudFront + S3
    - API Service: ECS Fargate
    - Database: RDS PostgreSQL
    - LLM: Home GPU cluster (via Cloudflare Tunnel)
    """

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Configuration
        home_llm_url = (
            self.node.try_get_context("home_llm_url") or "https://llm.yourdomain.com"
        )
        domain_name = self.node.try_get_context("domain_name")

        # ============================================
        # VPC for API and Database
        # ============================================
        vpc = ec2.Vpc(
            self,
            "VPC",
            max_azs=2,  # Multi-AZ for high availability
            nat_gateways=1,  # Cost optimization: 1 NAT gateway
        )

        # ============================================
        # RDS PostgreSQL Database
        # ============================================
        db_secret = secretsmanager.Secret(
            self,
            "DBSecret",
            generate_secret_string=secretsmanager.SecretStringGenerator(
                secret_string_template='{"username":"resume_user"}',
                generate_string_key="password",
                exclude_punctuation=True,
            ),
        )

        database = rds.DatabaseInstance(
            self,
            "Database",
            engine=rds.DatabaseInstanceEngine.postgres(
                version=rds.PostgresEngineVersion.VER_15
            ),
            instance_type=ec2.InstanceType.of(
                ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL
            ),
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS
            ),
            multi_az=True,  # High availability
            allocated_storage=20,
            storage_encrypted=True,
            backup_retention=Duration.days(7),
            deletion_protection=False,  # Set to True for production
            removal_policy=RemovalPolicy.SNAPSHOT,
            credentials=rds.Credentials.from_secret(db_secret),
            database_name="resume_db",
        )

        # ============================================
        # ECS Cluster for API Service
        # ============================================
        cluster = ecs.Cluster(
            self,
            "Cluster",
            vpc=vpc,
            container_insights=True,
        )

        # API Service - Fargate with ALB
        api_service = ecs_patterns.ApplicationLoadBalancedFargateService(
            self,
            "APIService",
            cluster=cluster,
            cpu=512,  # 0.5 vCPU
            memory_limit_mib=1024,  # 1GB RAM
            desired_count=2,  # 2 tasks for high availability
            task_image_options=ecs_patterns.ApplicationLoadBalancedTaskImageOptions(
                image=ecs.ContainerImage.from_asset("../apps/api-service"),
                container_port=3000,
                environment={
                    "NODE_ENV": "production",
                    "PORT": "3000",
                    # Point to home LLM cluster
                    "LLM_SERVICE_URL": home_llm_url,
                    "LLAMA_SERVER_URL": home_llm_url,
                    "LLAMA_API_TYPE": "ollama",
                },
                secrets={
                    "DATABASE_URL": ecs.Secret.from_secrets_manager(db_secret),
                    "JWT_SECRET": ecs.Secret.from_secrets_manager(
                        secretsmanager.Secret(
                            self,
                            "JWTSecret",
                            generate_secret_string=secretsmanager.SecretStringGenerator(
                                exclude_punctuation=True,
                                password_length=32,
                            ),
                        )
                    ),
                },
            ),
            public_load_balancer=True,
        )

        # Allow API service to connect to database
        database.connections.allow_from(
            api_service.service, ec2.Port.tcp(5432), "Allow from API service"
        )

        # Configure health check
        api_service.target_group.configure_health_check(
            path="/health",
            interval=Duration.seconds(30),
            timeout=Duration.seconds(10),
            healthy_threshold_count=2,
            unhealthy_threshold_count=3,
        )

        # Auto-scaling based on CPU
        api_scaling = api_service.service.auto_scale_task_count(
            min_capacity=2,
            max_capacity=10,
        )
        api_scaling.scale_on_cpu_utilization(
            "CPUScaling",
            target_utilization_percent=70,
            scale_in_cooldown=Duration.seconds(60),
            scale_out_cooldown=Duration.seconds(60),
        )

        # ============================================
        # S3 + CloudFront for Frontend
        # ============================================
        frontend_bucket = s3.Bucket(
            self,
            "FrontendBucket",
            public_read_access=False,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            encryption=s3.BucketEncryption.S3_MANAGED,
        )

        # CloudFront Origin Access Identity
        oai = cloudfront.OriginAccessIdentity(self, "OAI", comment="OAI for frontend")
        frontend_bucket.grant_read(oai)

        # CloudFront distribution
        distribution = cloudfront.Distribution(
            self,
            "Distribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3Origin(frontend_bucket, origin_access_identity=oai),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
                compress=True,
            ),
            # Route /api/* to ALB
            additional_behaviors={
                "/api/*": cloudfront.BehaviorOptions(
                    origin=origins.LoadBalancerV2Origin(
                        api_service.load_balancer,
                        protocol_policy=cloudfront.OriginProtocolPolicy.HTTP_ONLY,
                    ),
                    viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cache_policy=cloudfront.CachePolicy.CACHING_DISABLED,  # Don't cache API
                    allowed_methods=cloudfront.AllowedMethods.ALLOW_ALL,
                ),
            },
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
            price_class=cloudfront.PriceClass.PRICE_CLASS_100,
        )

        # Deploy frontend
        s3_deployment.BucketDeployment(
            self,
            "DeployFrontend",
            sources=[s3_deployment.Source.asset("../apps/my-resume/dist")],
            destination_bucket=frontend_bucket,
            distribution=distribution,
            distribution_paths=["/*"],
        )

        # ============================================
        # Outputs
        # ============================================
        CfnOutput(
            self,
            "FrontendURL",
            value=f"https://{distribution.domain_name}",
            description="Frontend URL (CloudFront)",
        )

        CfnOutput(
            self,
            "APIURL",
            value=f"http://{api_service.load_balancer.load_balancer_dns_name}",
            description="API Service URL (ALB)",
        )

        CfnOutput(
            self,
            "DatabaseEndpoint",
            value=database.db_instance_endpoint_address,
            description="RDS PostgreSQL endpoint",
        )

        CfnOutput(
            self,
            "HomeLLMURL",
            value=home_llm_url,
            description="Home GPU cluster URL (configured)",
        )

        CfnOutput(
            self,
            "EstimatedMonthlyCost",
            value="~$55-75 (without home GPU)",
            description="Estimated AWS monthly cost",
        )
