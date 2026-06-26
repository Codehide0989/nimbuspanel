const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

let client = null;

function getClient() {
  if (client) return client;
  client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

/**
 * Generate a short-lived presigned URL to fetch a private object (PEM key).
 */
async function getPresignedUrl(key, expiresIn = 120) {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(getClient(), command, { expiresIn });
}

module.exports = { getPresignedUrl };
