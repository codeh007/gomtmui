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
    label: "Server Instances",
    url: "/dash/instances",
    icon: "server",
    requiredRole: "admin",
  },
  {
    label: "MITM",
    url: "/dash/mitm",
    icon: "network",
    tooltip: "中间人代理",
  },
  {
    label: "P2P",
    url: "/dash/p2p",
    icon: "network",
    tooltip: "P2P 网络连接与节点发现",
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
];
