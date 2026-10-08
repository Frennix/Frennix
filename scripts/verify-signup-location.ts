/**
 * Signup location step — denial, timeout, skip, and manual entry must not freeze onboarding.
 * Run: npm run verify:signup-location
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { signupLocationPrivacy } from "@frennix/api";
import { AsyncTimeoutError, withTimeout } from "../lib/async-timeout";
import {
  applySignupDeviceLocationResult,
  applySignupManualLocation,
  beginSignupDeviceLocationRequest,
  cancelSignupDeviceLocationRequest,
  initialSignupLocationStepState,
  isLocationTimeoutError,
  isPermissionDeniedError,
  LOCATION_STEP_MESSAGES,
  nativeForegroundPermissionAction,
  shouldAttemptDeviceLocationRead,
  skipSignupDeviceLocation,
  type SignupLocationStepState,
  type SignupPlace,
} from "../lib/signup-location-flow";

const ROOT = join(dirname(process.argv[1] ?? process.cwd()), "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

const austin: SignupPlace = {
  city: "Austin",
  state: "TX",
  latitude: 30.2672,
  longitude: -97.7431,
};

function loadingState(): SignupLocationStepState {
  const begun = beginSignupDeviceLocationRequest(initialSignupLocationStepState());
  assert.equal(begun.effect.type, "none");
  assert.equal(begun.state.loading, true);
  return begun.state;
}

const checks: Array<{ name: string; run: () => void | Promise<void> }> = [
  {
    name: "Allow location advances and keeps public city display",
    run: () => {
      const pending = loadingState();
      const granted = applySignupDeviceLocationResult(pending, pending.requestId, {
        status: "granted",
        place: austin,
      });
      assert.equal(granted.effect.type, "advance");
      if (granted.effect.type !== "advance") return;
      assert.equal(granted.effect.place?.city, "Austin");
      assert.equal(granted.effect.devicePermissionDenied, false);
      assert.equal(granted.state.loading, false);
      const privacy = signupLocationPrivacy(granted.effect.place, false);
      assert.equal(privacy.use_location_for_matching, true);
      assert.equal(privacy.location_display_mode, "city_state");
      assert.equal(privacy.show_city_state, true);
      assert.equal(privacy.matching_enabled, true);
      assert.equal(privacy.discovery_explicitly_disabled_at, null);
    },
  },
  {
    name: "Declining device location clears loading and stays retryable",
    run: () => {
      const pending = loadingState();
      const denied = applySignupDeviceLocationResult(pending, pending.requestId, {
        status: "denied",
      });
      assert.equal(denied.effect.type, "device_permission_denied");
      assert.equal(denied.state.loading, false);
      assert.equal(denied.state.choice, "pending");
      assert.equal(denied.state.devicePermissionDenied, true);
      assert.equal(denied.state.error, LOCATION_STEP_MESSAGES.denied);
      assert.equal(denied.state.place, null);
    },
  },
  {
    name: "Previously blocked permission does not start another read",
    run: () => {
      assert.equal(
        shouldAttemptDeviceLocationRead({ rememberedDenial: true, livePermission: "denied" }),
        false
      );
      assert.equal(
        nativeForegroundPermissionAction({ status: "denied", canAskAgain: false }),
        "blocked"
      );
      assert.equal(
        shouldAttemptDeviceLocationRead({ rememberedDenial: true, livePermission: "granted" }),
        true
      );
      assert.equal(
        shouldAttemptDeviceLocationRead({ rememberedDenial: true, livePermission: "prompt" }),
        true
      );
      assert.equal(
        nativeForegroundPermissionAction({ status: "denied", canAskAgain: true }),
        "prompt"
      );
    },
  },
  {
    name: "Unanswered or timed-out lookup clears loading without marking a denial",
    run: () => {
      const pending = loadingState();
      const timedOut = applySignupDeviceLocationResult(pending, pending.requestId, {
        status: "timeout",
        message: LOCATION_STEP_MESSAGES.timeout,
      });
      assert.equal(timedOut.effect.type, "none");
      assert.equal(timedOut.state.loading, false);
      assert.equal(timedOut.state.choice, "pending");
      assert.equal(timedOut.state.devicePermissionDenied, false);
      assert.match(timedOut.state.error, /timed out/i);
      const retry = beginSignupDeviceLocationRequest(timedOut.state);
      assert.equal(retry.state.loading, true);
      assert.equal(retry.state.requestId, pending.requestId + 1);
      assert.equal(retry.state.place, null);
    },
  },
  {
    name: "A hung geolocation promise is bounded by our own timer",
    run: async () => {
      const hanging = new Promise<string>(() => {});
      await assert.rejects(
        () => withTimeout(hanging, 30, "Device location"),
        (error: unknown) => {
          assert.ok(error instanceof AsyncTimeoutError);
          assert.equal(isLocationTimeoutError(error), true);
          assert.equal(isPermissionDeniedError(error), false);
          return true;
        }
      );
    },
  },
  {
    name: "Not Now continues without device location and does not hide the profile",
    run: () => {
      const pending = loadingState();
      const skipped = skipSignupDeviceLocation(pending);
      assert.equal(skipped.effect.type, "advance");
      if (skipped.effect.type !== "advance") return;
      assert.equal(skipped.effect.place, null);
      assert.equal(skipped.effect.devicePermissionDenied, false);
      assert.equal(skipped.state.loading, false);
      assert.equal(skipped.state.choice, "skipped");
      const privacy = signupLocationPrivacy(null, skipped.effect.devicePermissionDenied);
      assert.equal(privacy.use_location_for_matching, false);
      assert.equal(privacy.location_display_mode, "city_state");
      assert.equal(privacy.show_city_state, true);
      assert.equal(privacy.matching_enabled, true);
      assert.equal(privacy.discovery_explicitly_disabled_at, null);
    },
  },
  {
    name: "Manual city after a denial is separate from public location sharing",
    run: () => {
      const pending = loadingState();
      const denied = applySignupDeviceLocationResult(pending, pending.requestId, {
        status: "denied",
      });
      const manual = applySignupManualLocation(denied.state, austin);
      assert.equal(manual.effect.type, "advance");
      if (manual.effect.type !== "advance") return;
      assert.equal(manual.effect.devicePermissionDenied, true);
      assert.equal(manual.effect.place?.city, "Austin");
      assert.equal(manual.state.loading, false);
      const privacy = signupLocationPrivacy(manual.effect.place, true);
      assert.equal(privacy.use_location_for_matching, true);
      assert.equal(privacy.location_display_mode, "city_state");
      assert.notEqual(privacy.location_display_mode, "hidden");
      assert.equal(privacy.matching_enabled, true);
      assert.equal(privacy.discovery_explicitly_disabled_at, null);
    },
  },
  {
    name: "Skip or a newer choice ignores a late location result",
    run: () => {
      const pending = loadingState();
      const requestId = pending.requestId;
      const skipped = skipSignupDeviceLocation(pending);
      const late = applySignupDeviceLocationResult(skipped.state, requestId, {
        status: "granted",
        place: austin,
      });
      assert.equal(late.effect.type, "none");
      assert.equal(late.state, skipped.state);
      assert.equal(late.state.choice, "skipped");
      assert.equal(late.state.place, null);
    },
  },
  {
    name: "Retry does not apply the same grant twice or drop a saved city on failure",
    run: () => {
      const pending = loadingState();
      const granted = applySignupDeviceLocationResult(pending, pending.requestId, {
        status: "granted",
        place: austin,
      });
      const duplicate = applySignupDeviceLocationResult(granted.state, pending.requestId, {
        status: "granted",
        place: austin,
      });
      assert.equal(duplicate.effect.type, "none");
      assert.equal(duplicate.state, granted.state);

      const second = beginSignupDeviceLocationRequest(granted.state);
      const failed = applySignupDeviceLocationResult(second.state, second.state.requestId, {
        status: "unavailable",
        message: LOCATION_STEP_MESSAGES.unavailable,
      });
      assert.equal(failed.effect.type, "none");
      assert.equal(failed.state.place, austin);
      assert.equal(failed.state.loading, false);
      assert.equal(failed.state.devicePermissionDenied, false);
    },
  },
  {
    name: "A second Allow tap while loading does not start another request",
    run: () => {
      const pending = loadingState();
      const again = beginSignupDeviceLocationRequest(pending);
      assert.equal(again.state, pending);
      assert.equal(again.state.requestId, pending.requestId);
    },
  },
  {
    name: "Leaving the step or opening manual entry cancels the in-flight read",
    run: () => {
      const pending = loadingState();
      const cancelled = cancelSignupDeviceLocationRequest(pending);
      assert.equal(cancelled.effect.type, "none");
      assert.equal(cancelled.state.loading, false);
      assert.equal(cancelled.state.choice, "pending");
      const late = applySignupDeviceLocationResult(cancelled.state, pending.requestId, {
        status: "granted",
        place: austin,
      });
      assert.equal(late.effect.type, "none");
      assert.equal(late.state.place, null);
    },
  },
  {
    name: "Permission errors are classified without a GeolocationPositionError global",
    run: () => {
      assert.equal(isPermissionDeniedError({ code: 1 }), true);
      assert.equal(isPermissionDeniedError({ code: "denied" }), true);
      assert.equal(isPermissionDeniedError({ code: 2, message: "Position unavailable" }), false);
      assert.equal(isLocationTimeoutError({ code: 3 }), true);
      assert.equal(isLocationTimeoutError({ name: "AbortError" }), true);
      assert.equal(isPermissionDeniedError(new AsyncTimeoutError("Device location", 30)), false);
    },
  },
  {
    name: "Signup screen creates the account before onboarding, and location retry does not sign up again",
    run: () => {
      const signup = read("app/(auth)/signup.tsx");
      const onboarding = read("app/onboarding.tsx");
      const step = read("components/LocationOnboardingStep.tsx");
      assert.equal(signup.match(/await signUpWithEmail\(/g)?.length, 1);
      assert.match(signup, /router\.replace\("\/onboarding"\)/);
      assert.equal(step.includes("signUpWithEmail"), false);
      assert.equal(step.includes("upsertProfile"), false);
      assert.match(onboarding, /shouldUnregister:\s*false/);
      assert.equal(onboarding.includes("reset("), false);
      assert.match(onboarding, /active=\{step === 0\}/);
      assert.match(onboarding, /setStep\(\(current\) => \(current === 0 \? 1 : current\)\)/);
      assert.equal(step.includes("disabled={loading}"), false);
      assert.equal(step.includes('disabled={state.loading}'), false);
      assert.match(step, /title="Not Now"/);
      assert.match(step, /title="Enter Location Manually"/);
      assert.match(step, /title="Allow Location"/);
      const sheet = read("components/ManualLocationSheet.tsx");
      assert.equal(sheet.includes("disabled={loading}"), false);
      const deviceLocation = read("lib/device-location.ts");
      assert.match(deviceLocation, /withTimeout\(/);
      assert.match(deviceLocation, /shouldAttemptDeviceLocationRead/);
      assert.match(deviceLocation, /nativeForegroundPermissionAction/);
      assert.equal(
        deviceLocation.includes('if (await wasLocationPermissionDenied()) {\n    return { status: "denied" };'),
        false
      );
      const prompt = read("components/LocationDiscoveryPrompt.tsx");
      const manualPrompt = prompt.slice(
        prompt.indexOf('title="Enter Location Manually"'),
        prompt.indexOf('title="Use Existing City"')
      );
      assert.equal(manualPrompt.includes("disabled="), false);
      assert.match(prompt, /<Pressable onPress=\{\(\) => void handleNotNow\(\)\}/);
      const privacy = read("app/privacy-settings.tsx");
      const chooseCity = privacy.slice(
        privacy.indexOf('title="Choose My City"'),
        privacy.indexOf('title="Remove Saved Location"')
      );
      assert.equal(chooseCity.includes("disabled"), false);
    },
  },
];

async function main() {
  let failed = 0;

  for (const check of checks) {
    try {
      await check.run();
      console.log(`PASS  ${check.name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL  ${check.name}`);
      console.error(error instanceof Error ? error.message : error);
    }
  }

  if (failed > 0) {
    console.error(`\n${failed}/${checks.length} signup location checks failed.`);
    process.exit(1);
  }

  console.log(`\n${checks.length}/${checks.length} signup location checks passed.`);
}

void main();
