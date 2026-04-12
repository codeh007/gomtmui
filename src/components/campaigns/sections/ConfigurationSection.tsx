import { useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { Checkbox } from "mtxuilib/ui/checkbox";
import { Field, FieldContent, FieldError, FieldLabel } from "mtxuilib/ui/field";
import { Input } from "mtxuilib/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "mtxuilib/ui/select";
import { Separator } from "mtxuilib/ui/separator";
import { Switch } from "mtxuilib/ui/switch";
import { z } from "zod";
import { CloudAccountRecordSchema } from "@/components/cloud-account/schemas";
import {
  accountStrategySchema,
  type CampaignFormApi,
  cloudAccountIdsSchema,
  dailyLimitSchema,
  intervalMaxSchema,
  intervalMinSchema,
  maxRetriesSchema,
} from "../schemas";

interface ConfigurationSectionProps {
  form: CampaignFormApi;
}

export function ConfigurationSection({ form }: ConfigurationSectionProps) {
  const { data: cloudAccounts } = useRpcQuery(
    "cloud_account_list_cursor",
    {
      p_limit: 100,
      p_platform_name: "telegram",
      p_status: "active",
    },
    {
      schema: z.array(CloudAccountRecordSchema),
    },
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <form.Field
          name="cloud_account_ids"
          validators={{
            onChange: cloudAccountIdsSchema,
          }}
        >
          {(field) => (
            <Field>
              <FieldLabel>发送账号 Selection</FieldLabel>
              <FieldContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[200px] overflow-y-auto border rounded-md p-4">
                  {cloudAccounts?.map((account) => (
                    <div key={account.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={`account-${account.id}`}
                        checked={(field.state.value || []).includes(account.id)}
                        onCheckedChange={(checked) => {
                          const current = field.state.value || [];
                          if (checked) {
                            field.handleChange([...current, account.id]);
                          } else {
                            field.handleChange(current.filter((id) => id !== account.id));
                          }
                        }}
                      />
                      <label htmlFor={`account-${account.id}`} className="text-sm cursor-pointer w-full">
                        <div className="font-medium text-gray-900 truncate">
                          {account.account_name || account.account_email || account.platform_name}
                        </div>
                        <div className="text-gray-500 text-xs">{account.status}</div>
                      </label>
                    </div>
                  ))}
                  {(!cloudAccounts || cloudAccounts.length === 0) && (
                    <div className="text-sm text-gray-500 italic">没有可用的 Telegram 账号</div>
                  )}
                </div>
              </FieldContent>
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        <form.Field
          name="daily_limit_per_account"
          validators={{
            onChange: dailyLimitSchema,
          }}
        >
          {(field) => (
            <Field>
              <FieldLabel>单账号每日上限</FieldLabel>
              <FieldContent>
                <Input
                  type="number"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(parseInt(e.target.value, 10) || 0)}
                />
              </FieldContent>
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>

        <div className="space-y-2">
          <FieldLabel>发送间隔 (秒)</FieldLabel>
          <div className="flex items-center gap-2">
            <form.Field
              name="interval_min"
              validators={{
                onChange: intervalMinSchema,
              }}
            >
              {(field) => (
                <Field className="w-full">
                  <FieldContent>
                    <Input
                      type="number"
                      placeholder="Min"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(parseInt(e.target.value, 10) || 0)}
                    />
                  </FieldContent>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <span>-</span>
            <form.Field
              name="interval_max"
              validators={{
                onChange: intervalMaxSchema,
              }}
            >
              {(field) => (
                <Field className="w-full">
                  <FieldContent>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(parseInt(e.target.value, 10) || 0)}
                    />
                  </FieldContent>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </div>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <form.Field
          name="account_strategy"
          validators={{
            onChange: accountStrategySchema,
          }}
        >
          {(field) => (
            <Field>
              <FieldLabel>账号轮询策略</FieldLabel>
              <FieldContent>
                <Select
                  value={field.state.value}
                  onValueChange={(value) => {
                    const parsedAccountStrategy = accountStrategySchema.safeParse(value);
                    if (parsedAccountStrategy.success) {
                      field.handleChange(parsedAccountStrategy.data);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round_robin">轮询 (Round Robin)</SelectItem>
                    <SelectItem value="random">随机 (Random)</SelectItem>
                    <SelectItem value="sequential">顺序 (Sequential)</SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>

        <div className="space-y-4">
          <form.Field name="retry_on_failure">
            {(field) => (
              <div className="flex items-center space-x-2 pt-8">
                <Switch id="retry-switch" checked={field.state.value} onCheckedChange={field.handleChange} />
                <label
                  htmlFor="retry-switch"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  失败自动重试
                </label>
              </div>
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => [state.values.retry_on_failure]}
            children={([retryEnabled]) =>
              retryEnabled ? (
                <form.Field
                  name="max_retries"
                  validators={{
                    onChange: maxRetriesSchema,
                  }}
                >
                  {(field) => (
                    <Field>
                      <FieldLabel>最大重试次数</FieldLabel>
                      <FieldContent>
                        <Input
                          type="number"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(parseInt(e.target.value, 10) || 0)}
                        />
                      </FieldContent>
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </form.Field>
              ) : null
            }
          />
        </div>
      </div>
    </div>
  );
}
