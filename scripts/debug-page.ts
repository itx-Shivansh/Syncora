import { chromium } from "@playwright/test";

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage();

  page.on("console", (m) => console.log("CONSOLE:", m.type(), m.text()));
  page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

  console.log("Navigating to http://localhost:3001/register...");
  await page.goto("http://localhost:3001/register");
  console.log("Navigated. Waiting 3 seconds...");
  await page.waitForTimeout(3000);

  const disabled = await page.locator('button[type="submit"]').getAttribute("disabled");
  console.log("Button disabled attribute:", disabled);

  await browser.close();
}

main().catch(console.error);
