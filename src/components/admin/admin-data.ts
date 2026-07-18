export type AdminVehicle = {
  id: string;
  stockNumber: string;
  registration: string;
  title: string;
  year: number;
  mileage: number;
  price: number;
  cost: number;
  status: string;
  age: number;
  image: string;
  slug?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  derivative?: string | null;
  bodyType?: string | null;
  fuelType?: string | null;
  transmission?: string | null;
  colour?: string | null;
  doors?: number | null;
  seats?: number | null;
  engineSizeCc?: number | null;
  powerBhp?: number | null;
  co2EmissionsGKm?: number | null;
  motExpiry?: string | null;
  previousOwners?: number | null;
  serviceHistory?: string | null;
  keys?: number | null;
  provenanceStatus?: string | null;
  inspectionNotes?: string | null;
  attentionGrabber?: string | null;
  description?: string | null;
  features?: string[];
  featured?: boolean;
  isPublic?: boolean;
  purchasePrice?: number;
  preparationCosts?: number;
  repairCosts?: number;
  otherCosts?: number;
  minimumAcceptablePrice?: number | null;
  depositAmount?: number;
  actualSalePrice?: number | null;
};

export type AdminVehiclePhoto = {
  id: string;
  url: string;
  altText: string;
  cover?: boolean;
  status?: "ready" | "uploading" | "error";
  progress?: number;
};

export type AdminVehicleHistory = {
  id: string;
  title: string;
  detail: string;
  time: string;
  actor: string;
};

export const vehicles: AdminVehicle[] = [
  {
    id: "veh-001",
    stockNumber: "DOS-1042",
    registration: "LT21 XKM",
    title: "BMW 320i M Sport",
    year: 2021,
    mileage: 28_430,
    price: 25_995,
    cost: 21_200,
    status: "On forecourt",
    age: 16,
    image: "/images/hero-showroom.png",
  },
  {
    id: "veh-002",
    stockNumber: "DOS-1041",
    registration: "YG70 VHR",
    title: "Volvo XC40 T3 R-Design",
    year: 2020,
    mileage: 34_810,
    price: 23_490,
    cost: 19_100,
    status: "Reserved",
    age: 11,
    image: "/images/hero-showroom.png",
  },
  {
    id: "veh-003",
    stockNumber: "DOS-1040",
    registration: "EK22 UPA",
    title: "Volkswagen Golf 1.5 TSI Life",
    year: 2022,
    mileage: 19_260,
    price: 20_995,
    cost: 17_450,
    status: "Preparation",
    age: 7,
    image: "/images/hero-showroom.png",
  },
  {
    id: "veh-004",
    stockNumber: "DOS-1039",
    registration: "KN19 RPO",
    title: "Audi A3 Sportback 35 TFSI",
    year: 2019,
    mileage: 41_720,
    price: 18_750,
    cost: 15_600,
    status: "Photography required",
    age: 22,
    image: "/images/hero-showroom.png",
  },
  {
    id: "veh-005",
    stockNumber: "DOS-1038",
    registration: "DF68 WZE",
    title: "Mercedes-Benz A200 AMG Line",
    year: 2018,
    mileage: 49_310,
    price: 17_995,
    cost: 14_800,
    status: "Due in",
    age: 4,
    image: "/images/hero-showroom.png",
  },
  {
    id: "veh-006",
    stockNumber: "DOS-1034",
    registration: "WX20 DLV",
    title: "MINI Countryman Cooper S",
    year: 2020,
    mileage: 36_090,
    price: 21_250,
    cost: 18_400,
    status: "Sold",
    age: 29,
    image: "/images/hero-showroom.png",
  },
];

export const leads = [
  {
    id: "lead-1842",
    name: "Sophie Bennett",
    subject: "BMW 320i M Sport",
    source: "Website enquiry",
    status: "New",
    priority: "High",
    owner: "Unassigned",
    due: "Today, 10:30",
    value: "£25,995",
  },
  {
    id: "lead-1841",
    name: "Daniel Cooper",
    subject: "Part exchange valuation",
    source: "Phone",
    status: "Contact attempted",
    priority: "Normal",
    owner: "Aisha Khan",
    due: "Today, 11:00",
    value: "£18,750",
  },
  {
    id: "lead-1839",
    name: "Amelia Wilson",
    subject: "Volvo XC40 T3",
    source: "Auto Trader",
    status: "Appointment booked",
    priority: "High",
    owner: "Tom Harris",
    due: "Today, 14:30",
    value: "£23,490",
  },
  {
    id: "lead-1837",
    name: "Oliver Taylor",
    subject: "Volkswagen Golf",
    source: "Walk-in",
    status: "Qualified",
    priority: "Normal",
    owner: "Aisha Khan",
    due: "Tomorrow",
    value: "£20,995",
  },
  {
    id: "lead-1834",
    name: "Grace Evans",
    subject: "Mercedes-Benz A200",
    source: "Referral",
    status: "Negotiation",
    priority: "High",
    owner: "Tom Harris",
    due: "18 Jul",
    value: "£17,995",
  },
  {
    id: "lead-1829",
    name: "Noah Roberts",
    subject: "MINI Countryman",
    source: "Website callback",
    status: "Won",
    priority: "Normal",
    owner: "Tom Harris",
    due: "Complete",
    value: "£21,250",
  },
] as const;

export const sourcingRequests = [
  {
    id: "SRC-0238",
    customer: "Harriet Jones",
    brief: "Porsche Macan S, 2019+, dark colour",
    budget: "£48,000",
    status: "Options found",
    owner: "Tom Harris",
    priority: "High",
    updated: "18 min ago",
    candidates: 3,
  },
  {
    id: "SRC-0237",
    customer: "Ethan Clarke",
    brief: "VW Transporter, automatic, under 60k",
    budget: "£32,000",
    status: "Search active",
    owner: "Aisha Khan",
    priority: "Normal",
    updated: "1 hr ago",
    candidates: 1,
  },
  {
    id: "SRC-0235",
    customer: "Mia Walker",
    brief: "Audi Q3, petrol, heated seats",
    budget: "£25,000",
    status: "Requirements confirmed",
    owner: "Aisha Khan",
    priority: "Normal",
    updated: "Yesterday",
    candidates: 0,
  },
  {
    id: "SRC-0232",
    customer: "Henry Lewis",
    brief: "BMW M340i Touring, blue or grey",
    budget: "£45,000",
    status: "Deposit requested",
    owner: "Tom Harris",
    priority: "High",
    updated: "Yesterday",
    candidates: 2,
  },
  {
    id: "SRC-0229",
    customer: "Isla Hall",
    brief: "Small hybrid, automatic, low mileage",
    budget: "£18,000",
    status: "Vehicle secured",
    owner: "Aisha Khan",
    priority: "Normal",
    updated: "15 Jul",
    candidates: 4,
  },
] as const;

export const repairJobs = [
  {
    id: "REP-1092",
    customer: "Lucas Green",
    vehicle: "Ford Focus",
    registration: "ML18 JXO",
    summary: "Intermittent engine warning light",
    status: "Diagnosing",
    technician: "Ben Carter",
    due: "Today, 16:00",
    estimate: "Pending",
  },
  {
    id: "REP-1091",
    customer: "Ella Thompson",
    vehicle: "Nissan Qashqai",
    registration: "PE69 URB",
    summary: "Front brakes and annual service",
    status: "Work in progress",
    technician: "Chris Webb",
    due: "Today, 17:30",
    estimate: "£684.00",
  },
  {
    id: "REP-1089",
    customer: "James White",
    vehicle: "Audi A4",
    registration: "KS17 LNV",
    summary: "Coolant loss investigation",
    status: "Awaiting approval",
    technician: "Ben Carter",
    due: "Tomorrow",
    estimate: "£492.50",
  },
  {
    id: "REP-1088",
    customer: "Freya Martin",
    vehicle: "Toyota Yaris",
    registration: "GY21 EKM",
    summary: "MOT preparation and rear tyres",
    status: "Ready for collection",
    technician: "Chris Webb",
    due: "Today, 15:00",
    estimate: "£378.00",
  },
  {
    id: "REP-1086",
    customer: "George King",
    vehicle: "Range Rover Evoque",
    registration: "RO18 ZTU",
    summary: "Battery drain and diagnostics",
    status: "Parts ordered",
    technician: "Ben Carter",
    due: "19 Jul",
    estimate: "£563.00",
  },
] as const;

export const customers = [
  {
    id: "cus-2011",
    name: "Sophie Bennett",
    email: "sophie.bennett@example.com",
    phone: "07700 900 412",
    relationship: "Sales prospect",
    lastContact: "12 min ago",
    open: 2,
  },
  {
    id: "cus-2008",
    name: "Lucas Green",
    email: "lucas.green@example.com",
    phone: "07700 900 318",
    relationship: "Service customer",
    lastContact: "Today",
    open: 1,
  },
  {
    id: "cus-1997",
    name: "Harriet Jones",
    email: "harriet.jones@example.com",
    phone: "07700 900 641",
    relationship: "Sourcing client",
    lastContact: "Today",
    open: 3,
  },
  {
    id: "cus-1974",
    name: "Amelia Wilson",
    email: "amelia.wilson@example.com",
    phone: "07700 900 702",
    relationship: "Returning customer",
    lastContact: "Yesterday",
    open: 1,
  },
  {
    id: "cus-1941",
    name: "Ella Thompson",
    email: "ella.thompson@example.com",
    phone: "07700 900 826",
    relationship: "Sales & service",
    lastContact: "15 Jul",
    open: 1,
  },
] as const;

export const tasks = [
  {
    id: "task-01",
    title: "Call Sophie about the 320i",
    linked: "Lead #1842",
    owner: "Aisha Khan",
    due: "10:30",
    status: "Overdue",
    priority: "High",
  },
  {
    id: "task-02",
    title: "Approve Audi A3 preparation estimate",
    linked: "DOS-1039",
    owner: "Tom Harris",
    due: "11:00",
    status: "In progress",
    priority: "High",
  },
  {
    id: "task-03",
    title: "Send Macan shortlist to Harriet",
    linked: "SRC-0238",
    owner: "Tom Harris",
    due: "13:00",
    status: "To do",
    priority: "Normal",
  },
  {
    id: "task-04",
    title: "Check parts delivery for REP-1086",
    linked: "REP-1086",
    owner: "Ben Carter",
    due: "15:30",
    status: "To do",
    priority: "Normal",
  },
  {
    id: "task-05",
    title: "Publish updated summer homepage",
    linked: "Website",
    owner: "Maya Patel",
    due: "Tomorrow",
    status: "To do",
    priority: "Low",
  },
] as const;

export const appointments = [
  {
    id: "apt-01",
    time: "09:00",
    duration: "30 min",
    title: "Repair discussion call",
    customer: "Lucas Green · ML18 JXO",
    staff: "Sarah Reid",
    tone: "blue",
  },
  {
    id: "apt-02",
    time: "10:00",
    duration: "45 min",
    title: "Vehicle viewing",
    customer: "Amelia Wilson · Volvo XC40",
    staff: "Tom Harris",
    tone: "green",
  },
  {
    id: "apt-03",
    time: "11:30",
    duration: "30 min",
    title: "Sourcing requirements",
    customer: "Mia Walker · Audi Q3",
    staff: "Aisha Khan",
    tone: "amber",
  },
  {
    id: "apt-04",
    time: "14:00",
    duration: "60 min",
    title: "Test drive",
    customer: "Oliver Taylor · VW Golf",
    staff: "Aisha Khan",
    tone: "green",
  },
  {
    id: "apt-05",
    time: "15:30",
    duration: "30 min",
    title: "Repair estimate call",
    customer: "James White · KS17 LNV",
    staff: "Sarah Reid",
    tone: "blue",
  },
] as const;

export const activity = [
  {
    actor: "Aisha Khan",
    action: "qualified a lead",
    subject: "Oliver Taylor · Volkswagen Golf",
    time: "8 min ago",
    initials: "AK",
  },
  {
    actor: "Ben Carter",
    action: "updated repair status",
    subject: "REP-1092 · Diagnosing",
    time: "17 min ago",
    initials: "BC",
  },
  {
    actor: "Tom Harris",
    action: "reserved a vehicle",
    subject: "YG70 VHR · Volvo XC40",
    time: "41 min ago",
    initials: "TH",
  },
  {
    actor: "Maya Patel",
    action: "published a website change",
    subject: "Repairs page · v12",
    time: "1 hr ago",
    initials: "MP",
  },
] as const;
