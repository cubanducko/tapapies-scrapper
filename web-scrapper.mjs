import playwright from "playwright";
import { googleCookies } from "./cookies.mjs";
import { extractTapas } from "./tapa-scrapper.mjs";
import fs from "fs";
import path from "path";

async function main() {
  const browser = await playwright.chromium.launch({
    headless: true, // setting this to true will not run the UI
  });

  const context = await browser.newContext({});
  await context.addCookies([...googleCookies]);

  // Extract data
  const tapas = await extractTapas({ context });

  // Cleanup
  await browser.close();

  const jsonData = JSON.stringify(tapas, null, 2);

  const directoryPath = "./database";
  const filePath = path.join(directoryPath, "data.json");

  // Create directory if it does not exist
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }

  try {
    fs.writeFileSync(filePath, jsonData);
    console.log("Tapapies has been fetched, happy tapa-hunt 🚀");
  } catch (err) {
    console.error("Error writing to file:", err);
  }
}

main();
