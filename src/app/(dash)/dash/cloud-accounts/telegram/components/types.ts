export type LoginStep =
  | "pending"
  | "send_code"
  | "wait_code"
  | "verify_code"
  | "need_2fa"
  | "fetch_info"
  | "success"
  | "failed";
