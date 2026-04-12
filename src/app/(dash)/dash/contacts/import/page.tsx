"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileText, Tag, Upload } from "lucide-react";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { getRpcQueryKey } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { Badge } from "mtxuilib/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "mtxuilib/ui/breadcrumb";
import { Button } from "mtxuilib/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "mtxuilib/ui/card";
import { Input } from "mtxuilib/ui/input";
import { Label } from "mtxuilib/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "mtxuilib/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "mtxuilib/ui/table";
import { Textarea } from "mtxuilib/ui/textarea";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { DashContent, DashHeaders } from "@/components/dash-layout";

interface CsvRawRow {
  [key: string]: string;
}

interface FieldMapping {
  phone: string;
  name: string;
  telegram_username: string;
  email: string;
  tags: string;
}

// 联系人导入步骤
type ImportStep = "upload" | "mapping" | "preview" | "result";

// 数据库字段描述
const DB_FIELDS: { key: keyof FieldMapping; label: string; required: boolean }[] = [
  { key: "phone", label: "手机号", required: true },
  { key: "name", label: "姓名", required: false },
  { key: "telegram_username", label: "Telegram 用户名", required: false },
  { key: "email", label: "邮箱", required: false },
  { key: "tags", label: "标签（逗号分隔）", required: false },
];

const UNMAPPED_VALUE = "__unmapped__";

// ===== CSV 解析器 =====

function parseCsv(text: string): { headers: string[]; rows: CsvRawRow[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };

  // 简易 CSV 解析，支持引号内逗号
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: CsvRawRow = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = values[i] || "";
    }
    return row;
  });

  return { headers, rows };
}

// ===== 智能字段映射猜测 =====

function guessMapping(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {
    phone: UNMAPPED_VALUE,
    name: UNMAPPED_VALUE,
    telegram_username: UNMAPPED_VALUE,
    email: UNMAPPED_VALUE,
    tags: UNMAPPED_VALUE,
  };

  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  for (let i = 0; i < lowerHeaders.length; i++) {
    const h = lowerHeaders[i];
    const header = headers[i];
    if (h.includes("phone") || h.includes("手机") || h.includes("电话") || h.includes("mobile") || h.includes("tel")) {
      mapping.phone = header;
    } else if (h.includes("name") || h.includes("姓名") || h.includes("名字") || h.includes("昵称")) {
      mapping.name = header;
    } else if (h.includes("telegram") || h.includes("tg") || h.includes("username") || h.includes("用户名")) {
      mapping.telegram_username = header;
    } else if (h.includes("email") || h.includes("邮箱") || h.includes("mail")) {
      mapping.email = header;
    } else if (h.includes("tag") || h.includes("标签") || h.includes("分组") || h.includes("group")) {
      mapping.tags = header;
    }
  }

  return mapping;
}

// ===== 主组件 =====

export default function ContactImportPage() {
  const queryClient = useQueryClient();

  const [step, setStep] = useState<ImportStep>("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRawRow[]>([]);
  const [mapping, setMapping] = useState<FieldMapping>({
    phone: UNMAPPED_VALUE,
    name: UNMAPPED_VALUE,
    telegram_username: UNMAPPED_VALUE,
    email: UNMAPPED_VALUE,
    tags: UNMAPPED_VALUE,
  });
  const [defaultTags, setDefaultTags] = useState("");
  const [platform, setPlatform] = useState("telegram");
  const [fileName, setFileName] = useState("");
  const [importResult, setImportResult] = useState<{ success: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pastedText, setPastedText] = useState("");

  const importMutation = useRpcMutation("contact_bulk_import", {
    onSuccess: (result) => {
      setImportResult({ success: result.data ?? 0, total: mappedContacts.length });
      queryClient.invalidateQueries({ queryKey: getRpcQueryKey("contact_list_cursor") });
      setStep("result");
    },
  });

  // 处理文件上传
  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      return;
    }
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCsv(text);
      setCsvHeaders(headers);
      setCsvRows(rows);
      setMapping(guessMapping(headers));
      setStep("mapping");
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handlePasteParse = () => {
    if (!pastedText.trim()) return;
    const { headers, rows } = parseCsv(pastedText);
    if (headers.length === 0) return;
    setCsvHeaders(headers);
    setCsvRows(rows);
    setMapping(guessMapping(headers));
    setStep("mapping");
    setFileName("粘贴内容");
  };

  // 更新字段映射
  const updateMapping = (dbField: keyof FieldMapping, csvColumn: string) => {
    setMapping((prev) => ({ ...prev, [dbField]: csvColumn }));
  };

  // 根据映射生成联系人数组
  const mappedContacts = useMemo(() => {
    return csvRows
      .map((row) => {
        const contact: Record<string, string | string[] | undefined> = {};

        if (mapping.phone !== UNMAPPED_VALUE) contact.phone = row[mapping.phone];
        if (mapping.name !== UNMAPPED_VALUE) contact.name = row[mapping.name];
        if (mapping.telegram_username !== UNMAPPED_VALUE) contact.telegram_username = row[mapping.telegram_username];
        if (mapping.email !== UNMAPPED_VALUE) contact.email = row[mapping.email];
        if (mapping.tags !== UNMAPPED_VALUE && row[mapping.tags]) {
          contact.tags = row[mapping.tags]
            .split(/[,，;；]/)
            .map((t) => t.trim())
            .filter(Boolean);
        }

        return contact;
      })
      .filter((c) => c.phone && String(c.phone).trim() !== "");
  }, [csvRows, mapping]);

  // 执行导入
  const handleImport = () => {
    const tagsArr = defaultTags
      .split(/[,，;；]/)
      .map((t) => t.trim())
      .filter(Boolean);

    importMutation.mutate({
      p_contacts: JSON.stringify(mappedContacts),
      p_platform: platform,
      p_source: "csv",
      p_default_tags: tagsArr,
    });
  };

  const isPhoneMapped = mapping.phone !== UNMAPPED_VALUE;

  return (
    <>
      <DashHeaders>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dash">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/dash/contacts">联系人</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>导入</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </DashHeaders>

      <DashContent className="flex flex-col gap-6 p-4 md:p-6 overflow-auto">
        {/* 步骤指示器 */}
        <div className="flex items-center justify-center gap-2 text-sm">
          {(["upload", "mapping", "preview", "result"] as ImportStep[]).map((s, i) => {
            const labels = ["上传文件", "字段映射", "预览确认", "导入结果"];
            const icons = [Upload, FileText, CheckCircle2, CheckCircle2];
            const Icon = icons[i];
            const isActive = s === step;
            const isDone =
              (s === "upload" && step !== "upload") ||
              (s === "mapping" && (step === "preview" || step === "result")) ||
              (s === "preview" && step === "result");

            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className={`h-px w-8 ${isDone ? "bg-emerald-500" : "bg-border"}`} />}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                        ? "bg-emerald-500/15 text-emerald-600"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {labels[i]}
                </div>
              </div>
            );
          })}
        </div>

        {/* 步骤一：上传文件 */}
        {step === "upload" && (
          <Card className="max-w-2xl mx-auto w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                上传 CSV 文件
              </CardTitle>
              <CardDescription>支持 CSV 格式文件。文件应包含表头行，至少包含手机号列。</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                role="button"
                tabIndex={0}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById("csv-file-input")?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    document.getElementById("csv-file-input")?.click();
                  }
                }}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <p className="text-base font-medium">将 CSV 文件拖放到此处</p>
                    <p className="text-sm text-muted-foreground mt-1">或点击选择文件</p>
                  </div>
                </div>
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>

              <div className="flex items-center gap-4 my-6">
                <div className="h-px bg-border flex-1" />
                <span className="text-xs text-muted-foreground font-medium uppercase">或粘贴内容</span>
                <div className="h-px bg-border flex-1" />
              </div>

              <div className="space-y-4">
                <Textarea
                  placeholder="在此粘贴 CSV 内容..."
                  className="min-h-[150px] font-mono text-xs resize-y"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                />
                <Button className="w-full" onClick={handlePasteParse} disabled={!pastedText.trim()} variant="secondary">
                  解析粘贴内容
                </Button>
              </div>

              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <p className="text-sm font-medium mb-2">CSV 格式示例：</p>
                <pre className="text-xs font-mono text-muted-foreground bg-background/50 p-3 rounded border overflow-x-auto">
                  {`phone,name,telegram_username,email,tags
+8613800138000,张三,zhangsan,zhangsan@example.com,VIP,潜客
+8613900139000,李四,,lisi@example.com,新客户`}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 步骤二：字段映射 */}
        {step === "mapping" && (
          <Card className="max-w-3xl mx-auto w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                字段映射
              </CardTitle>
              <CardDescription>
                将 CSV 文件中的列映射到数据库字段。已自动识别部分映射，请核对并调整。
                <br />
                <span className="font-medium text-foreground">
                  文件: {fileName} · {csvRows.length} 行数据 · {csvHeaders.length} 列
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                {DB_FIELDS.map((field) => (
                  <div
                    key={field.key}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
                  >
                    <Label className="w-48 text-sm flex items-center gap-1.5">
                      {field.label}
                      {field.required && <span className="text-red-500 text-xs">*必填</span>}
                    </Label>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Select value={mapping[field.key]} onValueChange={(v) => updateMapping(field.key, v)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="选择 CSV 列" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNMAPPED_VALUE}>
                          <span className="text-muted-foreground">— 不映射 —</span>
                        </SelectItem>
                        {csvHeaders.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                            {csvRows[0]?.[h] && (
                              <span className="text-muted-foreground ml-2 text-xs">
                                (例: {csvRows[0][h].slice(0, 20)})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* 额外配置 */}
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center gap-4">
                  <Label className="w-48 text-sm">平台</Label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="telegram">Telegram</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-4">
                  <Label className="w-48 text-sm flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" />
                    默认标签
                  </Label>
                  <Input
                    className="flex-1 max-w-sm"
                    placeholder="用逗号分隔，如: VIP, 新客户"
                    value={defaultTags}
                    onChange={(e) => setDefaultTags(e.target.value)}
                  />
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  返回上传
                </Button>
                <Button onClick={() => setStep("preview")} disabled={!isPhoneMapped}>
                  预览数据
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>

              {!isPhoneMapped && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-500/10 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p className="text-sm">请映射 "手机号" 字段（必填）</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 步骤三：预览确认 */}
        {step === "preview" && (
          <Card className="max-w-5xl mx-auto w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                预览导入数据
              </CardTitle>
              <CardDescription>
                共 {mappedContacts.length} 条有效联系人（已排除手机号为空的行）。 平台:{" "}
                {platform === "telegram" ? "Telegram" : "WhatsApp"}
                {defaultTags && ` · 默认标签: ${defaultTags}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[400px] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>手机号</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>Telegram</TableHead>
                      <TableHead>邮箱</TableHead>
                      <TableHead>标签</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedContacts.slice(0, 50).map((c, i) => (
                      <TableRow key={`row-${String(c.phone)}-${i}`}>
                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                        <TableCell className="font-mono text-sm">{String(c.phone || "")}</TableCell>
                        <TableCell>{String(c.name || "")}</TableCell>
                        <TableCell>
                          {c.telegram_username ? (
                            <span className="text-blue-500">@{String(c.telegram_username)}</span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{String(c.email || "-")}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {Array.isArray(c.tags) &&
                              c.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                                  {tag}
                                </Badge>
                              ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {mappedContacts.length > 50 && (
                  <div className="p-3 text-center text-sm text-muted-foreground bg-muted/20">
                    仅显示前 50 条，共 {mappedContacts.length} 条
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep("mapping")}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  调整映射
                </Button>
                <Button onClick={handleImport} disabled={importMutation.isPending || mappedContacts.length === 0}>
                  {importMutation.isPending ? (
                    <>导入中...</>
                  ) : (
                    <>
                      确认导入 ({mappedContacts.length} 条)
                      <CheckCircle2 className="ml-1.5 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              {importMutation.isError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-500/10 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p className="text-sm">导入失败: {(importMutation.error as Error)?.message || "未知错误"}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 步骤四：导入结果 */}
        {step === "result" && importResult && (
          <Card className="max-w-lg mx-auto w-full">
            <CardContent className="pt-8 pb-8">
              <div className="flex flex-col items-center gap-5 text-center">
                <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xl font-semibold">导入完成</p>
                  <p className="text-muted-foreground mt-1">
                    成功导入 <span className="font-bold text-emerald-600">{importResult.success}</span> 条联系人
                    {importResult.success < importResult.total && (
                      <span className="text-amber-600">
                        （{importResult.total - importResult.success} 条被跳过，可能已存在）
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" asChild>
                    <Link href="/dash/contacts">查看联系人列表</Link>
                  </Button>
                  <Button
                    onClick={() => {
                      setStep("upload");
                      setCsvHeaders([]);
                      setCsvRows([]);
                      setMapping({
                        phone: UNMAPPED_VALUE,
                        name: UNMAPPED_VALUE,
                        telegram_username: UNMAPPED_VALUE,
                        email: UNMAPPED_VALUE,
                        tags: UNMAPPED_VALUE,
                      });
                      setDefaultTags("");
                      setFileName("");
                      setImportResult(null);
                      setPastedText("");
                    }}
                  >
                    继续导入
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </DashContent>
    </>
  );
}
