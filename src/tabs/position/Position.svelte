<script>
  import diff from "microdiff";
  import { onDestroy, onMount } from "svelte";

  import Page from "@/components/Page.svelte";

  import { CONFIGURATOR } from "@/js/configurator.svelte.js";
  import { FC } from "@/js/fc.svelte.js";
  import { GUI } from "@/js/gui.js";
  import { i18n } from "@/js/i18n.js";
  import { MSP } from "@/js/msp.svelte.js";
  import { MSPCodes } from "@/js/msp/MSPCodes.js";
  import { mspHelper } from "@/js/msp/MSPHelper.js";
  import { reinitialiseConnection } from "@/js/serial_backend";

  import EstimatorSettings from "./EstimatorSettings.svelte";
  import FlowAlignment from "./FlowAlignment.svelte";
  import HoldSettings from "./HoldSettings.svelte";
  import LiveAltitude from "./LiveAltitude.svelte";
  import LiveControllers from "./LiveControllers.svelte";
  import LiveHorizontal from "./LiveHorizontal.svelte";
  import LiveSensors from "./LiveSensors.svelte";
  import { AH, POS, has } from "./status.js";

  const POLL_MS = 100; // 10 Hz: the estimator runs at 100 Hz, sensors at 50 Hz
  const HISTORY = 300; // 30 s of altitude history
  const TRAIL = 600; // 60 s of position trail

  let loading = $state(true);
  let initialState;
  let pollTimer = null;
  let polling = false;
  let lastProfile = -1;

  // Bumped after every poll, drives the flow orientation check
  let sampleCount = $state(0);
  // optical_flow_align the firmware runs with (the saved value)
  let activeAlign = $state(0);

  let history = $state({ kf: [], baro: [], gps: [], rf: [], target: [] });
  let trail = $state([]);

  function snapshotState() {
    return $state.snapshot({
      HOLD_PROFILE: FC.HOLD_PROFILE,
      POSITION_CONFIG: FC.POSITION_CONFIG,
    });
  }

  let changes = $derived.by(() => {
    if (!initialState) {
      return [];
    }
    return diff(initialState, snapshotState());
  });
  let showToolbar = $derived(!loading && changes.length > 0);
  let needsReboot = $derived(
    changes.some((c) => c.path[0] === "POSITION_CONFIG"),
  );

  function push(arr, value, max) {
    arr.push(value);
    if (arr.length > max) {
      arr.splice(0, arr.length - max);
    }
  }

  function recordSample() {
    const st = FC.POSITION_STATUS;
    const kfValid = has(st.flags, POS.KF_VALID);

    push(history.kf, kfValid ? st.kfAlt : null, HISTORY);
    push(
      history.baro,
      has(st.flags, POS.HAVE_BARO) ? st.baroMeas - st.baroBias : null,
      HISTORY,
    );
    push(
      history.gps,
      has(st.flags, POS.HAVE_GPS_ALT) ? st.gpsMeas : null,
      HISTORY,
    );
    push(history.rf, has(st.flags, POS.AGL_VALID) ? st.rfMeas : null, HISTORY);
    push(
      history.target,
      has(st.altholdFlags, AH.ENGAGED) && !has(st.altholdFlags, AH.USING_AGL)
        ? st.altholdTarget
        : null,
      HISTORY,
    );

    if (has(st.flags, POS.XY_VALID)) {
      push(trail, { e: st.posEast, n: st.posNorth }, TRAIL);
    }

    sampleCount++;
  }

  async function poll() {
    // Skip a tick rather than queue requests behind a slow link
    if (polling) return;
    polling = true;
    try {
      await MSP.promise(MSPCodes.MSP2_POSITION_STATUS);
      await MSP.promise(MSPCodes.MSP_ATTITUDE);
      recordSample();
    } finally {
      polling = false;
    }
  }

  // Reload the per-profile settings when the pilot switches PID profile,
  // unless there are unsaved edits
  async function checkProfile() {
    await MSP.promise(MSPCodes.MSP_STATUS);
    if (FC.CONFIG.profile !== lastProfile) {
      const holdDirty = changes.some((c) => c.path[0] === "HOLD_PROFILE");
      if (!holdDirty) {
        await MSP.promise(MSPCodes.MSP2_HOLD_PROFILE);
        initialState = snapshotState();
      }
      lastProfile = FC.CONFIG.profile;
    }
  }

  let statusCounter = 0;

  onMount(async () => {
    await MSP.promise(MSPCodes.MSP_STATUS);
    await MSP.promise(MSPCodes.MSP2_POSITION_CONFIG);
    await MSP.promise(MSPCodes.MSP2_HOLD_PROFILE);
    await MSP.promise(MSPCodes.MSP2_POSITION_STATUS);
    lastProfile = FC.CONFIG.profile;
    activeAlign = FC.POSITION_CONFIG.optical_flow_align;

    initialState = snapshotState();
    loading = false;

    pollTimer = setInterval(async () => {
      await poll();
      if (++statusCounter >= 10) {
        statusCounter = 0;
        await checkProfile();
      }
    }, POLL_MS);
  });

  onDestroy(() => {
    clearInterval(pollTimer);
  });

  function clearTrail() {
    trail.length = 0;
  }

  function save(code) {
    return MSP.promise(code, mspHelper.crunch(code));
  }

  export async function onSave() {
    const reboot = needsReboot;
    const holdChanged = changes.some((c) => c.path[0] === "HOLD_PROFILE");

    if (holdChanged) {
      await save(MSPCodes.MSP2_SET_HOLD_PROFILE);
    }
    if (reboot) {
      await save(MSPCodes.MSP2_SET_POSITION_CONFIG);
    }

    await MSP.promise(MSPCodes.MSP_EEPROM_WRITE);
    GUI.log($i18n.t("eepromSaved"));

    if (reboot && !CONFIGURATOR.virtualMode) {
      MSP.send_message(MSPCodes.MSP_SET_REBOOT);
      GUI.log($i18n.t("deviceRebooting"));
      reinitialiseConnection();
    } else {
      initialState = snapshotState();
    }
  }

  export async function onRevert() {
    Object.assign(FC.HOLD_PROFILE, initialState.HOLD_PROFILE);
    Object.assign(FC.POSITION_CONFIG, initialState.POSITION_CONFIG);
  }

  export function isDirty() {
    return changes.length > 0;
  }
</script>

{#snippet header()}
  <h1>{$i18n.t("tabPosition")}</h1>
  <div class="grow"></div>
{/snippet}

{#snippet toolbar()}
  <button class="btn" onclick={onRevert}>{$i18n.t("buttonRevert")}</button>
  <button class="btn" onclick={onSave}>
    {needsReboot ? $i18n.t("buttonSaveReboot") : $i18n.t("buttonSave")}
  </button>
{/snippet}

<Page {header} {loading} toolbar={showToolbar && toolbar}>
  <div class="content">
    <div>
      <LiveSensors />
      <FlowAlignment {sampleCount} {activeAlign} />
      <LiveControllers />
    </div>
    <div>
      <LiveAltitude {history} />
      <LiveHorizontal {trail} onclear={clearTrail} />
    </div>
    <div>
      <HoldSettings />
      <EstimatorSettings />
    </div>
  </div>
</Page>

<style lang="scss">
  .content {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    column-gap: var(--section-gap);
  }

  .grow {
    flex-grow: 1;
  }

  .btn {
    @extend %button;
  }
</style>
