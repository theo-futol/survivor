import { version } from "@/package.json";

export async function GET()
{
  return Response.json({
    timestamp: new Date().toISOString(),
    version: version,
  });
}
