export type AdminLeadListItem = {
  id: string;
  reference: string;
  name: string;
  subject: string;
  source: string;
  status: string;
  priority: string;
  owner: string;
  due: string;
  value: string;
  email: string | null;
  phone: string | null;
  assignedToMe: boolean;
  followUpDue: boolean;
};

export type AdminLeadList = {
  leads: AdminLeadListItem[];
  metrics: {
    open: number;
    newToday: number;
    averageResponseMinutes: number | null;
    conversionRate: number;
    mine: number;
    followUpDue: number;
    highPriority: number;
  };
};

export type AdminSourcingListItem = {
  id: string;
  reference: string;
  customer: string;
  brief: string;
  budget: string;
  status: string;
  owner: string;
  priority: string;
  updated: string;
  candidates: number;
  sourcingFee: number | null;
  expectedMargin: number | null;
};

export type AdminSourcingList = {
  requests: AdminSourcingListItem[];
  metrics: {
    open: number;
    averageDaysToFirstOption: number | null;
    expectedMargin: number;
    successRate: number;
  };
};

export type AdminCustomerListItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  relationship: string;
  lastContact: string;
  open: number;
  consent: string;
};

export type AdminCustomerList = {
  customers: AdminCustomerListItem[];
  metrics: {
    total: number;
    active: number;
    possibleDuplicates: number;
  };
};

export type AdminTaskListItem = {
  id: string;
  title: string;
  linked: string;
  href: string;
  owner: string;
  due: string;
  status: string;
  priority: string;
  assignedToMe: boolean;
  completed: boolean;
};

export type AdminDiaryAppointment = {
  id: string;
  reference: string;
  date: string;
  dateLabel: string;
  time: string;
  duration: string;
  durationMinutes: number;
  title: string;
  customer: string;
  customerName: string;
  phone: string | null;
  staff: string;
  tone: "blue" | "green" | "amber";
  status: string;
  registration: string | null;
  internalNote: string | null;
};

export type AdminDiaryStaffOption = {
  id: string;
  name: string;
};

export type AdminDiaryList = {
  appointments: AdminDiaryAppointment[];
  weekStart: string;
  timezone: string;
  staffOptions: AdminDiaryStaffOption[];
};

export type AdminSalesPipelineItem = {
  id: string;
  name: string;
  subject: string;
  owner: string;
  value: string;
  stage: string;
  href: string;
};

export type AdminSalesPipeline = {
  opportunities: AdminSalesPipelineItem[];
  metrics: {
    openPipelineValue: number;
    conversionRate: number;
    handoversThisWeek: number;
  };
};

export type AdminTeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastActive: string;
  initials: string;
};

export type AdminTeamList = {
  members: AdminTeamMember[];
  metrics: {
    total: number;
    active: number;
    configuredRoles: number;
  };
};
