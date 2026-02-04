// Quick test to verify AWS SES credentials
const {
  SESClient,
  ListVerifiedEmailAddressesCommand,
} = require("@aws-sdk/client-ses");
require("dotenv").config();

const client = new SESClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function testCredentials() {
  console.log("Testing AWS SES credentials...");
  console.log("Region:", process.env.AWS_REGION || "us-east-1");
  console.log(
    "Access Key ID:",
    process.env.AWS_ACCESS_KEY_ID?.substring(0, 8) + "...",
  );

  try {
    const command = new ListVerifiedEmailAddressesCommand({});
    const response = await client.send(command);
    console.log("\n✅ Credentials are valid!");
    console.log("\nVerified email addresses:");
    if (response.VerifiedEmailAddresses.length === 0) {
      console.log(
        "  ⚠️  NO VERIFIED EMAILS - You must verify emails in SES sandbox mode!",
      );
      console.log(
        "  Visit: https://console.aws.amazon.com/ses/home?region=us-east-1#/verified-identities",
      );
    } else {
      response.VerifiedEmailAddresses.forEach((email) =>
        console.log("  ✓", email),
      );
    }
  } catch (error) {
    console.error("\n❌ Credentials are invalid or insufficient permissions!");
    console.error("Error:", error.message);
    console.error("\nPossible issues:");
    console.error("1. Access keys are expired or revoked");
    console.error("2. IAM user lacks SES permissions");
    console.error("3. Region is incorrect");
  }
}

testCredentials();
