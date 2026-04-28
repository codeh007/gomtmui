export interface NavItem {
  label: string;
  url: string;
  icon?: string; // Icon name for IconX
  tooltip?: string;
  badge?: string;
  children?: NavItem[];
  requiredRole?: "admin";
}

export const DASH_NAV_ITEMS: NavItem[] = [
  {
    label: "设备",
    url: "/dash/devices",
    icon: "smartphone",
    tooltip: "我的受管设备",
  },
  {
    label: "账号",
    url: "/dash/cloud-accounts",
    icon: "user",
    tooltip: "平台账号管理",
  },
  {
    label: "联系人",
    url: "/dash/contacts",
    icon: "users",
    tooltip: "CRM 联系人管理",
  },
  {
    label: "推广活动",
    url: "/dash/campaigns",
    icon: "megaphone",
    tooltip: "营销活动管理",
  },
  {
    label: "代理",
    url: "/dash/mproxy",
    icon: "globe",
    tooltip: "订阅导入与提取代理",
  },
  {
    label: "任务",
    url: "/dash/tasks",
    icon: "clipboard-list",
  },
  {
    label: "日志",
    url: "/dash/logs",
    icon: "terminal",
  },
  {
    label: "Job Queue",
    url: "/dash/jobs",
    icon: "cpu",
    tooltip: "异步任务队列监控",
    requiredRole: "admin",
  },
  {
    label: "Hermes",
    url: "/dash/hermes",
    icon: "cpu",
    tooltip: "Hermes Agent 工作台",
  },
  {
    label: "配置",
    url: "/dash/gomtm/configs",
    icon: "settings",
    tooltip: "gomtm worker 配置控制面",
    requiredRole: "admin",
  },
];
