import { CacheManager } from "./cache-manager.mjs";

// Memory cache file
const memoryCacheFilePath = "./cached-memory.json";

// These places have a different name in google
const normalizedPlaceNames = new Map();
normalizedPlaceNames.set("Calvario", "Calvario bar");
normalizedPlaceNames.set("El Jardín De Lavapiés", "El Jardín del Guaje");
normalizedPlaceNames.set(
  "Casa Jaguar Café",
  "Casa Jaguar Café | Mercado San Fernando"
);
normalizedPlaceNames.set(
  "Casa Jaguar Mercado",
  "Casa Jaguar | Mercado de Antón Martín"
);
normalizedPlaceNames.set(
  "Casa María",
  "Casa María - Mercado de Producto Madrid"
);
normalizedPlaceNames.set("Divino", "Divino Madriz");
normalizedPlaceNames.set("Apululu", "ApuLuLu Pizza Bar");
normalizedPlaceNames.set("Nuevo Mandela", "Restaurante Mandela África");
normalizedPlaceNames.set("Shapla II", "Shapla Indian Restaurant");
normalizedPlaceNames.set("Dakar", "Restaurante Dakar");
normalizedPlaceNames.set("K-Sdal", "Ksdal");
normalizedPlaceNames.set("K", "Ksdal");
normalizedPlaceNames.set("Garibaldi", "Taberna Garibaldi");
normalizedPlaceNames.set("Hartem", "Hartem Bar");
normalizedPlaceNames.set("Jam", "Jam taberna");
normalizedPlaceNames.set("La Cucusa", "Taberna La Cucusa");
normalizedPlaceNames.set("Majo’S Food", "Majo’S Food mercado");

// These addresses confuse google
const faultyAddresses = [
  "Caravaca 9 esq. Amparo",
  "Plza. Lavapiés 5",
  "Santa Isabel 5",
  "Embajadores 41",
  "Salitre 38",
  "Ave María 32",
  "Provisiones 18 esq Mesón de Paredes 76",
  "Duque de Rivas 5",
  "Marques de Toca  7",
  "Pasaje Doré 19  P16 -19",
];

// These places are not available in google or their data is incomplete / irrelevant
const placesToSkip = new Set([
  "Kebab Lavapiés",
  "El Rincón De Ruda",
  "Abascal Olmedo",
  "Oriental Bar",
  "Raj Puth",
  "Casa Calores",
  "Tazim Food",
  "La India Tetería",
  "Serendipia",
  "Casino Kebab",
  "Mesón Los Platos"
]);

export async function extractTapas({ context }) {
  const tapapiesPage = await context.newPage();
  await tapapiesPage.goto("https://enlavapies.com/");

  const tapasSection = await tapapiesPage.$("#tapas");
  await tapasSection.scrollIntoViewIfNeeded();

  const tapasData = [];
  let tapas = await tapasSection.$$(".vc_grid-item");
  const cacheManager = new CacheManager(memoryCacheFilePath);

  for (let tapa of tapas) {
    const data = await extractTapaInfo({ tapa, context, cacheManager });
    if (data) {
      tapasData.push(data);
    }
  }

  return tapasData;
}

export async function extractTapaInfo({ tapa, context, cacheManager }) {
  const link = await tapa.$("a");
  const href = await link.getAttribute("href");

  console.log("[Log]: Fetching tapa for", href);

  const storedData = cacheManager.get(href);

  if (storedData) {
    return storedData;
  }

  const tapaDetails = await context.newPage();
  await tapaDetails.goto(href);

  await tapaDetails.waitForLoadState("networkidle");

  const placeAndTapaEl = await tapaDetails.$(".elementor-heading-title");
  const [place, tapaName] = getTapaAndPlace(await placeAndTapaEl.textContent());

  const normalizedPlaceName = normalizedPlaceNames.has(place)
    ? normalizedPlaceNames.get(place)
    : place;

  if (placesToSkip.has(normalizedPlaceName)) {
    await tapaDetails.close();
    return undefined;
  }

  const descriptionEl = await tapaDetails.$(".elementor-widget-container > p");
  const description = await descriptionEl.textContent();

  const image = await tapaDetails.$(".swiper-slide-inner img");
  const imageUrl = await image.getAttribute("src");

  const foodPreferences = await getFoodPreferences(tapaDetails);

  const googleData = await getGoogleData({
    place: normalizedPlaceName,
    tapaDetails,
    context,
  });

  await tapaDetails.close();

  console.log(`[Log]: Data fetched for ${normalizedPlaceName}`);

  const data = {
    tapa: tapaName,
    description,
    place: normalizedPlaceName,
    image: imageUrl,
    ...googleData,
    ...foodPreferences,
  };

  cacheManager.updateKey(href, data);

  return data;
}

function getTapaAndPlace(placeAndTapa) {
  const regex = /(.*?)\s*[-–]\s*(.*)/;
  const matches = placeAndTapa.match(regex);
  if (matches) {
    return [matches[1].trim(), matches[2].trim()];
  } else {
    console.error(`Error: ${placeAndTapa} is not properly formed`);
    return [];
  }
}

// If a tapa is vegetariana / vegana
async function getFoodPreferences(tapaDetails) {
  const hasTag = async (tag) => {
    const tagEl = await tapaDetails.$(`[itemprop='about'] a:text-is("${tag}")`);
    return !!tagEl;
  };

  const isVegetarian = await hasTag("VEGETARIANA");
  const isVegetarianOnDemand = await hasTag("VEGETARIANA BAJO DEMANDA");
  const isVegan = await hasTag("VEGANA");
  const isVeganOnDemand = await hasTag("VEGANA BAJO DEMANDA");

  return {
    isVegetarian,
    isVegetarianOnDemand,
    isVegan,
    isVeganOnDemand,
  };
}

async function getGoogleData({ place, tapaDetails, context }) {
  const googleMapsPage = await context.newPage();

  const addressEl = await tapaDetails.$('[data-id="68a5567f"]');
  const address = await addressEl.textContent();
  // Some tokens confuse google maps
  const filteredAddress = address.trim().replace("MSF", "").replace("MAM", "");
  const searchAddress = faultyAddresses.some((address) =>
    filteredAddress.includes(address)
  )
    ? "lavapies"
    : filteredAddress;

  console.log(`[Log]: Fetching Google data for ${place} ${searchAddress}`);

  await googleMapsPage.goto(
    `https://www.google.com/maps/search/${place} ${searchAddress}`
  );
  await googleMapsPage.waitForLoadState("networkidle");

  const stars = await googleMapsPage
    .locator('[aria-label*="estrellas"][role=img]')
    .first();
  const starLabel = await stars.getAttribute("aria-label");
  const rating = extractNumberFromString(starLabel);

  const completeAddressEl = await googleMapsPage
    .locator('[aria-label*="Dir"] .fontBodyMedium')
    .first();
  const completeAddress = await completeAddressEl.textContent();

  const url = await getPlaceUrl(googleMapsPage);

  await googleMapsPage.close();

  return {
    rating,
    address: completeAddress,
    url,
  };
}

async function getPlaceUrl(googleMapsPage) {
  await googleMapsPage.locator('[data-value*="Compartir"]').first().click();

  await googleMapsPage.waitForLoadState("networkidle");

  const shareInput = await googleMapsPage
    .locator('[value*="https://maps.app.goo.gl"]')
    .first();

  const url = await shareInput.getAttribute("value");

  // Cleanup
  await googleMapsPage
    .locator("[role='dialog'] [jsaction='modal.close']")
    .first()
    .click();

  return url;
}

function extractNumberFromString(inputString) {
  const regex = /(\d[\d,]*)/; // Regular expression to match the number
  const match = inputString.match(regex);
  if (!match) {
    return undefined;
  }
  return match[0].replace(",", ".");
}
