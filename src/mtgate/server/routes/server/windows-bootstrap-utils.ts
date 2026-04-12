const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type WindowsBootstrapTokenPayload = {
  serverId: string;
  exp: number;
};

export type WindowsBootstrapScriptInput = {
  hostname: string;
  publicUrl: string;
  instanceId: string;
  cloudflaredToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  gomtmBinaryUrls: string[];
};

export function buildWindowsManualBootstrapCommand(installUrl: string) {
  return `irm "${installUrl}" | iex`;
}

function normalizeOrigin(value: string) {
  const url = new URL(value);
  return url.origin;
}

export function resolveInstallBaseUrl(requestUrl: string, siteUrl?: string, configuredBaseUrl?: string) {
  const site = siteUrl?.trim();
  if (site) {
    return normalizeOrigin(site);
  }

  const configured = configuredBaseUrl?.trim();
  if (configured) {
    return normalizeOrigin(configured);
  }

  return normalizeOrigin(requestUrl);
}

function escapePowerShellSingleQuoted(value: string) {
  return value.replaceAll("'", "''");
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signMessage(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(message));
  return new Uint8Array(signature);
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

export async function createWindowsBootstrapToken(payload: WindowsBootstrapTokenPayload, secret: string) {
  const encodedPayload = encodeBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const signature = encodeBase64Url(await signMessage(secret, encodedPayload));
  return `${encodedPayload}.${signature}`;
}

export async function verifyWindowsBootstrapToken(token: string, secret: string, now = Date.now()) {
  const [encodedPayload, encodedSignature] = token.split(".");
  if (!encodedPayload || !encodedSignature) {
    throw new Error("invalid bootstrap token");
  }

  const expectedSignature = encodeBase64Url(await signMessage(secret, encodedPayload));
  if (!timingSafeEqual(encodedSignature, expectedSignature)) {
    throw new Error("invalid bootstrap token");
  }

  const payload = JSON.parse(
    textDecoder.decode(decodeBase64Url(encodedPayload)),
  ) as Partial<WindowsBootstrapTokenPayload>;
  if (typeof payload.serverId !== "string" || !payload.serverId || typeof payload.exp !== "number") {
    throw new Error("invalid bootstrap token");
  }
  if (payload.exp < now) {
    throw new Error("bootstrap token expired");
  }

  return {
    serverId: payload.serverId,
    exp: payload.exp,
  } satisfies WindowsBootstrapTokenPayload;
}

export function buildWindowsBootstrapScript(input: WindowsBootstrapScriptInput) {
  const gomtmBinaryURLs =
    input.gomtmBinaryUrls.length > 0 ? input.gomtmBinaryUrls : ["https://unpkg.com/gomtm-win@latest/bin/gomtm.exe"];
  const escapedInstanceID = escapePowerShellSingleQuoted(input.instanceId);
  const escapedPublicURL = escapePowerShellSingleQuoted(input.publicUrl);
  const escapedHostname = escapePowerShellSingleQuoted(input.hostname);
  const escapedSupabaseURL = escapePowerShellSingleQuoted(input.supabaseUrl);
  const escapedSupabaseAnonKey = escapePowerShellSingleQuoted(input.supabaseAnonKey);
  const escapedSupabaseServiceRoleKey = escapePowerShellSingleQuoted(input.supabaseServiceRoleKey);
  const escapedCloudflaredToken = escapePowerShellSingleQuoted(input.cloudflaredToken);
  const escapedReconcileURL = escapePowerShellSingleQuoted(
    `${input.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/server_status_reconcile`,
  );
  const downloadCandidates = gomtmBinaryURLs.map((url) => `'${escapePowerShellSingleQuoted(url)}'`).join(",\n    ");

  return [
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12",
    "[Console]::InputEncoding = [System.Text.Encoding]::UTF8",
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "",
    `$instanceId = '${escapedInstanceID}'`,
    `$publicStatusUrl = '${escapedPublicURL}/api/system/status'`,
    `$hostname = '${escapedHostname}'`,
    `$reconcileUrl = '${escapedReconcileURL}'`,
    "$baseRoot = if ($env:ProgramData) { Join-Path $env:ProgramData 'gomtm' } else { Join-Path $env:LOCALAPPDATA 'gomtm' }",
    '$instanceRoot = Join-Path $baseRoot "instances\\$instanceId"',
    "$binRoot = Join-Path $baseRoot 'bin'",
    "$exePath = Join-Path $binRoot 'gomtm.exe'",
    "$runnerScriptPath = Join-Path $instanceRoot 'start-gomtm-server.ps1'",
    "$logPath = Join-Path $instanceRoot 'gomtm-server.log'",
    "$downloadCandidates = @(",
    `    ${downloadCandidates}`,
    ")",
    "",
    "New-Item -ItemType Directory -Force -Path $instanceRoot | Out-Null",
    "New-Item -ItemType Directory -Force -Path $binRoot | Out-Null",
    "",
    "function Download-GomtmBinary {",
    "  $errors = @()",
    "  foreach ($url in $downloadCandidates) {",
    "    try {",
    "      if (Test-Path $exePath) { Remove-Item -Force $exePath -ErrorAction SilentlyContinue }",
    "      Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $exePath",
    "      if ((Test-Path $exePath) -and ((Get-Item $exePath).Length -gt 0)) {",
    '        Write-Host "已下载 gomtm.exe: $url"',
    "        return",
    "      }",
    `      $errors += "${["$", "{url}: 下载结果为空"].join("")}"`,
    "    } catch {",
    `      $errors += "${["$", "{url}: $($_.Exception.Message)"].join("")}"`,
    "    }",
    "  }",
    '  throw "下载 gomtm.exe 失败:`n$($errors -join "`n")"',
    "}",
    "",
    "Download-GomtmBinary",
    "",
    "$runnerScript = @'",
    "$ErrorActionPreference = 'Stop'",
    "[Console]::InputEncoding = [System.Text.Encoding]::UTF8",
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "$baseRoot = if ($env:ProgramData) { Join-Path $env:ProgramData 'gomtm' } else { Join-Path $env:LOCALAPPDATA 'gomtm' }",
    '$instanceRoot = Join-Path $baseRoot "instances\\$env:GOMTM_INSTANCE_ID"',
    "$binRoot = Join-Path $baseRoot 'bin'",
    "$exePath = Join-Path $binRoot 'gomtm.exe'",
    "$logPath = Join-Path $instanceRoot 'gomtm-server.log'",
    `$env:GOMTM_INSTANCE_ID = '${escapedInstanceID}'`,
    `$env:SUPABASE_URL = '${escapedSupabaseURL}'`,
    `$env:NEXT_PUBLIC_SUPABASE_URL = '${escapedSupabaseURL}'`,
    `$env:SUPABASE_ANON_KEY = '${escapedSupabaseAnonKey}'`,
    `$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = '${escapedSupabaseAnonKey}'`,
    `$env:SUPABASE_SERVICE_ROLE_KEY = '${escapedSupabaseServiceRoleKey}'`,
    `$env:CLOUDFLARED_TOKEN = '${escapedCloudflaredToken}'`,
    "$env:GOMTM_LISTEN = '127.0.0.1:8383'",
    "$env:GOMTM_LOG_LEVEL = 'info'",
    "$env:GOMTM_STORAGE_DIR = $instanceRoot",
    "New-Item -ItemType Directory -Force -Path $instanceRoot | Out-Null",
    "Set-Location -LiteralPath $instanceRoot",
    "& $exePath server --auto-upgrade *>> $logPath",
    "'@",
    "Set-Content -LiteralPath $runnerScriptPath -Value $runnerScript -Encoding UTF8",
    "",
    "Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $runnerScriptPath) -WindowStyle Hidden | Out-Null",
    "",
    "$localReady = $false",
    "$deadline = (Get-Date).AddSeconds(60)",
    "while ((Get-Date) -lt $deadline) {",
    "  try {",
    "    $localStatus = Invoke-RestMethod -Method GET -Uri 'http://127.0.0.1:8383/api/system/status' -TimeoutSec 3",
    "    if ($localStatus.instance_id -eq $instanceId) {",
    "      $localReady = $true",
    "    }",
    "  } catch {",
    "  }",
    "",
    "  try {",
    "    $publicStatus = Invoke-RestMethod -Method GET -Uri $publicStatusUrl -TimeoutSec 5",
    "    if ($publicStatus.instance_id -eq $instanceId) {",
    "      $headers = @{",
    "        apikey = $env:SUPABASE_SERVICE_ROLE_KEY",
    '        Authorization = "Bearer $($env:SUPABASE_SERVICE_ROLE_KEY)"',
    "        'Content-Type' = 'application/json'",
    "      }",
    "      $body = @{ p_server_id = $instanceId } | ConvertTo-Json -Compress",
    "      Invoke-RestMethod -Method POST -Uri $reconcileUrl -Headers $headers -Body $body -TimeoutSec 10 | Out-Null",
    '      Write-Host "gomtm server 已上线: https://$hostname"',
    '      Write-Host "日志文件: $logPath"',
    "      exit 0",
    "    }",
    "  } catch {",
    "  }",
    "",
    "  Start-Sleep -Seconds 2",
    "}",
    "",
    "if (-not $localReady) {",
    '  throw "gomtm server 启动超时，请检查日志: $logPath"',
    "}",
    "",
    'Write-Host "本地 gomtm server 已启动，但公网状态仍在收敛中。"',
    'Write-Host "稍后访问: $publicStatusUrl"',
    'Write-Host "日志文件: $logPath"',
  ].join("\n");
}
