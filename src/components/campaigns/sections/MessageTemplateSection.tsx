import { Button } from "mtxuilib/ui/button";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "mtxuilib/ui/field";
import { Textarea } from "mtxuilib/ui/textarea";
import { type CampaignFormApi, messageTemplateSchema } from "../schemas";

interface MessageTemplateSectionProps {
  form: CampaignFormApi;
}

export function MessageTemplateSection({ form }: MessageTemplateSectionProps) {
  return (
    <div className="space-y-4">
      <form.Field
        name="message_template"
        validators={{
          onChange: messageTemplateSchema,
        }}
      >
        {(field) => (
          <Field>
            <FieldLabel>消息内容</FieldLabel>
            <div className="flex gap-2 mb-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const currentValue = field.state.value || "";
                  const newValue = `${currentValue} {name} `;
                  field.handleChange(newValue);
                }}
              >
                Insert Name
              </Button>
            </div>
            <FieldContent>
              <Textarea
                placeholder="输入消息内容..."
                className="min-h-[200px]"
                name={field.name}
                value={field.state.value || ""}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </FieldContent>
            <FieldDescription>支持变量: {"{name}"} - 联系人姓名</FieldDescription>
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
    </div>
  );
}
