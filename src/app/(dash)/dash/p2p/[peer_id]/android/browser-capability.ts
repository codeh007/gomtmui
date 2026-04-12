export function supportsAndroidScrcpyBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const navigatorWithBrands = navigator as Navigator & {
    userAgentData?: {
      brands?: Array<{ brand: string }>;
    };
  };

  const browserBrands = navigatorWithBrands.userAgentData?.brands
    ?.map((entry) => entry.brand.toLowerCase())
    .join(" ")
    .trim();
  const userAgent = navigator.userAgent.toLowerCase();
  const looksLikeChromium =
    (browserBrands?.includes("chrom") ?? false) || userAgent.includes("chrome") || userAgent.includes("edg/");

  return looksLikeChromium && typeof VideoDecoder !== "undefined" && typeof EncodedVideoChunk !== "undefined";
}
