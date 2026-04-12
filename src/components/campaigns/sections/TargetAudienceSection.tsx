import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "mtxuilib/ui/field";
import { Textarea } from "mtxuilib/ui/textarea";
import type { CampaignFormApi } from "../schemas";
import { targetTagsSchema } from "../schemas";

interface TargetAudienceSectionProps {
  form: CampaignFormApi;
}

export function TargetAudienceSection({ form }: TargetAudienceSectionProps) {
  return (
    <div className="space-y-4">
      <form.Field
        name="target_tags"
        validators={{
          onChange: targetTagsSchema,
        }}
      >
        {(field) => (
          <Field>
            <FieldLabel>目标标签 (可选)</FieldLabel>
            <FieldContent>
              <Textarea
                placeholder="输入标签, 每行一个, 或用逗号分隔 (留空则选择所有联系人)"
                value={field.state.value?.join("\n") || ""}
                onBlur={field.handleBlur}
                onChange={(e) => {
                  const tags = e.target.value
                    .split(/[\n,]/)
                    .map((t) => t.trim())
                    .filter(Boolean);
                  field.handleChange(tags);
                }}
                className="min-h-[100px]"
              />
            </FieldContent>
            <FieldDescription>
              仅向包含指定标签的联系人发送。如果不指定，将向所有状态为 Active 的联系人发送。
            </FieldDescription>
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
    </div>
  );
}
