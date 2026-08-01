import localFont from "next/font/local";

export const displayFont = localFont({
  src: [
    { path: "../../../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-cyrillic-600-normal.woff2", weight: "600" },
    { path: "../../../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-cyrillic-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-display",
  display: "swap",
});

export const interfaceFont = localFont({
  src: [
    { path: "../../../../node_modules/@fontsource/onest/files/onest-cyrillic-400-normal.woff2", weight: "400" },
    { path: "../../../../node_modules/@fontsource/onest/files/onest-cyrillic-500-normal.woff2", weight: "500" },
    { path: "../../../../node_modules/@fontsource/onest/files/onest-cyrillic-600-normal.woff2", weight: "600" },
    { path: "../../../../node_modules/@fontsource/onest/files/onest-cyrillic-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-interface",
  display: "swap",
});

export const monoFont = localFont({
  src: [
    { path: "../../../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-400-normal.woff2", weight: "400" },
    { path: "../../../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-500-normal.woff2", weight: "500" },
  ],
  variable: "--font-mono",
  display: "swap",
});
