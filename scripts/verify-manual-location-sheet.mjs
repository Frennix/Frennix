#!/usr/bin/env node
/**
 * Renders ManualLocationSheet through Metro and toggles closed → open → closed → open.
 * Also types, cancels, saves a city, and opens manual entry after a denied location read.
 * Usage: node scripts/verify-manual-location-sheet.mjs [metroBase]
 */
import { createRequire } from "node:module";
import http from "node:http";
import { pathToFileURL } from "node:url";

const metroBase = (process.argv[2] ?? "http://127.0.0.1:8081").replace(/\/$/, "");
const bundlePath =
  "/scripts/manual-location-sheet-entry.bundle?platform=web&dev=true&hot=false&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable";
const require = createRequire(import.meta.url);

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function probeIosKeyboard(browser, harnessUrl) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const listeners = { resize: new Set(), scroll: new Set() };
    const viewport = {
      offsetTop: 0,
      offsetLeft: 0,
      width: 390,
      height: 800,
      scale: 1,
      addEventListener(type, fn) {
        if (!listeners[type]) listeners[type] = new Set();
        listeners[type].add(fn);
      },
      removeEventListener(type, fn) {
        listeners[type]?.delete(fn);
      },
    };
    window.__FRENNIX_TEST_VV__ = viewport;
    window.__FRENNIX_TEST_VV_LISTENERS__ = listeners;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (url.includes("nominatim.openstreetmap.org")) {
        const parsed = new URL(url);
        const query = parsed.searchParams.get("q") ?? "Austin, Texas";
        const [cityPart, statePart] = query.split(",").map((part) => part.trim());
        return new Response(
          JSON.stringify([{ lat: "30.2672", lon: "-97.7431", address: { city: cityPart || "Austin", state: statePart || "Texas" } }]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(input, init);
    };
    try {
      Object.defineProperty(window, "visualViewport", {
        configurable: true,
        get: () => window.__FRENNIX_TEST_VV__,
      });
    } catch (error) {
      window.__FRENNIX_TEST_VV_ERROR__ = String(error);
    }
  });

  await page.goto(harnessUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#manual-location-harness", { timeout: 60_000 });
  await page.getByText("Open manual sheet", { exact: true }).click();
  await page.getByText("Choose your city").waitFor({ timeout: 10_000 });

  const opened = await page.evaluate(() => {
    const root = document.getElementById("bottom-action-sheet");
    const style = root ? getComputedStyle(root) : null;
    return {
      vvError: window.__FRENNIX_TEST_VV_ERROR__ ?? "",
      position: style?.position ?? "",
      height: root?.getBoundingClientRect().height ?? 0,
      bodyPosition: getComputedStyle(document.body).position,
    };
  });
  let ok = pass("iOS sheet pins to the visual viewport", opened.position === "fixed" && opened.height > 700 && opened.height < 860, opened.vvError);
  ok = pass("Open sheet locks background scrolling", opened.bodyPosition === "fixed") && ok;

  await page.evaluate(() => {
    const viewport = window.__FRENNIX_TEST_VV__;
    viewport.offsetTop = 52;
    viewport.height = 360;
    const listeners = window.__FRENNIX_TEST_VV_LISTENERS__;
    listeners.resize?.forEach((fn) => fn());
    listeners.scroll?.forEach((fn) => fn());
  });
  await page.waitForFunction(() => {
    const root = document.getElementById("bottom-action-sheet");
    if (!root) return false;
    const rect = root.getBoundingClientRect();
    return rect.height < 420 && rect.top > 20;
  });

  const city = page.locator('[data-testid="manual-location-city"]');
  const state = page.locator('[data-testid="manual-location-state"]');
  await city.click();
  await city.fill("Austin");
  await state.click();
  await state.fill("TX");
  await page.waitForTimeout(100);

  const focused = await page.evaluate(() => {
    const root = document.getElementById("bottom-action-sheet");
    const cityField = document.querySelector('[data-testid="manual-location-city"]');
    const stateField = document.querySelector('[data-testid="manual-location-state"]');
    const rootRect = root.getBoundingClientRect();
    const inside = (rect) => rect.height > 0 && rect.top >= rootRect.top - 2 && rect.bottom <= rootRect.bottom + 2;
    const cityRect = cityField.getBoundingClientRect();
    const stateRect = stateField.getBoundingClientRect();
    return {
      cityInside: inside(cityRect),
      stateInside: inside(stateRect),
      cityValue: cityField.value,
      stateValue: stateField.value,
      rootHeight: Math.round(rootRect.height),
      rootTop: Math.round(rootRect.top),
    };
  });
  ok =
    pass(
      "Keyboard viewport keeps City and State inside the sheet",
      focused.cityInside && focused.stateInside && focused.cityValue === "Austin" && focused.stateValue === "TX",
      JSON.stringify(focused)
    ) && ok;

  await page.evaluate(() => {
    const viewport = window.__FRENNIX_TEST_VV__;
    viewport.offsetTop = 0;
    viewport.height = 800;
    const listeners = window.__FRENNIX_TEST_VV_LISTENERS__;
    listeners.resize?.forEach((fn) => fn());
    listeners.scroll?.forEach((fn) => fn());
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.waitForFunction(() => {
    const root = document.getElementById("bottom-action-sheet");
    return root && root.getBoundingClientRect().height > 700 && root.getBoundingClientRect().top < 5;
  });
  ok = pass("Dismissing the keyboard restores the sheet frame", true) && ok;

  await page.getByText("Cancel", { exact: true }).click();
  await page.getByText("Choose your city").waitFor({ state: "hidden", timeout: 10_000 });
  const unlocked = await page.evaluate(() => getComputedStyle(document.body).position !== "fixed");
  ok = pass("Cancel restores background scrolling", unlocked) && ok;

  await page.getByText("Open manual sheet", { exact: true }).click();
  await page.getByText("Choose your city").waitFor({ timeout: 10_000 });
  ok =
    pass(
      "Reopen keeps the typed city",
      (await city.inputValue()) === "Austin" && (await state.inputValue()) === "TX"
    ) && ok;
  await page.getByText("Save location", { exact: true }).click();
  await page.waitForFunction(() => (document.getElementById("saved-city")?.textContent ?? "").includes("Austin"), {
    timeout: 10_000,
  });
  ok = pass("Save still completes after the keyboard frame changes", true) && ok;

  const hookError = errors.some((message) => /Rendered more hooks than during the previous render/i.test(message));
  ok = pass("iOS keyboard path has no hooks-order crash", !hookError, errors.slice(0, 3).join(" | ")) && ok;
  await context.close();
  return ok;
}

async function launchBrowser(chromium) {
  try {
    return await chromium.launch({
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: true,
    });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function main() {
  const bundleResponse = await fetch(`${metroBase}${bundlePath}`);
  const bundleOk = bundleResponse.ok;
  if (!pass("Metro bundles the sheet harness", bundleOk, String(bundleResponse.status))) {
    process.exit(1);
  }

  const playwrightPath = (() => {
    try {
      return require.resolve("playwright-core");
    } catch {
      return "/tmp/pw-signup/node_modules/playwright-core/index.js";
    }
  })();
  const pw = await import(pathToFileURL(playwrightPath).href);
  const { chromium } = pw.default ?? pw;
  const browser = await launchBrowser(chromium);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (url.includes("nominatim.openstreetmap.org")) {
        const parsed = new URL(url);
        const query = parsed.searchParams.get("q") ?? "Austin, Texas";
        const [cityPart, statePart] = query.split(",").map((part) => part.trim());
        return new Response(
          JSON.stringify([
            {
              lat: "30.2672",
              lon: "-97.7431",
              address: { city: cityPart || "Austin", state: statePart || "Texas" },
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(input, init);
    };

    const permissions = navigator.permissions;
    if (permissions) {
      permissions.query = async () => ({ state: "denied", addEventListener() {}, removeEventListener() {} });
    }
    navigator.geolocation.getCurrentPosition = (_success, error) => {
      error?.({ code: 1, message: "User denied Geolocation", PERMISSION_DENIED: 1 });
    };
  });

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Manual location sheet</title>
    <style>html,body,#root{height:100%;margin:0;background:#0A0A0B;color:#fff}</style>
  </head>
  <body>
    <div id="root"></div>
    <script src="${metroBase}${bundlePath}"></script>
  </body>
</html>`;

  const harnessServer = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  });
  await new Promise((resolve) => harnessServer.listen(0, "127.0.0.1", resolve));
  const harnessPort = harnessServer.address().port;

  await page.goto(`http://127.0.0.1:${harnessPort}/`, { waitUntil: "domcontentloaded" });
  const mounted = await page
    .waitForSelector("#manual-location-harness", { timeout: 60_000 })
    .then(() => true)
    .catch(() => false);
  if (!pass("Harness mounts", mounted, errors[0] ?? "")) {
    console.log(errors);
    harnessServer.close();
    await browser.close();
    process.exit(1);
  }

  const cityInputs = () => page.locator('[data-testid="manual-location-city"]');
  const stateInputs = () => page.locator('[data-testid="manual-location-state"]');

  async function openManual() {
    await page.getByText("Open manual sheet", { exact: true }).click();
    await page.getByText("Choose your city").waitFor({ timeout: 10_000 });
  }

  async function closeManual() {
    await page.getByText("Cancel", { exact: true }).click();
    await page.getByText("Choose your city").waitFor({ state: "hidden", timeout: 10_000 });
  }

  let ok = true;
  try {
    await openManual();
    ok = pass("Sheet opens from closed", (await cityInputs().count()) === 1) && ok;
    await cityInputs().fill("Austin");
    await stateInputs().fill("TX");
    ok = pass("City and state accept typing", (await cityInputs().inputValue()) === "Austin" && (await stateInputs().inputValue()) === "TX") && ok;
    await closeManual();
    ok = pass("Cancel closes the sheet", true) && ok;
    ok = pass("Cancel does not save", (await page.locator("#saved-city").innerText()) === "No city saved") && ok;

    await openManual();
    ok =
      pass(
        "Sheet reopens with the typed city",
        (await cityInputs().inputValue()) === "Austin" && (await stateInputs().inputValue()) === "TX"
      ) && ok;
    await page.getByText("Save location", { exact: true }).click();
    await page.getByText("Choose your city").waitFor({ state: "hidden", timeout: 10_000 });
    ok = pass("Saving a city closes the sheet", (await page.locator("#saved-city").innerText()).includes("Austin")) && ok;

    await openManual();
    ok =
      pass(
        "Successful save clears the form before the next open",
        (await cityInputs().inputValue()) === "" && (await stateInputs().inputValue()) === ""
      ) && ok;
    await closeManual();

    await page.getByText("Allow Location", { exact: true }).click();
    await page.getByText("Location access denied. Enter your city manually or continue without location.").waitFor({
      timeout: 10_000,
    });
    ok = pass("Denying location stays on the step", true) && ok;
    await page.getByText("Enter Location Manually", { exact: true }).click();
    await page.getByText("Choose your city").waitFor({ timeout: 10_000 });
    const manualCities = cityInputs();
    await manualCities.last().fill("Seattle");
    await stateInputs().last().fill("WA");
    await page.getByText("Save location", { exact: true }).last().click();
    await page.waitForFunction(
      () => (document.getElementById("onboarding-resolved")?.textContent ?? "").includes("Seattle"),
      { timeout: 10_000 }
    );
    ok = pass("Manual entry works after location is denied", true) && ok;

    await page.getByText("Open post sheet", { exact: true }).click();
    await page.getByText("Like", { exact: true }).waitFor({ timeout: 10_000 });
    ok = pass("Post action sheet opens", true) && ok;
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "Dismiss post actions", exact: true }).click();
    await page.getByText("Like", { exact: true }).waitFor({ state: "hidden", timeout: 10_000 });
    await page.getByText("Open post sheet", { exact: true }).click();
    await page.getByText("Like", { exact: true }).waitFor({ timeout: 10_000 });
    ok = pass("Post action sheet reopens", true) && ok;
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "Dismiss post actions", exact: true }).click();
    await page.getByText("Like", { exact: true }).waitFor({ state: "hidden", timeout: 10_000 });

    await page.getByText("Open discover sheet", { exact: true }).click();
    await page.getByText("Training partner preview").waitFor({ timeout: 10_000 });
    ok = pass("Discover preview sheet opens", true) && ok;
    await page.waitForTimeout(600);
    await page.mouse.click(195, 24);
    await page.getByText("Training partner preview").waitFor({ state: "hidden", timeout: 10_000 });
    await page.getByText("Open discover sheet", { exact: true }).click();
    await page.getByText("Training partner preview").waitFor({ timeout: 10_000 });
    ok = pass("Discover preview sheet reopens", true) && ok;
    await page.waitForTimeout(600);
    await page.mouse.click(195, 24);
    await page.getByText("Training partner preview").waitFor({ state: "hidden", timeout: 10_000 });
  } catch (error) {
    ok = pass("Sheet interactions", false, error instanceof Error ? error.message : String(error)) && ok;
    const text = await page.locator("body").innerText().catch(() => "");
    console.log(text.slice(0, 800));
  }

  const hookError = errors.some((message) => /Rendered more hooks than during the previous render/i.test(message));
  ok = pass("No hooks-order crash", !hookError, hookError ? errors.join(" | ") : "") && ok;
  if (errors.length && !hookError) {
    console.log("pageerrors", errors.slice(0, 6));
  }

  ok = (await probeIosKeyboard(browser, `http://127.0.0.1:${harnessPort}/`)) && ok;

  harnessServer.close();
  await browser.close();
  console.log(`\n=== Manual location sheet: ${ok ? "PASS" : "FAIL"} ===\n`);
  if (!ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
