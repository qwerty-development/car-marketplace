export const getLogoUrl = (make: string, isLightMode: boolean) => {
	const formattedMake = make.toLowerCase().replace(/\s+/g, '-')

	// Handle special cases
      switch (formattedMake) {
        case "range-rover":
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
        default:
          return `https://www.carlogos.org/car-logos/${formattedMake}-logo.png`;
      }
    }