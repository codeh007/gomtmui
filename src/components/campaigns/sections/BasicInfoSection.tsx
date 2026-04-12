import { Field, FieldContent, FieldError, FieldLabel } from "mtxuilib/ui/field";
import { Input } from "mtxuilib/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "mtxuilib/ui/select";
import { Textarea } from "mtxuilib/ui/textarea";
import type { CampaignFormApi } from "../schemas";
import { campaignDescriptionSchema, campaignNameSchema, platformSchema } from "../schemas";

interface BasicInfoSectionProps {
  form: CampaignFormApi;
}

export function BasicInfoSection({ form }: BasicInfoSectionProps) {
  return (
    <div className="space-y-4">
      <form.Field
        name="name"
        validators={{
          onChange: campaignNameSchema,
        }}
      >
        {(field) => (
          <Field>
            <FieldLabel>活动名称</FieldLabel>
            <FieldContent>
              <Input
                placeholder="e.g. 春节促销活动"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </FieldContent>
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>

      <form.Field
        name="description"
        validators={{
          onChange: campaignDescriptionSchema,
        }}
      >
        {(field) => (
          <Field>
            <FieldLabel>描述 (可选)</FieldLabel>
            <FieldContent>
              <Textarea
                placeholder="活动备注..."
                name={field.name}
                value={field.state.value || ""}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </FieldContent>
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>

      <form.Field
        name="platform"
        validators={{
          onChange: platformSchema,
        }}
      >
        {(field) => (
          <Field>
            <FieldLabel>平台</FieldLabel>
            <FieldContent>
              <Select
                value={field.state.value}
                onValueChange={(value) => {
                  const parsedPlatform = platformSchema.safeParse(value);
                  if (parsedPlatform.success) {
                    field.handleChange(parsedPlatform.data);
                  }
                }}
                disabled
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="telegram">Telegram</SelectItem>
                </SelectContent>
              </Select>
            </FieldContent>
            <div className="text-[0.8rem] text-muted-foreground">当前仅支持 Telegram 平台</div>
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
    </div>
  );
}
