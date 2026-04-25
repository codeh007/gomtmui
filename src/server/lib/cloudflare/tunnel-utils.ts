import type Cloudflare from "cloudflare";
export const getTunnelName = (prefix: string, workerId: string): string => {
  return `${prefix}${workerId.slice(-6)}`;
};

/**
 * 生成主机名 (main 服务直接用 tunnelName.domain, 其他服务用 tunnelName-type.domain)
 */
export const getHost = (tunnelName: string, domain: string, type: string): string => {
  if (type === "main") return `${tunnelName}.${domain}`;
  return `${tunnelName}-${type}.${domain}`;
};

/**
 * 确保 DNS 记录存在并指向指定的 Tunnel
 */
export const ensureDnsRecord = async (client: Cloudflare, zoneId: string, tunnelId: string, hostname: string) => {
  const dnsContent = `${tunnelId}.cfargotunnel.com`;
  const records = await client.dns.records.list({
    type: "CNAME",
    name: { exact: hostname },
    zone_id: zoneId,
  });

  if (records.result.length > 0) {
    const record = records.result[0];
    if (!record.id) {
      console.warn(`[tunnel-utils] DNS record found but missing ID for ${hostname}`);
      return;
    }
    // 如果记录内容不匹配或未开启代理，则更新
    if (record.content !== dnsContent || !record.proxied) {
      await client.dns.records.update(record.id, {
        zone_id: zoneId,
        name: hostname,
        type: "CNAME",
        content: dnsContent,
        proxied: true,
        ttl: 1,
      });
    }
  } else {
    // 创建新记录
    await client.dns.records.create({
      zone_id: zoneId,
      name: hostname,
      type: "CNAME",
      content: dnsContent,
      ttl: 1,
      proxied: true,
    });
  }
};

/**
 * 清理指向特定 Tunnel 的所有 DNS 记录
 */
export const cleanupDnsRecords = async (client: Cloudflare, zoneId: string, tunnelId: string) => {
  const dnsContent = `${tunnelId}.cfargotunnel.com`;
  const records = await client.dns.records.list({
    zone_id: zoneId,
    type: "CNAME",
    content: { exact: dnsContent },
  });

  for (const record of records.result) {
    if (record.id) {
      console.log(`[tunnel-utils] Deleting DNS record: ${record.name}`);
      await client.dns.records.delete(record.id, {
        zone_id: zoneId,
      });
    }
  }
};
