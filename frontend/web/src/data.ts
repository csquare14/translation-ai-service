export type Severity = "critical" | "high" | "medium" | "low";
export type Resource = {
  id: string;
  name: string;
  type: string;
  risk: Severity | "secure" | "normal" | "unknown";
  x: number;
  y: number;
  note: string;
};
export const resources: Resource[] = [
  {
    id: "account",
    name: "cloudquery-production",
    type: "Account",
    risk: "secure",
    x: 545,
    y: 30,
    note: "Sample production AWS account in ap-south-1.",
  },
  {
    id: "vpc",
    name: "vpc-prod-main",
    type: "VPC",
    risk: "normal",
    x: 310,
    y: 145,
    note: "Primary application network. CIDR 10.0.0.0/16.",
  },
  {
    id: "developer",
    name: "devops-user",
    type: "IAM user",
    risk: "medium",
    x: 745,
    y: 145,
    note: "Human identity with permission to assume an application role.",
  },
  {
    id: "backup",
    name: "legacy-backup-2022",
    type: "S3 bucket",
    risk: "low",
    x: 975,
    y: 145,
    note: "Archive bucket with an outdated lifecycle policy.",
  },
  {
    id: "public",
    name: "subnet-public-1a",
    type: "Subnet",
    risk: "medium",
    x: 100,
    y: 260,
    note: "Public subnet with a route to the internet gateway.",
  },
  {
    id: "private",
    name: "subnet-private-1b",
    type: "Subnet",
    risk: "secure",
    x: 545,
    y: 260,
    note: "Internal application subnet.",
  },
  {
    id: "lambda",
    name: "translate-processor",
    type: "Lambda",
    risk: "normal",
    x: 975,
    y: 375,
    note: "Example translation worker execution environment.",
  },
  {
    id: "web",
    name: "web-frontend-01",
    type: "EC2",
    risk: "critical",
    x: 100,
    y: 375,
    note: "Sample web instance with a public address and a broad inbound rule.",
  },
  {
    id: "worker",
    name: "app-worker-02",
    type: "EC2",
    risk: "normal",
    x: 545,
    y: 375,
    note: "Internal application worker.",
  },
  {
    id: "policy",
    name: "cq-wildcard-policy",
    type: "IAM policy",
    risk: "high",
    x: 745,
    y: 260,
    note: "Policy grants broad object access in the sample scenario.",
  },
  {
    id: "internet",
    name: "External access",
    type: "Internet",
    risk: "critical",
    x: 100,
    y: 490,
    note: "External entry point used to trace exposed infrastructure.",
  },
  {
    id: "sg",
    name: "sg-web-public",
    type: "Security group",
    risk: "critical",
    x: 310,
    y: 490,
    note: "SSH ingress is permitted from 0.0.0.0/0 in this sample.",
  },
  {
    id: "role",
    name: "EC2-AppRole",
    type: "IAM role",
    risk: "critical",
    x: 745,
    y: 490,
    note: "Application role can read sensitive sample storage.",
  },
  {
    id: "logs",
    name: "cq-access-logs",
    type: "S3 bucket",
    risk: "secure",
    x: 975,
    y: 490,
    note: "Private access log storage.",
  },
  {
    id: "database",
    name: "cq-metadata-db",
    type: "RDS",
    risk: "medium",
    x: 310,
    y: 605,
    note: "Metadata database with a broad internal access rule.",
  },
  {
    id: "docs",
    name: "cq-translation-docs",
    type: "S3 bucket",
    risk: "critical",
    x: 745,
    y: 605,
    note: "Sensitive document storage at the end of the example attack path.",
  },
  {
    id: "lambda-role",
    name: "Lambda-ExecRole",
    type: "IAM role",
    risk: "normal",
    x: 975,
    y: 605,
    note: "Example execution role for the translation processor.",
  },
];
export const edges: [string, string, string][] = [
  ["account", "vpc", "contains"],
  ["account", "developer", "owns"],
  ["account", "backup", "owns"],
  ["vpc", "public", "contains"],
  ["vpc", "private", "contains"],
  ["public", "web", "hosts"],
  ["private", "worker", "hosts"],
  ["developer", "policy", "uses"],
  ["policy", "role", "grants access"],
  ["internet", "sg", "SSH / tcp 22"],
  ["sg", "web", "attached"],
  ["web", "role", "assumes role"],
  ["role", "docs", "read / write"],
  ["worker", "database", "connects"],
  ["lambda", "lambda-role", "executes as"],
  ["lambda", "logs", "writes logs"],
  ["lambda-role", "docs", "reads / writes"],
];
export type Finding = {
  id: string;
  title: string;
  category: string;
  resource: string;
  severity: Severity;
  recommendation: string;
};
export const findings: Finding[] = [
  {
    id: "SF-101",
    title: "SSH open to the internet",
    category: "Unrestricted inbound rules",
    resource: "sg",
    severity: "critical",
    recommendation:
      "Restrict port 22 to approved addresses or use Systems Manager Session Manager.",
  },
  {
    id: "SF-102",
    title: "Wildcard S3 permissions on EC2-AppRole",
    category: "Overly permissive IAM roles",
    resource: "role",
    severity: "critical",
    recommendation:
      "Limit actions and resource ARNs to the buckets and operations this role requires.",
  },
  {
    id: "SF-103",
    title: "Sensitive bucket reachable from public instance",
    category: "Sensitive storage exposure",
    resource: "docs",
    severity: "critical",
    recommendation:
      "Remove the unnecessary permission path from the public-facing instance.",
  },
  {
    id: "SF-104",
    title: "iam:PassRole on instance role",
    category: "Potential privilege escalation",
    resource: "role",
    severity: "critical",
    recommendation:
      "Scope PassRole to the required service and exact role ARN.",
  },
  {
    id: "SF-105",
    title: "EC2 instance with a public IP",
    category: "Publicly exposed resources",
    resource: "web",
    severity: "high",
    recommendation:
      "Place the instance behind a load balancer and remove its direct public address.",
  },
  {
    id: "SF-106",
    title: "Human user can assume application role",
    category: "Overly permissive IAM roles",
    resource: "developer",
    severity: "high",
    recommendation:
      "Review the role trust policy and require appropriate session conditions.",
  },
  {
    id: "SF-107",
    title: "Public entry point has no filtering layer",
    category: "Publicly exposed resources",
    resource: "public",
    severity: "high",
    recommendation:
      "Review ingress controls and apply application-layer filtering where needed.",
  },
  {
    id: "SF-108",
    title: "Long-lived access credentials",
    category: "Identity hygiene",
    resource: "developer",
    severity: "high",
    recommendation:
      "Rotate stale credentials and prefer temporary role sessions.",
  },
  {
    id: "SF-109",
    title: "HTTPS open to all on web security group",
    category: "Unrestricted inbound rules",
    resource: "sg",
    severity: "medium",
    recommendation:
      "Confirm public ingress is required and scope traffic to the intended entry point.",
  },
  {
    id: "SF-110",
    title: "Broad internal database access",
    category: "Unrestricted inbound rules",
    resource: "database",
    severity: "medium",
    recommendation:
      "Allow database traffic only from the application security group.",
  },
  {
    id: "SF-111",
    title: "Storage permissions are inherited broadly",
    category: "Sensitive storage exposure",
    resource: "policy",
    severity: "medium",
    recommendation:
      "Replace wildcard storage grants with individual resource permissions.",
  },
  {
    id: "SF-112",
    title: "Public subnet hosts an application worker",
    category: "Publicly exposed resources",
    resource: "public",
    severity: "medium",
    recommendation:
      "Review subnet placement and move internal workloads to private subnets.",
  },
  {
    id: "SF-113",
    title: "Backup lifecycle policy needs review",
    category: "Storage hygiene",
    resource: "backup",
    severity: "low",
    recommendation:
      "Set retention and archival rules that match the data retention policy.",
  },
  {
    id: "SF-114",
    title: "Resource tags are incomplete",
    category: "Inventory hygiene",
    resource: "worker",
    severity: "low",
    recommendation: "Add owner, environment, and data-classification tags.",
  },
  {
    id: "SF-115",
    title: "Example account has no ownership annotation",
    category: "Inventory hygiene",
    resource: "account",
    severity: "low",
    recommendation: "Document the owning team and an operational contact.",
  },
];
export const attackPaths = [
  {
    id: "AP-001",
    name: "External access to sensitive documents",
    severity: "critical" as Severity,
    score: 9.6,
    nodes: ["internet", "sg", "web", "role", "docs"],
    explanation:
      "Public SSH access reaches an instance whose role grants access to document storage.",
  },
  {
    id: "AP-002",
    name: "Developer identity to document storage",
    severity: "high" as Severity,
    score: 8.1,
    nodes: ["developer", "policy", "role", "docs"],
    explanation:
      "A human identity inherits broad storage permissions through a policy and application role.",
  },
  {
    id: "AP-003",
    name: "Worker to metadata database",
    severity: "medium" as Severity,
    score: 5.8,
    nodes: ["vpc", "private", "worker", "database"],
    explanation:
      "Internal network reachability exposes the database to a broader set of workloads.",
  },
];
export const resourceName = (id: string) =>
  resources.find((resource) => resource.id === id)?.name ?? id;
