# Manufacturer brand logos

Drop each manufacturer's official logo file here so the site can display
it wherever a make appears (vehicle cards, search filters, brand chips).

**Naming**: filename must match the brand slug from
`src/lib/data/car-brands.ts`.

- `land-rover.svg`
- `bmw.svg`
- `mercedes-benz.svg`
- `volkswagen.svg`
- `audi.svg`
- `mini.svg`
- `mitsubishi.svg`
- …one per brand

**Format**: prefer `.svg` (crisp at every size, tiny). `.png` also works —
change the extension in the `<BrandLogo>` call site to `"png"`.

**Sizing hints**:
- Aim for a square viewBox (e.g. `0 0 200 200`) or roughly square canvas
  so the logo sits comfortably in a circular badge or 40x40 tile.
- Prefer transparent background — the surrounding tile provides the
  contrast.
- Trim excess whitespace so the mark fills most of the frame.

**Where to source**: most manufacturers publish official press-kit logos
on their corporate site (e.g. `press.<brand>.com`, or the brand-guidelines
PDF). Some brand-portal sites require a login, or provide only a
`.zip` of the identity kit.

**Missing files**: any brand without a logo file falls back to the
coloured monogram badge from `car-brands.ts`, so the UI still looks
complete while you gather the files.
