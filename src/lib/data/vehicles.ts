import "server-only";

import { createClient } from "@supabase/supabase-js";

import { isDevelopmentDemoMode } from "@/lib/demo/store";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { log } from "@/lib/security/logger";
import type { PublicVehicle } from "@/lib/types";

export type PublicVehicleImage = {
  url: string;
  alt: string;
};

export type PublicVehicleRecord = PublicVehicle & {
  images: PublicVehicleImage[];
  doors: number;
  seats: number;
  previousOwners: number;
  keys: number;
  ulezCompliant: boolean;
  stockNumber: string;
};

export type VehicleSearchFilters = {
  q?: string;
  make?: string;
  model?: string;
  minPrice?: number;
  maxPrice?: number;
  fuelType?: string;
  transmission?: string;
  bodyType?: string;
  maxMileage?: number;
  minYear?: number;
  availability?: "available" | "reserved" | "coming-soon" | "sold" | "all";
  sort?: "newest" | "price-asc" | "price-desc" | "mileage-asc";
};

const image = (id: string) => {
  void id;
  return "/images/hero-showroom.png";
};

const buildImages = (title: string, ids: string[]): PublicVehicleImage[] =>
  ids.map((id, index) => ({
    url: image(id),
    alt: `${title}${index === 0 ? " exterior" : ` detail view ${index + 1}`}`,
  }));

const demoVehicles: PublicVehicleRecord[] = [
  {
    id: "d0d3d9b0-92d8-4f68-8ef6-000000000001",
    slug: "2022-bmw-320i-m-sport",
    publicTitle: "BMW 3 Series 320i M Sport",
    attentionGrabber: "Technology Pack · Heated seats · Reversing camera",
    make: "BMW",
    model: "3 Series",
    derivative: "320i M Sport",
    year: 2022,
    mileage: 23740,
    fuelType: "Petrol",
    transmission: "Automatic",
    bodyType: "Saloon",
    colour: "Portimao Blue",
    engineSizeCc: 1998,
    price: 27950,
    status: "on_forecourt",
    registrationYear: "2022 (22)",
    serviceHistory: "Full service history",
    warranty: "6 months comprehensive warranty",
    motExpiry: "2027-04-18",
    description:
      "A beautifully presented 3 Series with the balance of comfort, pace and refinement that makes this model such a compelling everyday car. Prepared in our workshop and supplied with a comprehensive handover.",
    features: [
      "M Sport exterior styling",
      "BMW Live Cockpit Professional",
      "Heated front seats",
      "Reversing camera",
      "Apple CarPlay and Android Auto",
      "LED headlights",
      "Front and rear parking sensors",
      "Cruise control",
    ],
    imageUrl: image("photo-1555215695-3004980ad54e"),
    imageAlt: "Blue BMW 3 Series parked outside",
    featured: true,
    createdAt: "2026-07-14T10:00:00.000Z",
    images: buildImages("BMW 3 Series 320i M Sport", [
      "photo-1555215695-3004980ad54e",
      "photo-1618843479313-40f8afb4b4d8",
      "photo-1606664515524-ed2f786a0bd6",
    ]),
    doors: 4,
    seats: 5,
    previousOwners: 1,
    keys: 2,
    ulezCompliant: true,
    stockNumber: "DOS-1042",
  },
  {
    id: "d0d3d9b0-92d8-4f68-8ef6-000000000002",
    slug: "2021-audi-q5-40-tdi-s-line",
    publicTitle: "Audi Q5 40 TDI quattro S line",
    attentionGrabber: "quattro · Virtual Cockpit · Electric tailgate",
    make: "Audi",
    model: "Q5",
    derivative: "40 TDI quattro S line",
    year: 2021,
    mileage: 34120,
    fuelType: "Diesel",
    transmission: "Automatic",
    bodyType: "SUV",
    colour: "Mythos Black",
    engineSizeCc: 1968,
    price: 29995,
    status: "on_forecourt",
    registrationYear: "2021 (71)",
    serviceHistory: "Audi digital service record",
    warranty: "6 months comprehensive warranty",
    motExpiry: "2027-02-02",
    description:
      "A refined and sure-footed premium SUV with a calm, high-quality cabin. This Q5 has been carefully selected, independently inspected and prepared for its next owner.",
    features: [
      "quattro all-wheel drive",
      "Audi Virtual Cockpit",
      "MMI navigation plus",
      "Electric tailgate",
      "Heated front seats",
      "LED headlights",
      "Three-zone climate control",
      "Parking system plus",
    ],
    imageUrl: image("photo-1606664515524-ed2f786a0bd6"),
    imageAlt: "Black Audi SUV on a country road",
    featured: true,
    createdAt: "2026-07-12T09:30:00.000Z",
    images: buildImages("Audi Q5 40 TDI quattro S line", [
      "photo-1606664515524-ed2f786a0bd6",
      "photo-1616422285623-13ff0162193c",
      "photo-1550355291-bbee04a92027",
    ]),
    doors: 5,
    seats: 5,
    previousOwners: 2,
    keys: 2,
    ulezCompliant: true,
    stockNumber: "DOS-1038",
  },
  {
    id: "d0d3d9b0-92d8-4f68-8ef6-000000000003",
    slug: "2020-volkswagen-golf-gti-dsg",
    publicTitle: "Volkswagen Golf GTI DSG",
    attentionGrabber: "Performance Pack · Digital cockpit · Winter Pack",
    make: "Volkswagen",
    model: "Golf",
    derivative: "GTI DSG",
    year: 2020,
    mileage: 38650,
    fuelType: "Petrol",
    transmission: "Automatic",
    bodyType: "Hatchback",
    colour: "Pure White",
    engineSizeCc: 1984,
    price: 22450,
    status: "on_forecourt",
    registrationYear: "2020 (70)",
    serviceHistory: "Full service history",
    warranty: "6 months comprehensive warranty",
    motExpiry: "2027-01-12",
    description:
      "The everyday performance car done properly: quick, composed and practical. This GTI has a strong history, two keys and a particularly desirable specification.",
    features: [
      "GTI Performance Pack",
      "Adaptive cruise control",
      "Digital cockpit",
      "Heated front seats",
      "Discover navigation",
      "LED headlights",
      "Front and rear parking sensors",
      "18-inch alloy wheels",
    ],
    imageUrl: image("photo-1494976388531-d1058494cdd8"),
    imageAlt: "White performance hatchback on the road",
    featured: true,
    createdAt: "2026-07-10T11:45:00.000Z",
    images: buildImages("Volkswagen Golf GTI DSG", [
      "photo-1494976388531-d1058494cdd8",
      "photo-1503376780353-7e6692767b70",
      "photo-1549399542-7e3f8b79c341",
    ]),
    doors: 5,
    seats: 5,
    previousOwners: 2,
    keys: 2,
    ulezCompliant: true,
    stockNumber: "DOS-1035",
  },
  {
    id: "d0d3d9b0-92d8-4f68-8ef6-000000000004",
    slug: "2023-mercedes-benz-a200-amg-line",
    publicTitle: "Mercedes-Benz A 200 AMG Line",
    attentionGrabber: "Premium Plus · Panoramic roof · 360° camera",
    make: "Mercedes-Benz",
    model: "A-Class",
    derivative: "A 200 AMG Line",
    year: 2023,
    mileage: 15680,
    fuelType: "Petrol",
    transmission: "Automatic",
    bodyType: "Hatchback",
    colour: "Mountain Grey",
    engineSizeCc: 1332,
    price: 28995,
    status: "on_forecourt",
    registrationYear: "2023 (73)",
    serviceHistory: "Mercedes-Benz digital service record",
    warranty: "Balance of manufacturer warranty",
    motExpiry: "2026-11-21",
    description:
      "A low-mileage A-Class with a beautifully resolved cabin and an excellent Premium Plus specification. It feels every inch the modern premium hatchback.",
    features: [
      "Premium Plus package",
      "Panoramic glass roof",
      "360-degree camera",
      "Burmester surround sound",
      "Heated front seats",
      "Wireless phone charging",
      "MBUX navigation",
      "Ambient lighting",
    ],
    imageUrl: image("photo-1618843479313-40f8afb4b4d8"),
    imageAlt: "Grey Mercedes-Benz parked in a modern setting",
    featured: true,
    createdAt: "2026-07-08T08:15:00.000Z",
    images: buildImages("Mercedes-Benz A 200 AMG Line", [
      "photo-1618843479313-40f8afb4b4d8",
      "photo-1619767886558-efdc259cde1a",
      "photo-1542362567-b07e54358753",
    ]),
    doors: 5,
    seats: 5,
    previousOwners: 1,
    keys: 2,
    ulezCompliant: true,
    stockNumber: "DOS-1030",
  },
  {
    id: "d0d3d9b0-92d8-4f68-8ef6-000000000005",
    slug: "2022-volvo-xc40-b3-plus",
    publicTitle: "Volvo XC40 B3 Plus",
    attentionGrabber: "Mild hybrid · Google built-in · Heated seats",
    make: "Volvo",
    model: "XC40",
    derivative: "B3 Plus",
    year: 2022,
    mileage: 29190,
    fuelType: "Petrol hybrid",
    transmission: "Automatic",
    bodyType: "SUV",
    colour: "Fjord Blue",
    engineSizeCc: 1969,
    price: 26990,
    status: "on_forecourt",
    registrationYear: "2022 (72)",
    serviceHistory: "Full Volvo service history",
    warranty: "6 months comprehensive warranty",
    motExpiry: "2026-10-03",
    description:
      "Thoughtful Scandinavian design, a reassuring driving position and a flexible interior. This XC40 is an easy car to live with and has been maintained exactly as it should be.",
    features: [
      "Mild-hybrid powertrain",
      "Google Maps and Assistant built in",
      "Heated front seats",
      "Reversing camera",
      "Pilot Assist",
      "Power tailgate",
      "LED headlights",
      "Keyless entry",
    ],
    imageUrl: image("photo-1619767886558-efdc259cde1a"),
    imageAlt: "Blue Volvo SUV in soft evening light",
    featured: false,
    createdAt: "2026-07-06T13:20:00.000Z",
    images: buildImages("Volvo XC40 B3 Plus", [
      "photo-1619767886558-efdc259cde1a",
      "photo-1551830820-330a71b99659",
      "photo-1550355291-bbee04a92027",
    ]),
    doors: 5,
    seats: 5,
    previousOwners: 1,
    keys: 2,
    ulezCompliant: true,
    stockNumber: "DOS-1028",
  },
  {
    id: "d0d3d9b0-92d8-4f68-8ef6-000000000006",
    slug: "2020-land-rover-discovery-sport-r-dynamic",
    publicTitle: "Land Rover Discovery Sport R-Dynamic",
    attentionGrabber: "7 seats · Meridian audio · Fixed panoramic roof",
    make: "Land Rover",
    model: "Discovery Sport",
    derivative: "D200 R-Dynamic SE",
    year: 2020,
    mileage: 47210,
    fuelType: "Diesel",
    transmission: "Automatic",
    bodyType: "SUV",
    colour: "Eiger Grey",
    engineSizeCc: 1998,
    price: 24950,
    status: "on_forecourt",
    registrationYear: "2020 (70)",
    serviceHistory: "Full service history",
    warranty: "6 months comprehensive warranty",
    motExpiry: "2027-03-09",
    description:
      "A handsome and versatile seven-seat Discovery Sport with the specification families genuinely use. Its condition and history reflect careful previous ownership.",
    features: [
      "Seven-seat configuration",
      "Fixed panoramic roof",
      "Meridian sound system",
      "3D surround camera",
      "Heated front seats",
      "Powered tailgate",
      "Terrain Response",
      "Apple CarPlay and Android Auto",
    ],
    imageUrl: image("photo-1551830820-330a71b99659"),
    imageAlt: "Grey Land Rover Discovery Sport on open ground",
    featured: false,
    createdAt: "2026-07-04T10:40:00.000Z",
    images: buildImages("Land Rover Discovery Sport R-Dynamic", [
      "photo-1551830820-330a71b99659",
      "photo-1606664515524-ed2f786a0bd6",
      "photo-1616422285623-13ff0162193c",
    ]),
    doors: 5,
    seats: 7,
    previousOwners: 2,
    keys: 2,
    ulezCompliant: true,
    stockNumber: "DOS-1024",
  },
  {
    id: "d0d3d9b0-92d8-4f68-8ef6-000000000007",
    slug: "2021-toyota-gr-yaris-circuit-pack",
    publicTitle: "Toyota GR Yaris Circuit Pack",
    attentionGrabber: "Circuit Pack · One owner · Full Toyota history",
    make: "Toyota",
    model: "GR Yaris",
    derivative: "Circuit Pack",
    year: 2021,
    mileage: 18240,
    fuelType: "Petrol",
    transmission: "Manual",
    bodyType: "Hatchback",
    colour: "Pure White",
    engineSizeCc: 1618,
    price: 30995,
    status: "on_forecourt",
    registrationYear: "2021 (21)",
    serviceHistory: "Full Toyota service history",
    warranty: "6 months comprehensive warranty",
    motExpiry: "2027-06-14",
    description:
      "A genuinely special homologation-era hot hatch, presented in excellent order with one previous owner and the all-important Circuit Pack. Sensitively owned and properly maintained.",
    features: [
      "Circuit Pack",
      "GR-Four all-wheel drive",
      "Torsen limited-slip differentials",
      "Forged 18-inch alloy wheels",
      "JBL premium audio",
      "Adaptive cruise control",
      "Reversing camera",
      "Heated front seats",
    ],
    imageUrl: image("photo-1503376780353-7e6692767b70"),
    imageAlt: "White performance car driving on a mountain road",
    featured: true,
    createdAt: "2026-07-02T09:05:00.000Z",
    images: buildImages("Toyota GR Yaris Circuit Pack", [
      "photo-1503376780353-7e6692767b70",
      "photo-1494976388531-d1058494cdd8",
      "photo-1583121274602-3e2820c69888",
    ]),
    doors: 3,
    seats: 4,
    previousOwners: 1,
    keys: 2,
    ulezCompliant: true,
    stockNumber: "DOS-1020",
  },
  {
    id: "d0d3d9b0-92d8-4f68-8ef6-000000000008",
    slug: "2023-ford-puma-st-line-x",
    publicTitle: "Ford Puma 1.0 EcoBoost ST-Line X",
    attentionGrabber: "Mild hybrid · B&O audio · Driver Assistance Pack",
    make: "Ford",
    model: "Puma",
    derivative: "1.0 EcoBoost ST-Line X",
    year: 2023,
    mileage: 12780,
    fuelType: "Petrol hybrid",
    transmission: "Manual",
    bodyType: "SUV",
    colour: "Fantastic Red",
    engineSizeCc: 999,
    price: 20995,
    status: "on_forecourt",
    registrationYear: "2023 (23)",
    serviceHistory: "Full Ford service history",
    warranty: "Balance of manufacturer warranty",
    motExpiry: "2026-05-28",
    description:
      "Compact outside, remarkably useful inside and genuinely enjoyable to drive. This low-mileage Puma combines a strong specification with economical mild-hybrid power.",
    features: [
      "Mild-hybrid powertrain",
      "B&O premium audio",
      "Driver Assistance Pack",
      "Heated front seats",
      "Heated steering wheel",
      "Wireless phone charging",
      "Reversing camera",
      "Keyless entry",
    ],
    imageUrl: image("photo-1550355291-bbee04a92027"),
    imageAlt: "Red compact SUV beside a modern building",
    featured: false,
    createdAt: "2026-06-30T14:10:00.000Z",
    images: buildImages("Ford Puma ST-Line X", [
      "photo-1550355291-bbee04a92027",
      "photo-1549399542-7e3f8b79c341",
      "photo-1542362567-b07e54358753",
    ]),
    doors: 5,
    seats: 5,
    previousOwners: 1,
    keys: 2,
    ulezCompliant: true,
    stockNumber: "DOS-1018",
  },
  {
    id: "d0d3d9b0-92d8-4f68-8ef6-000000000009",
    slug: "2021-skoda-octavia-estate-se-l",
    publicTitle: "Škoda Octavia Estate 2.0 TDI SE L",
    attentionGrabber: "Canton audio · Matrix LED · Huge load space",
    make: "Škoda",
    model: "Octavia",
    derivative: "2.0 TDI SE L",
    year: 2021,
    mileage: 51460,
    fuelType: "Diesel",
    transmission: "Automatic",
    bodyType: "Estate",
    colour: "Quartz Grey",
    engineSizeCc: 1968,
    price: 17990,
    status: "on_forecourt",
    registrationYear: "2021 (21)",
    serviceHistory: "Full service history",
    warranty: "6 months comprehensive warranty",
    motExpiry: "2027-05-03",
    description:
      "An exceptionally capable long-distance estate with the comfort and space to make family and business mileage effortless. Clean, well cared for and sensibly specified.",
    features: [
      "Canton premium audio",
      "Matrix LED headlights",
      "Adaptive cruise control",
      "Heated front seats",
      "Virtual cockpit",
      "Electric tailgate",
      "Wireless Apple CarPlay",
      "Front and rear parking sensors",
    ],
    imageUrl: image("photo-1549399542-7e3f8b79c341"),
    imageAlt: "Grey estate car on a quiet road",
    featured: false,
    createdAt: "2026-06-28T08:50:00.000Z",
    images: buildImages("Škoda Octavia Estate 2.0 TDI SE L", [
      "photo-1549399542-7e3f8b79c341",
      "photo-1550355291-bbee04a92027",
      "photo-1494976388531-d1058494cdd8",
    ]),
    doors: 5,
    seats: 5,
    previousOwners: 1,
    keys: 2,
    ulezCompliant: true,
    stockNumber: "DOS-1015",
  },
  {
    id: "d0d3d9b0-92d8-4f68-8ef6-000000000010",
    slug: "2022-nissan-qashqai-tekna",
    publicTitle: "Nissan Qashqai 1.3 DIG-T Tekna",
    attentionGrabber: "Reserved · Glass roof · ProPILOT",
    make: "Nissan",
    model: "Qashqai",
    derivative: "1.3 DIG-T Tekna",
    year: 2022,
    mileage: 24650,
    fuelType: "Petrol hybrid",
    transmission: "Automatic",
    bodyType: "SUV",
    colour: "Pearl Black",
    engineSizeCc: 1332,
    price: 23950,
    status: "reserved",
    registrationYear: "2022 (22)",
    serviceHistory: "Full Nissan service history",
    warranty: "6 months comprehensive warranty",
    motExpiry: "2027-03-22",
    description:
      "A top-specification Qashqai with the technology and practicality that make it such a popular family choice. This vehicle is currently reserved, but similar stock can be sourced.",
    features: [
      "ProPILOT with Navi-link",
      "Panoramic glass roof",
      "Head-up display",
      "Bose premium audio",
      "360-degree camera",
      "Heated front seats",
      "Wireless phone charging",
      "Electric tailgate",
    ],
    imageUrl: image("photo-1616422285623-13ff0162193c"),
    imageAlt: "Black Nissan SUV in a city setting",
    featured: false,
    createdAt: "2026-06-24T12:15:00.000Z",
    images: buildImages("Nissan Qashqai Tekna", [
      "photo-1616422285623-13ff0162193c",
      "photo-1606664515524-ed2f786a0bd6",
      "photo-1551830820-330a71b99659",
    ]),
    doors: 5,
    seats: 5,
    previousOwners: 1,
    keys: 2,
    ulezCompliant: true,
    stockNumber: "DOS-1010",
  },
  {
    id: "d0d3d9b0-92d8-4f68-8ef6-000000000011",
    slug: "2019-mini-cooper-s-exclusive",
    publicTitle: "MINI Hatch Cooper S Exclusive",
    attentionGrabber: "Recently sold · Yours could be next",
    make: "MINI",
    model: "Hatch",
    derivative: "Cooper S Exclusive",
    year: 2019,
    mileage: 32980,
    fuelType: "Petrol",
    transmission: "Automatic",
    bodyType: "Hatchback",
    colour: "British Racing Green",
    engineSizeCc: 1998,
    price: 16995,
    status: "sold",
    registrationYear: "2019 (69)",
    serviceHistory: "Full service history",
    warranty: "Supplied with comprehensive warranty",
    motExpiry: "2026-12-10",
    description:
      "This well-specified Cooper S has now found its next owner. If this is the kind of car you are looking for, tell us your requirements and we will search our trusted network.",
    features: [
      "Exclusive interior",
      "Navigation Plus",
      "Harman Kardon audio",
      "Heated front seats",
      "Reversing camera",
      "LED headlights",
      "Driving modes",
      "18-inch alloy wheels",
    ],
    imageUrl: image("photo-1583121274602-3e2820c69888"),
    imageAlt: "Green MINI hatchback parked beside a building",
    featured: false,
    createdAt: "2026-06-18T10:25:00.000Z",
    images: buildImages("MINI Hatch Cooper S Exclusive", [
      "photo-1583121274602-3e2820c69888",
      "photo-1542362567-b07e54358753",
      "photo-1503376780353-7e6692767b70",
    ]),
    doors: 3,
    seats: 4,
    previousOwners: 2,
    keys: 2,
    ulezCompliant: true,
    stockNumber: "DOS-1006",
  },
  {
    id: "d0d3d9b0-92d8-4f68-8ef6-000000000012",
    slug: "2021-kia-sportage-gt-line",
    publicTitle: "Kia Sportage 1.6 T-GDi GT-Line",
    attentionGrabber: "Coming soon · Heated seats · Reversing camera",
    make: "Kia",
    model: "Sportage",
    derivative: "1.6 T-GDi GT-Line",
    year: 2021,
    mileage: 40420,
    fuelType: "Petrol",
    transmission: "Manual",
    bodyType: "SUV",
    colour: "Lunar Silver",
    engineSizeCc: 1591,
    price: 17495,
    status: "preparation",
    registrationYear: "2021 (21)",
    serviceHistory: "Full Kia service history",
    warranty: "Balance of manufacturer warranty",
    motExpiry: "2027-01-30",
    description:
      "Currently progressing through our inspection and preparation process. Register your interest and we will contact you as soon as it is ready to view.",
    features: [
      "GT-Line styling",
      "Heated front and rear seats",
      "Reversing camera",
      "Satellite navigation",
      "Apple CarPlay and Android Auto",
      "LED daytime running lights",
      "Dual-zone climate control",
      "Cruise control",
    ],
    imageUrl: image("photo-1542362567-b07e54358753"),
    imageAlt: "Silver Kia SUV outside a showroom",
    featured: false,
    createdAt: "2026-06-15T15:30:00.000Z",
    images: buildImages("Kia Sportage GT-Line", [
      "photo-1542362567-b07e54358753",
      "photo-1550355291-bbee04a92027",
      "photo-1606664515524-ed2f786a0bd6",
    ]),
    doors: 5,
    seats: 5,
    previousOwners: 1,
    keys: 2,
    ulezCompliant: true,
    stockNumber: "DOS-1002",
  },
];

function cloneDemoVehicles() {
  return demoVehicles.map((vehicle) => ({
    ...vehicle,
    features: [...vehicle.features],
    images: vehicle.images.map((item) => ({ ...item })),
  }));
}

/**
 * Public-safe vehicle projection.
 *
 * Demo stock is available only in explicit development demo mode. A missing
 * or unavailable production database returns no stock rather than publishing
 * fictional vehicles.
 */
export async function getPublicVehicles(): Promise<PublicVehicleRecord[]> {
  if (!isSupabaseConfigured()) {
    return isDevelopmentDemoMode() ? cloneDemoVehicles() : [];
  }

  try {
    const env = getServerEnv();
    const supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL!,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    let organisationId = env.DEALEROS_PUBLIC_ORGANISATION_ID;
    if (!organisationId) {
      const dealerships = await supabase
        .from("public_dealerships")
        .select("id")
        .limit(2);
      if (dealerships.error) throw dealerships.error;
      if ((dealerships.data ?? []).length !== 1) {
        throw new Error(
          (dealerships.data ?? []).length > 1
            ? "Multiple public dealerships exist. Set DEALEROS_PUBLIC_ORGANISATION_ID."
            : "No public dealership is configured.",
        );
      }
      organisationId = dealerships.data![0]!.id as string;
    }

    const vehicles = await supabase
      .from("public_vehicle_inventory")
      .select("*")
      .eq("organisation_id", organisationId)
      .order("created_at", { ascending: false });
    if (vehicles.error) throw vehicles.error;

    const ids = (vehicles.data ?? []).map((row) => row.id as string);
    const [imageRows, featureRows] =
      ids.length > 0
        ? await Promise.all([
            supabase
              .from("public_vehicle_images")
              .select("*")
              .in("vehicle_id", ids)
              .order("sort_order", { ascending: true }),
            supabase
              .from("public_vehicle_features")
              .select("*")
              .in("vehicle_id", ids)
              .order("sort_order", { ascending: true }),
          ])
        : [{ data: [], error: null }, { data: [], error: null }];
    if (imageRows.error) throw imageRows.error;
    if (featureRows.error) {
      log("warn", "public_inventory.features_unavailable", {
        message: featureRows.error.message,
      });
    }

    return (vehicles.data ?? []).map((row) => {
      const vehicleImages = (imageRows.data ?? [])
        .filter((item) => item.vehicle_id === row.id)
        .map((item) => {
          const url =
            item.external_url ??
            (item.storage_bucket && item.storage_path
              ? supabase.storage
                  .from(item.storage_bucket)
                  .getPublicUrl(item.storage_path).data.publicUrl
              : "/images/hero-showroom.png");
          return {
            url,
            alt:
              item.alt_text ??
              `${row.public_title ?? `${row.make} ${row.model}`} photograph`,
          };
        });
      const relatedFeatures = (featureRows.data ?? [])
        .filter((item) => item.vehicle_id === row.id)
        .map((item) => String(item.name).trim())
        .filter(Boolean);
      const rawVehicleFeatures: unknown[] = Array.isArray(row.features)
        ? (row.features as unknown[])
        : [];
      const safeVehicleFeatures = rawVehicleFeatures
        .filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
        .map((item) => item.trim());
      const features =
        relatedFeatures.length > 0 ? relatedFeatures : safeVehicleFeatures;
      const primaryImage = vehicleImages[0];

      return {
        id: String(row.id),
        slug: String(row.slug),
        publicTitle: String(row.public_title),
        attentionGrabber: row.attention_grabber,
        make: String(row.make),
        model: String(row.model),
        derivative: row.derivative,
        year: Number(row.year),
        mileage: Number(row.mileage),
        fuelType: String(row.fuel_type),
        transmission: String(row.transmission),
        bodyType: row.body_type,
        colour: row.colour,
        engineSizeCc:
          row.engine_size_cc == null ? null : Number(row.engine_size_cc),
        price: Number(row.price),
        status: row.status,
        registrationYear: row.registration_year ?? String(row.year),
        serviceHistory: row.service_history,
        warranty: row.warranty,
        motExpiry: row.mot_expiry,
        description: String(row.description),
        features,
        imageUrl: primaryImage?.url ?? null,
        imageAlt: primaryImage?.alt ?? null,
        featured: Boolean(row.featured),
        createdAt: String(row.created_at),
        images: vehicleImages,
        doors: Number(row.doors ?? 0),
        seats: Number(row.seats ?? 0),
        previousOwners: 0,
        keys: 0,
        ulezCompliant: row.ulez_status === "compliant",
        stockNumber: "",
      } satisfies PublicVehicleRecord;
    });
  } catch (error) {
    log("error", "public_inventory.query_failed", {
      message:
        error instanceof Error
          ? error.message
          : "Unknown public inventory query failure",
    });
    return isDevelopmentDemoMode() ? cloneDemoVehicles() : [];
  }
}

export async function getPublicVehicleBySlug(
  slug: string,
): Promise<PublicVehicleRecord | null> {
  const vehicles = await getPublicVehicles();
  return vehicles.find((vehicle) => vehicle.slug === slug) ?? null;
}

export async function getFeaturedVehicles(limit = 4) {
  const vehicles = await getPublicVehicles();
  return vehicles
    .filter((vehicle) => vehicle.featured && vehicle.status !== "sold")
    .slice(0, limit);
}

export async function getRelatedVehicles(
  vehicle: PublicVehicleRecord,
  limit = 3,
) {
  const vehicles = await getPublicVehicles();
  return vehicles
    .filter(
      (candidate) =>
        candidate.id !== vehicle.id &&
        candidate.status !== "sold" &&
        (candidate.make === vehicle.make ||
          candidate.bodyType === vehicle.bodyType ||
          Math.abs(candidate.price - vehicle.price) <= 8000),
    )
    .slice(0, limit);
}

export function filterPublicVehicles(
  vehicles: PublicVehicleRecord[],
  filters: VehicleSearchFilters,
) {
  const query = filters.q?.trim().toLocaleLowerCase("en-GB");

  const filtered = vehicles.filter((vehicle) => {
    const searchable = [
      vehicle.publicTitle,
      vehicle.make,
      vehicle.model,
      vehicle.derivative,
      vehicle.bodyType,
      vehicle.fuelType,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("en-GB");

    if (query && !searchable.includes(query)) return false;
    if (filters.make && vehicle.make !== filters.make) return false;
    if (filters.model && vehicle.model !== filters.model) return false;
    if (filters.minPrice && vehicle.price < filters.minPrice) return false;
    if (filters.maxPrice && vehicle.price > filters.maxPrice) return false;
    if (filters.fuelType && vehicle.fuelType !== filters.fuelType) return false;
    if (filters.transmission && vehicle.transmission !== filters.transmission) {
      return false;
    }
    if (filters.bodyType && vehicle.bodyType !== filters.bodyType) return false;
    if (filters.maxMileage && vehicle.mileage > filters.maxMileage) return false;
    if (filters.minYear && vehicle.year < filters.minYear) return false;

    if (filters.availability && filters.availability !== "all") {
      const matchesAvailability = {
        available: ["on_forecourt", "ready_for_sale"].includes(vehicle.status),
        reserved: vehicle.status === "reserved",
        "coming-soon": [
          "preparation",
          "photography_required",
          "due_in",
        ].includes(vehicle.status),
        sold: vehicle.status === "sold",
      }[filters.availability];

      if (!matchesAvailability) return false;
    }

    return true;
  });

  return [...filtered].sort((a, b) => {
    switch (filters.sort) {
      case "price-asc":
        return a.price - b.price;
      case "price-desc":
        return b.price - a.price;
      case "mileage-asc":
        return a.mileage - b.mileage;
      case "newest":
      default:
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    }
  });
}

export function getVehicleFilterOptions(vehicles: PublicVehicleRecord[]) {
  const unique = (values: Array<string | null>) =>
    [...new Set(values.filter((value): value is string => Boolean(value)))].sort(
      (a, b) => a.localeCompare(b, "en-GB"),
    );

  return {
    makes: unique(vehicles.map((vehicle) => vehicle.make)),
    models: unique(vehicles.map((vehicle) => vehicle.model)),
    fuelTypes: unique(vehicles.map((vehicle) => vehicle.fuelType)),
    transmissions: unique(vehicles.map((vehicle) => vehicle.transmission)),
    bodyTypes: unique(vehicles.map((vehicle) => vehicle.bodyType)),
  };
}

export function getVehiclePresentation(vehicle: PublicVehicleRecord) {
  switch (vehicle.status) {
    case "reserved":
      return { label: "Reserved", tone: "warning" as const };
    case "sold":
      return { label: "Recently sold", tone: "default" as const };
    case "preparation":
    case "photography_required":
    case "due_in":
      return { label: "Coming soon", tone: "info" as const };
    default:
      return { label: "Available", tone: "success" as const };
  }
}
