#!/usr/bin/env node
/** Capture production verification screenshots after challenge invite/share deploy. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs/verification-screenshots");
const baseUrl = process.argv[2] ?? "https://frennix.vercel.app";
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  );

  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.screenshot({
    path: path.join(OUT_DIR, "01-production-login-mobile.png"),
    fullPage: true,
  });

  const bundle = await page.evaluate(() => {
    const script = document.querySelector('script[src*="entry-"]');
    return script?.getAttribute("src") ?? "unknown";
  });

  await page.goto(`${baseUrl}/discover`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(OUT_DIR, "02-production-discover-mobile.png"),
    fullPage: true,
  });

  await browser.close();

  const manifest = {
    capturedAt: new Date().toISOString(),
    baseUrl,
    bundle,
    files: fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png")),
  };
  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
