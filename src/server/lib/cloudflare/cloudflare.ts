import Cloudflare from "cloudflare";

const getCfApiKey = () => {
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    throw new Error("require CLOUDFLARE_API_TOKEN");
  }
  return process.env.CLOUDFLARE_API_TOKEN;
};

export const getCfAccountId = () => {
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error("require CLOUDFLARE_ACCOUNT_ID");
  }
  return process.env.CLOUDFLARE_ACCOUNT_ID;
};

export const getCfClient = (apiToken?: string) => {
  const token = apiToken === undefined ? getCfApiKey() : apiToken;
  return new Cloudflare({
    apiToken: token,
  });
};

export const getDefaultZoneId = async (_client: Cloudflare): Promise<string> => {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!zoneId) {
    throw new Error("require CLOUDFLARE_ZONE_ID");
  }
  return zoneId;
};
