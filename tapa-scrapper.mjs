// These addresses confuse google
const faultyAddresses = new Set([
  "Caravaca 9 esq. Amparo",
  "Plza. Lavapiés 5",
  "Provisiones 18 esq Mesón de Paredes 76",
]);

// These places have a different name in google
const normalizedPlaceNames = new Map();
normalizedPlaceNames.set("Calvario", "Calvario bar");
normalizedPlaceNames.set("El Jardín De Lavapiés", "El Jardín del Guaje");
normalizedPlaceNames.set("K", "K-Sdal");
normalizedPlaceNames.set("Nuevo Mandela", "Restaurante Mandela África");
normalizedPlaceNames.set("Shapla II", "Shapla Indian Restaurant");

// These places are not available in google or their data is incomplete / irrelevant
const placesToSkip = new Set([
  "K-Sdal",
  "Kebab Lavapiés",
  "Oriental Bar",
  "Raj Puth",
  "Tazim Food",
]);

export async function extractTapas({ context }) {
  const tapapiesPage = await context.newPage();
  await tapapiesPage.goto("https://enlavapies.com/");

  const tapasSection = await tapapiesPage.$("#tapas");
  await tapasSection.scrollIntoViewIfNeeded();

  const tapasData = [];
  let tapas = await tapasSection.$$(".vc_grid-item");

  for (let tapa of tapas) {
    const data = await extractTapaInfo({ tapa, context });
    if (data) {
      tapasData.push(data);
    }
  }

  return tapasData;
}

export async function extractTapaInfo({ tapa, context }) {
  const link = await tapa.$("a");
  const href = await link.getAttribute("href");
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
  return {
    tapa: tapaName,
    description,
    place: normalizedPlaceName,
    image: imageUrl,
    ...googleData,
    ...foodPreferences,
  };
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
  const searchAddress = faultyAddresses.has(filteredAddress)
    ? "lavapies"
    : filteredAddress;

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
  await googleMapsPage
    .locator('[jsaction*="pane.placeActions.share;"]')
    .first()
    .click();

  await googleMapsPage.waitForLoadState("networkidle");

  const shareInput = await googleMapsPage
    .locator('[jsaction*="pane.copyLink.clickInput"]')
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
