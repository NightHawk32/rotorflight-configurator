<script>
  import { onDestroy, onMount } from "svelte";

  import Meter from "@/components/Meter.svelte";
  import Section from "@/components/Section.svelte";
  import StepIndicator from "@/components/StepIndicator.svelte";
  import SubSection from "@/components/SubSection.svelte";
  import ErrorNote from "@/components/notes/ErrorNote.svelte";
  import InfoNote from "@/components/notes/InfoNote.svelte";
  import WarningNote from "@/components/notes/WarningNote.svelte";

  import { FC } from "@/js/fc.svelte.js";
  import { GUI } from "@/js/gui.js";
  import { i18n } from "@/js/i18n.js";
  import { MSP } from "@/js/msp.svelte.js";
  import { MSPCodes } from "@/js/msp/MSPCodes.js";
  import { have_sensor } from "@/js/serial_backend.js";

  import Readout from "./Readout.svelte";
  import {
    CAL_DURATION_MS,
    MagCalRecorder,
    POLES,
    POLE_REACHED,
    calQuality,
  } from "./mag_cal.js";

  // Guided compass calibration. The firmware does the calibration itself
  // (MSP_MAG_CALIBRATION: 30 s of min/max per axis, then it saves the
  // offsets); this card reads the same compass samples, shows which
  // orientations are still missing and rates the result.

  const STEPS = [
    "positionMagStepPrepare",
    "positionMagStepCalibrate",
    "positionMagStepResult",
  ];
  const PHASE_MS = CAL_DURATION_MS / POLES.length;
  const ARMING_DISABLED_CALIBRATING = 1 << 12;
  const MSP_MAG_SCALE = 1090; // MSPHelper divides MSP_RAW_IMU mag by this
  const START_GRACE_MS = 300; // first samples may still carry the old offsets
  const START_TIMEOUT_MS = 2500;
  const DOTS = 400;

  let step = $state(1);
  let error = $state(null);

  let hasMag = $derived(have_sensor(FC.CONFIG.activeSensors, "mag"));
  let calibrating = $derived(
    (FC.CONFIG.armingDisableFlags & ARMING_DISABLED_CALIBRATING) !== 0,
  );

  // Live compass vector (firmware units, offsets applied)
  let mag = $state([0, 0, 0]);
  let lastChange = $state(0);
  let now = $state(performance.now());
  let magLive = $derived(
    hasMag && now - lastChange < 2000 && mag.some((v) => v !== 0),
  );
  let fieldNow = $derived(Math.hypot(...mag));
  let heading = $derived(FC.SENSOR_DATA.kinematics[2]);

  // Calibration run
  let running = false;
  let startTime = 0;
  let seenCalibrating = false;
  let recorder = null;
  let elapsed = $state(0);
  let analysis = $state(null);
  let dots = $state([]);
  let result = $state(null);
  let quality = $state(null);
  let offsets = $state(null);

  let phase = $derived(
    Math.min(POLES.length - 1, Math.floor(elapsed / PHASE_MS)),
  );
  let phaseLeft = $derived(
    Math.max(0, Math.ceil((PHASE_MS - (elapsed % PHASE_MS)) / 1000)),
  );
  let missing = $derived(
    analysis ? POLES.filter((_, i) => analysis.poles[i] < POLE_REACHED) : POLES,
  );

  let timer = null;
  let busy = false;

  async function tick() {
    if (busy) return;
    busy = true;
    try {
      now = performance.now();
      if (!hasMag) return;
      await MSP.promise(MSPCodes.MSP_RAW_IMU);
      const v = FC.SENSOR_DATA.magnetometer.map((x) =>
        Math.round(x * MSP_MAG_SCALE),
      );
      if (v.some((x, i) => x !== mag[i])) {
        lastChange = performance.now();
      }
      mag = v;
      if (running) {
        await MSP.promise(MSPCodes.MSP_STATUS);
        onCalSample(v);
      }
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    // 10 Hz, the rate of the firmware's compass task
    timer = setInterval(tick, 100);
  });

  onDestroy(() => {
    clearInterval(timer);
    running = false;
  });

  function onCalSample(v) {
    const t = performance.now() - startTime;
    elapsed = Math.min(t, CAL_DURATION_MS);
    if (calibrating) seenCalibrating = true;

    if (!seenCalibrating && t > START_TIMEOUT_MS) {
      running = false;
      error = "positionMagErrorNoStart";
      step = 1;
      return;
    }
    if (t > START_GRACE_MS && t < CAL_DURATION_MS) {
      recorder.add(v);
      if (recorder.length % 5 === 0) {
        analysis = recorder.analyse();
        updateDots();
      }
    }
    // The firmware clears CALIBRATING once it has saved the offsets
    if (
      (seenCalibrating && !calibrating && t > CAL_DURATION_MS) ||
      t > CAL_DURATION_MS + 3000
    ) {
      finish();
    }
  }

  function updateDots() {
    const c = analysis?.centre ?? recorder.firmwareOffsets;
    const r = analysis?.radius ?? 1;
    const s = recorder.samples;
    const from = Math.max(0, s.length - DOTS);
    dots = s.slice(from).map((v) => v.map((x, i) => (x - c[i]) / r));
  }

  async function start() {
    error = null;
    result = null;
    analysis = null;
    dots = [];
    elapsed = 0;
    recorder = new MagCalRecorder();
    seenCalibrating = false;
    await MSP.promise(MSPCodes.MSP_MAG_CALIBRATION);
    GUI.log($i18n.t("initialSetupMagCalibStarted"));
    startTime = performance.now();
    running = true;
    step = 2;
  }

  function finish() {
    running = false;
    analysis = recorder.analyse();
    updateDots();
    result = analysis;
    quality = calQuality(result);
    offsets = recorder.firmwareOffsets;
    GUI.log($i18n.t("initialSetupMagCalibEnded"));
    step = 3;
  }

  function cancel() {
    // The firmware keeps calibrating for the rest of its 30 s and saves
    // whatever it collected; repeat the calibration afterwards.
    running = false;
    error = "positionMagErrorCancelled";
    step = 1;
  }

  function goToStep(n) {
    if (n >= step || running) return;
    step = n;
  }

  // Pictogram of the current phase: a heli in side view (nose left) or, for
  // the roll phases, seen from the front (its left side on the right).
  const PHASE_VIEW = [
    { view: "side", transform: "" },
    { view: "side", transform: "rotate(-90 50 50)" },
    { view: "side", transform: "rotate(90 50 50)" },
    { view: "front", transform: "rotate(90 50 50)" },
    { view: "front", transform: "rotate(-90 50 50)" },
    { view: "side", transform: "translate(0 100) scale(1 -1)" },
  ];

  // Projections of the samples (body frame x forward, y left, z up), drawn
  // the way the pictogram shows the heli: from above with the nose up, from
  // its left side with the nose left, and from the front (its left on the
  // right).
  const VIEWS = [
    { label: "positionMagViewTop", h: (d) => -d[1], v: (d) => d[0] },
    { label: "positionMagViewSide", h: (d) => -d[0], v: (d) => d[2] },
    { label: "positionMagViewFront", h: (d) => d[1], v: (d) => d[2] },
  ];

  function pct(v) {
    return `${Math.round(v * 100)}%`;
  }

  function fmtOffsets(o) {
    return o ? o.join(" / ") : "-";
  }

  const QUALITY_TEXT = {
    ok: "positionMagQualityGood",
    warn: "positionMagQualityFair",
    bad: "positionMagQualityPoor",
  };
</script>

<Section label="positionMag" summary="positionMagHelp">
  <StepIndicator
    steps={STEPS.map((key) => ({ label: $i18n.t(key) }))}
    current={step}
    onSelect={goToStep}
  />

  <SubSection label="positionMagLive">
    <Readout
      label="positionMagSensor"
      value={!hasMag
        ? $i18n.t("positionMagNone")
        : magLive
          ? $i18n.t("positionMagLiveOk")
          : $i18n.t("positionMagStale")}
      state={magLive ? "ok" : "bad"}
    />
    <Readout label="positionMagVector" value={mag.join(" / ")} />
    <Readout label="positionMagField" value={fieldNow.toFixed(0)} />
    <Readout label="positionMagHeading" value={`${heading}°`} />
  </SubSection>

  <SubSection label={STEPS[step - 1]}>
    <div class="step">
      {#if step === 1}
        <p>{$i18n.t("positionMagPrepareText")}</p>
        {#if !hasMag}
          <WarningNote message="positionMagNoCompass" />
        {:else if !magLive}
          <WarningNote message="positionMagNoData" />
        {:else if calibrating}
          <WarningNote message="positionMagGyroCalibrating" />
        {/if}
        <div class="buttons">
          <button
            class="btn-primary"
            disabled={!magLive || calibrating}
            onclick={start}
          >
            {$i18n.t("positionMagStart")}
          </button>
        </div>
      {:else if step === 2}
        <div class="guide">
          <svg viewBox="0 0 100 100" class="pictogram" aria-hidden="true">
            <rect x="1" y="1" width="98" height="98" class="frame" />
            <line x1="6" y1="94" x2="94" y2="94" class="ground" />
            <g transform={PHASE_VIEW[phase].transform}>
              {#if PHASE_VIEW[phase].view === "side"}
                <line x1="14" y1="34" x2="74" y2="34" class="rotor" />
                <line x1="44" y1="34" x2="44" y2="43" class="heli" />
                <ellipse cx="42" cy="51" rx="18" ry="9" class="body" />
                <circle cx="29" cy="49" r="3" class="nose" />
                <line x1="59" y1="50" x2="88" y2="47" class="heli" />
                <line x1="88" y1="47" x2="91" y2="39" class="heli" />
                <line x1="34" y1="60" x2="32" y2="67" class="heli" />
                <line x1="51" y1="60" x2="53" y2="67" class="heli" />
                <line x1="26" y1="67" x2="60" y2="67" class="heli" />
              {:else}
                <line x1="15" y1="34" x2="85" y2="34" class="rotor" />
                <line x1="50" y1="34" x2="50" y2="42" class="heli" />
                <circle cx="50" cy="51" r="10" class="body" />
                <circle cx="62" cy="51" r="2.5" class="left" />
                <line x1="44" y1="60" x2="39" y2="67" class="heli" />
                <line x1="56" y1="60" x2="61" y2="67" class="heli" />
                <line x1="34" y1="67" x2="44" y2="67" class="heli" />
                <line x1="56" y1="67" x2="66" y2="67" class="heli" />
              {/if}
            </g>
            <path d="M 80 14 A 8 4 0 1 1 72 14" class="turn" />
            <path d="M 72 14 l 3 -2.5 M 72 14 l 3.4 2" class="turn" />
          </svg>
          <div class="guide-text">
            <div class="phase">
              {$i18n.t("positionMagPhase", {
                n: phase + 1,
                count: POLES.length,
              })}
              <span class="left">{phaseLeft} s</span>
            </div>
            <p class="instruction">{$i18n.t(POLES[phase].key)}</p>
            <p>{$i18n.t("positionMagTurnText")}</p>
          </div>
        </div>

        <Meter
          title={$i18n.t("positionMagTime")}
          leftLabel={`${Math.floor(elapsed / 1000)} s`}
          rightLabel={`${CAL_DURATION_MS / 1000} s`}
          value={(elapsed / CAL_DURATION_MS) * 100}
        />

        {@render coverage()}

        <div class="buttons">
          <button class="btn" onclick={cancel}
            >{$i18n.t("positionMagCancel")}</button
          >
        </div>
      {:else}
        <Readout
          label="positionMagQuality"
          value={$i18n.t(QUALITY_TEXT[quality])}
          state={quality}
        />
        <Readout label="positionMagOffsets" value={fmtOffsets(offsets)} />
        {#if result}
          <Readout label="positionMagRadius" value={result.radius.toFixed(0)} />
          <Readout
            label="positionMagCentreError"
            value={`${result.centreError.toFixed(1)}%`}
            state={result.centreError < 10
              ? "ok"
              : result.centreError < 20
                ? "warn"
                : "bad"}
          />
          <Readout
            label="positionMagSpread"
            value={`${result.spread.toFixed(1)}%`}
            state={result.spread < 10
              ? "ok"
              : result.spread < 20
                ? "warn"
                : "bad"}
          />
          <Readout
            label="positionMagFieldCheck"
            value={`${fieldNow.toFixed(0)} / ${result.radius.toFixed(0)}`}
            state={Math.abs(fieldNow / result.radius - 1) < 0.15
              ? "ok"
              : "warn"}
          />
        {/if}

        {@render coverage()}

        {#if quality === "ok"}
          <InfoNote message="positionMagSaved" />
        {:else}
          <WarningNote>
            {$i18n.t("positionMagRepeat", {
              missing: missing.map((p) => $i18n.t(p.key)).join("; ") || "-",
            })}
          </WarningNote>
        {/if}
        <InfoNote message="positionMagHeadingCheck" />

        <div class="buttons">
          <button class="btn" onclick={() => (step = 1)}>
            {$i18n.t("positionMagRestart")}
          </button>
        </div>
      {/if}

      {#if error}
        <ErrorNote message={error} />
      {/if}
    </div>
  </SubSection>
</Section>

{#snippet coverage()}
  <div class="coverage">
    <svg viewBox="0 0 186 64" class="projections" aria-hidden="true">
      {#each VIEWS as view, k (view.label)}
        <g transform={`translate(${k * 62 + 31} 33)`}>
          <circle r="27" class="sphere" />
          <line x1="-27" y1="0" x2="27" y2="0" class="grid" />
          <line x1="0" y1="-27" x2="0" y2="27" class="grid" />
          {#each dots as d, i (i)}
            <circle
              cx={view.h(d) * 25}
              cy={-view.v(d) * 25}
              r="0.9"
              class="dot"
            />
          {/each}
          <text x="0" y="-28" class="label">{$i18n.t(view.label)}</text>
        </g>
      {/each}
    </svg>
    <div class="poles">
      {#each POLES as p, i (p.key)}
        <Meter
          compact
          title={$i18n.t(p.key)}
          leftLabel=""
          rightLabel={analysis ? pct(analysis.poles[i]) : "-"}
          value={analysis ? (analysis.poles[i] / POLE_REACHED) * 100 : 0}
        />
      {/each}
    </div>
  </div>
{/snippet}

<style lang="scss">
  .step {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 8px;

    p {
      margin: 0;
      font-size: 0.82rem;
      line-height: 1.5;
      color: var(--color-text-soft);
    }
  }

  .guide {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 12px;
    align-items: start;
  }

  .pictogram {
    width: 120px;
    height: 120px;
  }

  .guide-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .phase {
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
    color: var(--color-text-muted);

    .left {
      font-variant-numeric: tabular-nums;
    }
  }

  .step .instruction {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .frame {
    fill: var(--color-surface-sunken);
    stroke: var(--color-border-soft);
  }

  .ground {
    stroke: var(--color-text-muted);
    stroke-width: 1.5;
    stroke-dasharray: 3 2;
  }

  .heli,
  .rotor {
    stroke: var(--color-text);
    stroke-width: 2;
    stroke-linecap: round;
  }

  .rotor {
    stroke-width: 1.5;
  }

  .body {
    fill: var(--color-surface);
    stroke: var(--color-text);
    stroke-width: 2;
  }

  .nose,
  .left {
    fill: var(--color-accent-500);
  }

  .turn {
    fill: none;
    stroke: var(--color-accent-500);
    stroke-width: 1.5;
    stroke-linecap: round;
  }

  .coverage {
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .projections {
    width: 100%;
    max-width: 372px;
  }

  .sphere {
    fill: var(--color-surface-sunken);
    stroke: var(--color-border-soft);
  }

  .grid {
    stroke: var(--color-border-soft);
    stroke-width: 0.4;
  }

  .dot {
    fill: var(--color-accent-500);
  }

  .label {
    font-size: 5px;
    text-anchor: middle;
    fill: var(--color-text-muted);
  }

  .poles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 12px;
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .btn {
    @extend %button;
  }

  .btn-primary {
    @extend %button-primary;
  }

  @media only screen and (max-width: 480px) {
    .guide {
      grid-template-columns: 1fr;
      justify-items: center;
    }

    .poles {
      grid-template-columns: 1fr;
    }
  }
</style>
