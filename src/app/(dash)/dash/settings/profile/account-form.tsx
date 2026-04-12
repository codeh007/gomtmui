"use client";
import { useForm } from "@tanstack/react-form";
import { useSupabaseBrowser } from "mtmsdk/supabase/context";
import { useRpcMutation } from "mtmsdk/supabase/use-sb-query/use-rpc-mutation";
import { useRpcQuery } from "mtmsdk/supabase/use-sb-query/use-rpc-query";
import { publicProfilesRowSchema } from "mtmsdk/types/database.schemas";
import { Button } from "mtxuilib/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "mtxuilib/ui/field";
import { Input } from "mtxuilib/ui/input";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ListSkeleton } from "@/components/common/list-skeleton";
import Avatar from "./avatar";

// Profile schema 和类型
const zProfileArray = z.array(publicProfilesRowSchema);

const profileFormSchema = z.object({
  fullName: z.string().min(1, "姓名不能为空").max(100, "姓名不能超过100个字符"),
  username: z.string().min(3, "用户名至少3个字符").max(50, "用户名不能超过50个字符"),
  website: z.string().url("请输入有效的网址").or(z.literal("")),
  avatarUrl: z.string().url("请输入有效的头像URL").or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function AccountForm() {
  const supabase = useSupabaseBrowser();
  const [email, setEmail] = useState<string>("");

  // 使用 RPC 函数获取用户信息 (基于 auth.uid())
  const { data: profileData, isLoading, refetch } = useRpcQuery("user_profile_get", {}, { schema: zProfileArray });

  // 取第一个 profile
  const profile = profileData?.[0];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) {
        setEmail(data.user.email);
      }
    });
  }, [supabase]);

  // 使用 RPC 变更函数更新用户信息
  const updateProfile = useRpcMutation("user_profile_upsert", {
    onSuccess: () => {
      toast.success("个人资料已更新");
      refetch();
    },
    onError: (error) => {
      toast.error("更新资料失败", {
        description: error.message,
      });
    },
  });

  const form = useForm({
    defaultValues: {
      fullName: profile?.full_name || "",
      username: profile?.username || "",
      website: profile?.website || "",
      avatarUrl: profile?.avatar_url || "",
    } as ProfileFormValues,
    validators: {
      onChange: profileFormSchema,
      onSubmit: profileFormSchema,
    },
    onSubmit: async ({ value }) => {
      await updateProfile.mutateAsync({
        p_username: value.username,
        p_full_name: value.fullName,
        p_website: value.website,
        p_avatar_url: value.avatarUrl,
      });
    },
  });

  // 当 profile 数据加载后更新表单
  useEffect(() => {
    if (profile) {
      form.reset({
        fullName: profile.full_name || "",
        username: profile.username || "",
        website: profile.website || "",
        avatarUrl: profile.avatar_url || "",
      });
    }
  }, [profile, form.reset]);

  if (isLoading && !profile) {
    return <ListSkeleton count={4} />;
  }

  return (
    <div className="space-y-6 max-w-xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <FieldGroup>
          <div className="flex flex-col items-center sm:items-start pb-4">
            <form.Field
              name="avatarUrl"
              children={(field) => (
                <Avatar
                  uid={profile?.id ?? null}
                  url={field.state.value || null}
                  size={120}
                  onUpload={(url) => {
                    field.handleChange(url);
                    // 自动提交头像更改
                    form.handleSubmit();
                  }}
                />
              )}
            />
          </div>

          <div className="space-y-4">
            <Field>
              <FieldLabel>邮箱地址</FieldLabel>
              <Input value={email || "加载中..."} disabled className="bg-muted/50" />
            </Field>

            <form.Field
              name="fullName"
              children={(field) => (
                <Field>
                  <FieldLabel>姓名 / 昵称</FieldLabel>
                  <Input
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="请输入您的真实姓名或常用昵称"
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            />

            <form.Field
              name="username"
              children={(field) => (
                <Field>
                  <FieldLabel>用户名</FieldLabel>
                  <Input
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="唯一用户名"
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            />

            <form.Field
              name="website"
              children={(field) => (
                <Field>
                  <FieldLabel>个人网站 / 社交链接</FieldLabel>
                  <Input
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="https://example.com"
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            />
          </div>

          <div className="pt-4 flex justify-start">
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting} className="min-w-[120px]">
                  {isSubmitting ? "正在保存..." : "保存更改"}
                </Button>
              )}
            />
          </div>
        </FieldGroup>
      </form>
    </div>
  );
}
