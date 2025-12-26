export const getLogoUrl = (
  make: string | null | undefined,
  isLightMode: boolean,
) => {
  if (!make) return null;

  const formattedMake = make.toLowerCase().trim().replace(/\s+/g, "-");

  // Handle special cases
  switch (formattedMake) {
    case "range-rover":
    case "land-rover":
      return isLightMode
        ? "https://www.carlogos.org/car-logos/land-rover-logo-2020-green.png"
        : "https://www.carlogos.org/car-logos/land-rover-logo.png";
    case "infiniti":
      return "https://www.carlogos.org/car-logos/infiniti-logo.png";
    case "jetour":
      return "https://1000logos.net/wp-content/uploads/2023/12/Jetour-Logo.jpg";
    case "audi":
      return "https://www.freepnglogos.com/uploads/audi-logo-2.png";
    case "nissan":
      return "https://cdn.freebiesupply.com/logos/large/2x/nissan-6-logo-png-transparent.png";
    case "deepal":
      return "https://www.chinacarstrading.com/wp-content/uploads/2023/04/deepal-logo2.png";
    case "denza":
      return "https://upload.wikimedia.org/wikipedia/en/5/5e/Denza_logo.png";
    case "voyah":
      return "https://i0.wp.com/www.caradviser.io/wp-content/uploads/2024/07/VOYAH.png?fit=722%2C722&ssl=1";
    case "rox":
      return "https://contactcars.fra1.cdn.digitaloceanspaces.com/contactcars-production/Images/Large/Makes/f64aa1a8-fb87-4028-b60e-7128f4588f5e_202502061346164286.jpg";
    case "xiaomi":
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Xiaomi_logo_%282021-%29.svg/1024px-Xiaomi_logo_%282021-%29.svg.png";
    case "mercedes":
    case "mercedes-benz":
      return "https://www.carlogos.org/car-logos/mercedes-benz-logo.png";
    case "vw":
    case "volkswagen":
      return "https://www.carlogos.org/car-logos/volkswagen-logo.png";
    case "rolls-royce":
      return "https://www.carlogos.org/car-logos/rolls-royce-logo.png";
    case "aston-martin":
      return "https://www.carlogos.org/car-logos/aston-martin-logo.png";
    case "alfa-romeo":
      return "https://www.carlogos.org/car-logos/alfa-romeo-logo.png";
    case "lamborghini":
      return "https://www.carlogos.org/car-logos/lamborghini-logo.png";
    case "ferrari":
      return "https://www.carlogos.org/car-logos/ferrari-logo.png";
    case "mclaren":
      return "https://www.carlogos.org/car-logos/mclaren-logo.png";
    case "byd":
      return "https://www.carlogos.org/car-logos/byd-logo.png";
    case "mg":
      return "https://www.carlogos.org/car-logos/mg-logo.png";
    case "gac":
      return "https://www.carlogos.org/car-logos/gac-group-logo.png";
    case "geely":
      return "https://www.carlogos.org/car-logos/geely-logo.png";
    case "changan":
      return "https://www.carlogos.org/car-logos/changan-logo.png";
    case "haval":
      return "https://www.carlogos.org/car-logos/haval-logo.png";
    case "gwm":
    case "great-wall":
      return "https://www.carlogos.org/car-logos/great-wall-motors-logo.png";
    case "exeed":
      return "https://www.carlogos.org/car-logos/exeed-logo.png";
    case "hongqi":
      return "https://www.carlogos.org/car-logos/hongqi-logo.png";
    case "tank":
      return "https://www.carlogos.org/car-logos/tank-logo.png";
    case "baic":
      return "https://www.carlogos.org/car-logos/baic-group-logo.png";
    case "bestune":
      return "https://www.carlogos.org/car-logos/bestune-logo.png";
    case "dongfeng":
      return "https://www.carlogos.org/car-logos/dongfeng-logo.png";
    case "foton":
      return "https://www.carlogos.org/car-logos/foton-logo.png";
    case "jac":
      return "https://www.carlogos.org/car-logos/jac-motors-logo.png";
    case "jmc":
      return "https://www.carlogos.org/car-logos/jmc-logo.png";
    case "maxus":
      return "https://www.carlogos.org/car-logos/maxus-logo.png";
    case "soueast":
      return "https://www.carlogos.org/car-logos/soueast-logo.png";
    case "zna":
      return "https://www.carlogos.org/car-logos/zna-logo.png";
    default:
      return `https://www.carlogos.org/car-logos/${formattedMake}-logo.png`;
  }
};
