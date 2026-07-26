export type CarBrand = {
  slug: string;
  name: string;
  monogram: string;
  colour: string;
  ink: "light" | "dark";
};

// The BrandLogo component looks for an SVG at this path. Drop the
// manufacturer's official logo file at /public/images/brands/<slug>.svg
// (or .png) and it will replace the monogram fallback automatically.
export function brandLogoPath(slug: string, ext: "svg" | "png" = "svg") {
  return `/images/brands/${slug}.${ext}`;
}

// Common UK-market car brands. Colours are the manufacturer's signature tone,
// used to accent our own monogram tiles — not an attempt to reproduce the
// trademarked logo.
export const carBrands: CarBrand[] = [
  { slug: "abarth", name: "Abarth", monogram: "A", colour: "#B32126", ink: "light" },
  { slug: "alfa-romeo", name: "Alfa Romeo", monogram: "AR", colour: "#8B1A1F", ink: "light" },
  { slug: "audi", name: "Audi", monogram: "A", colour: "#111214", ink: "light" },
  { slug: "bmw", name: "BMW", monogram: "BMW", colour: "#1E4B85", ink: "light" },
  { slug: "chevrolet", name: "Chevrolet", monogram: "C", colour: "#C68E2A", ink: "dark" },
  { slug: "chrysler", name: "Chrysler", monogram: "C", colour: "#1F2A44", ink: "light" },
  { slug: "citroen", name: "Citroën", monogram: "C", colour: "#B31B23", ink: "light" },
  { slug: "cupra", name: "Cupra", monogram: "C", colour: "#4C5B60", ink: "light" },
  { slug: "dacia", name: "Dacia", monogram: "D", colour: "#164A99", ink: "light" },
  { slug: "ds", name: "DS", monogram: "DS", colour: "#7F5539", ink: "light" },
  { slug: "fiat", name: "Fiat", monogram: "F", colour: "#B31B23", ink: "light" },
  { slug: "ford", name: "Ford", monogram: "F", colour: "#003478", ink: "light" },
  { slug: "genesis", name: "Genesis", monogram: "G", colour: "#111111", ink: "light" },
  { slug: "honda", name: "Honda", monogram: "H", colour: "#CC0000", ink: "light" },
  { slug: "hyundai", name: "Hyundai", monogram: "H", colour: "#002C5F", ink: "light" },
  { slug: "infiniti", name: "Infiniti", monogram: "I", colour: "#131E29", ink: "light" },
  { slug: "jaguar", name: "Jaguar", monogram: "J", colour: "#1B3A2F", ink: "light" },
  { slug: "jeep", name: "Jeep", monogram: "J", colour: "#3F5D2E", ink: "light" },
  { slug: "kia", name: "Kia", monogram: "K", colour: "#05141F", ink: "light" },
  { slug: "land-rover", name: "Land Rover", monogram: "LR", colour: "#0F4D2E", ink: "light" },
  { slug: "lexus", name: "Lexus", monogram: "L", colour: "#1A1A1A", ink: "light" },
  { slug: "mazda", name: "Mazda", monogram: "M", colour: "#7B1015", ink: "light" },
  { slug: "mercedes-benz", name: "Mercedes-Benz", monogram: "MB", colour: "#0D0D0D", ink: "light" },
  { slug: "mg", name: "MG", monogram: "MG", colour: "#B31B23", ink: "light" },
  { slug: "mini", name: "MINI", monogram: "M", colour: "#0F1216", ink: "light" },
  { slug: "mitsubishi", name: "Mitsubishi", monogram: "M", colour: "#B31B23", ink: "light" },
  { slug: "nissan", name: "Nissan", monogram: "N", colour: "#B31B23", ink: "light" },
  { slug: "peugeot", name: "Peugeot", monogram: "P", colour: "#1B2C56", ink: "light" },
  { slug: "porsche", name: "Porsche", monogram: "P", colour: "#0F0F0F", ink: "light" },
  { slug: "renault", name: "Renault", monogram: "R", colour: "#111214", ink: "light" },
  { slug: "seat", name: "SEAT", monogram: "S", colour: "#B54A0A", ink: "light" },
  { slug: "skoda", name: "Škoda", monogram: "S", colour: "#2A6C33", ink: "light" },
  { slug: "smart", name: "Smart", monogram: "S", colour: "#B0A24A", ink: "dark" },
  { slug: "ssangyong", name: "SsangYong", monogram: "S", colour: "#274A80", ink: "light" },
  { slug: "subaru", name: "Subaru", monogram: "S", colour: "#0B3D91", ink: "light" },
  { slug: "suzuki", name: "Suzuki", monogram: "S", colour: "#005EB8", ink: "light" },
  { slug: "tesla", name: "Tesla", monogram: "T", colour: "#B31B23", ink: "light" },
  { slug: "toyota", name: "Toyota", monogram: "T", colour: "#B31B23", ink: "light" },
  { slug: "vauxhall", name: "Vauxhall", monogram: "V", colour: "#B31B23", ink: "light" },
  { slug: "volkswagen", name: "Volkswagen", monogram: "VW", colour: "#001E50", ink: "light" },
  { slug: "volvo", name: "Volvo", monogram: "V", colour: "#003057", ink: "light" },
];

const nameToBrand = new Map<string, CarBrand>();
for (const brand of carBrands) {
  nameToBrand.set(brand.name.toLowerCase(), brand);
  nameToBrand.set(brand.slug, brand);
}
// Handful of common aliases we might see in stock data
nameToBrand.set("mercedes", nameToBrand.get("mercedes-benz")!);
nameToBrand.set("vw", nameToBrand.get("volkswagen")!);
nameToBrand.set("range rover", nameToBrand.get("land-rover")!);

export function findBrand(name: string | null | undefined): CarBrand | null {
  if (!name) return null;
  return nameToBrand.get(name.trim().toLowerCase()) ?? null;
}
