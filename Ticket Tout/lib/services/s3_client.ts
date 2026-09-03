import { S3Client } from "@aws-sdk/client-s3";


export const s3Client = new S3Client([{
  endpoint: "http://garage:3900",
  region: "garage",
  credentials: {
    accessKeyId: process.env.GARAGE_DEFAULT_ACCESS_KEY,
    secretAccessKey: process.env.GARAGE_DEFAULT_SECRET_KEY,
  },
  forcePathStyle: true,
}]);
