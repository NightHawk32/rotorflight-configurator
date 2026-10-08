<script>
  import { untrack } from "svelte";

  import Meter from "@/components/Meter.svelte";
  import Section from "@/components/Section.svelte";
  import StepIndicator from "@/components/StepIndicator.svelte";
  import SubSection from "@/components/SubSection.svelte";
  import ErrorNote from "@/components/notes/ErrorNote.svelte";
  import InfoNote from "@/components/notes/InfoNote.svelte";
  import WarningNote from "@/components/notes/WarningNote.svelte";

  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";

  import Readout from "./Readout.svelte";
  import {
    MIN_ROCK_RATE,
    MIN_SLIDE,
    OPTICAL_FLOW_ALIGN,
    Recorder,
    detectAlignment,
    detectGyroComp,
  } from "./flow_align.js";
  import { POS, has } from "./status.js";

  // sampleCount: bumped by the tab after every status poll.
  // activeAlign: optical_flow_align the firmware is running with (the saved
  // value), which the flow in POSITION_STATUS is already rotated by.
  let { sampleCount, activeAlign } = $props();

  const STEPS = [
    "positionFlowAlignStepPrepare",
    "positionFlowAlignStepForward",
    "positionFlowAlignStepRight",
    "positionFlowAlignStepRotate",
    "positionFlowAlignStepResult",
  ];
  const ROTATE_MS = 8000;
  const QUALITY_MIN = 50; // firmware FLOW_QUALITY_MIN
  const COMP_MIN = -200;
  const COMP_MAX = 200;

  let st = $derived(FC.POSITION_STATUS);
  let cfg = $derived(FC.POSITION_CONFIG);

  let flowHealthy = $derived(
    has(st.flags, POS.FLOW) && has(st.flags, POS.FLOW_HEALTHY),
  );
  let unsavedAlign = $derived(cfg.optical_flow_align !== activeAlign);

  let step = $state(1);
  let recording = $state(false);
  let recorder = null;
  let progress = $state({ length: 0, rate: 0, quality: 0, elapsed: 0 });
  let recordStart = 0;
  let dropouts = $state(0);

  let forward = null;
  let right = null;
  let detection = $state(null);
  let gyroFit = $state(null);
  let error = $state(null);
  let lowQuality = $state(null);
  let applied = $state(false);

  // Live direction arrow: flow as the firmware sees it (current setting),
  // scaled by the height when known
  let heightM = $derived(has(st.flags, POS.AGL_VALID) ? st.aglAlt / 100 : 1);
  let liveFwd = $derived(st.flowX * heightM);
  let liveRight = $derived(-st.flowY * heightM);
  const ARROW_RANGE = 100; // cm/s at the edge of the box
  let arrow = $derived.by(() => {
    const k = 45 / ARROW_RANGE;
    return {
      x: 50 + Math.max(-45, Math.min(45, liveRight * k)),
      y: 50 - Math.max(-45, Math.min(45, liveFwd * k)),
    };
  });

  $effect(() => {
    const n = sampleCount;
    untrack(() => onSample(n));
  });

  function onSample(n) {
    if (!recording || n === 0) return;

    if (!flowHealthy) {
      dropouts++;
      return;
    }

    recorder.add({
      t: performance.now(),
      flowX: st.flowX,
      flowY: st.flowY,
      quality: st.flowQuality,
      gyroRoll: st.gyroRoll,
      gyroPitch: st.gyroPitch,
    });

    const elapsed = performance.now() - recordStart;
    progress = {
      length: recorder.length,
      rate: recorder.rmsRate,
      quality: recorder.meanQuality,
      elapsed,
    };

    if (step === 4 && elapsed >= ROTATE_MS) {
      stopRecording();
    }
  }

  function startRecording() {
    error = null;
    lowQuality = null;
    dropouts = 0;
    recorder = new Recorder();
    progress = { length: 0, rate: 0, quality: 0, elapsed: 0 };
    recordStart = performance.now();
    recording = true;
  }

  function stopRecording() {
    recording = false;
    const rec = recorder;

    if (rec.meanQuality <= QUALITY_MIN) {
      lowQuality = Math.round(rec.meanQuality);
    }

    if (step === 2 || step === 3) {
      if (rec.length < MIN_SLIDE) {
        error = "positionFlowAlignErrorTooShort";
        return;
      }
      if (step === 2) {
        forward = [...rec.vector];
        step = 3;
        return;
      }
      right = [...rec.vector];
      const result = detectAlignment(forward, right, activeAlign);
      if (result.error) {
        error = result.error;
        return;
      }
      detection = result;
      step = 4;
      return;
    }

    if (step === 4) {
      if (rec.rmsRate < MIN_ROCK_RATE) {
        error = "positionFlowAlignErrorTooLittleRotation";
        return;
      }
      const usable = rec.samples.filter((s) => s.quality > QUALITY_MIN);
      const fit = detectGyroComp(usable, detection.correction);
      if (fit.error) {
        error = fit.error;
        return;
      }
      gyroFit = fit;
      step = 5;
    }
  }

  function skipRotate() {
    recording = false;
    error = null;
    gyroFit = null;
    step = 5;
  }

  function restart() {
    recording = false;
    forward = null;
    right = null;
    detection = null;
    gyroFit = null;
    error = null;
    lowQuality = null;
    applied = false;
    step = 1;
  }

  function goToStep(n) {
    if (n >= step || recording) return;
    // Earlier steps feed the later ones: going back discards their results
    if (n <= 3) {
      detection = null;
    }
    if (n <= 2) {
      forward = null;
      right = null;
    }
    gyroFit = null;
    error = null;
    applied = false;
    step = n;
  }

  let recommendedComp = $derived(
    gyroFit
      ? Math.max(COMP_MIN, Math.min(COMP_MAX, Math.round(gyroFit.comp)))
      : null,
  );

  // A compensation far from the physical value, or pitch and roll
  // disagreeing, points at a bad recording rather than a real property
  let compSuspicious = $derived(
    gyroFit !== null &&
      (Math.abs(Math.abs(gyroFit.comp) - 100) > 40 ||
        (gyroFit.compPitch !== null &&
          gyroFit.compRoll !== null &&
          Math.abs(gyroFit.compPitch - gyroFit.compRoll) > 50)),
  );

  let alignChanged = $derived(
    detection !== null && detection.align !== activeAlign,
  );
  let compChanged = $derived(
    recommendedComp !== null && recommendedComp !== cfg.flow_gyro_comp,
  );

  function apply() {
    cfg.optical_flow_align = detection.align;
    if (recommendedComp !== null) {
      cfg.flow_gyro_comp = recommendedComp;
    }
    applied = true;
  }

  function fmtDeg(v) {
    return `${v.toFixed(0)}°`;
  }
</script>

<Section label="positionFlowAlign" summary="positionFlowAlignHelp">
  <StepIndicator
    steps={STEPS.map((key) => ({ label: $i18n.t(key) }))}
    current={step}
    onSelect={goToStep}
  />

  <SubSection label="positionFlowDirection">
    <div class="direction">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <rect x="1" y="1" width="98" height="98" class="frame" />
        <line x1="50" y1="5" x2="50" y2="95" class="grid" />
        <line x1="5" y1="50" x2="95" y2="50" class="grid" />
        <text x="52" y="11" class="label">{$i18n.t("positionForward")}</text>
        <text x="72" y="47" class="label">{$i18n.t("positionRight")}</text>
        <line x1="50" y1="50" x2={arrow.x} y2={arrow.y} class="arrow" />
        <circle cx={arrow.x} cy={arrow.y} r="3" class="tip" />
      </svg>
      <div class="direction-text">
        <Readout
          label="positionFlowAlignCurrent"
          value={OPTICAL_FLOW_ALIGN[activeAlign] ?? "-"}
        />
        <Readout
          label="positionFlowQuality"
          value={st.flowQuality}
          state={st.flowQuality > QUALITY_MIN ? "ok" : "warn"}
        />
        <Readout label="positionForward" value={`${liveFwd.toFixed(0)} cm/s`} />
        <Readout label="positionRight" value={`${liveRight.toFixed(0)} cm/s`} />
      </div>
    </div>
  </SubSection>

  <SubSection label={STEPS[step - 1]}>
    <div class="step">
      {#if step === 1}
        <p>{$i18n.t("positionFlowAlignPrepareText")}</p>
        {#if !flowHealthy}
          <WarningNote message="positionFlowAlignNoFlow" />
        {:else if unsavedAlign}
          <WarningNote message="positionFlowAlignUnsaved" />
        {/if}
        <div class="buttons">
          <button
            class="btn-primary"
            disabled={!flowHealthy || unsavedAlign}
            onclick={() => (step = 2)}
          >
            {$i18n.t("positionFlowAlignStart")}
          </button>
        </div>
      {:else if step === 2 || step === 3}
        <p>
          {$i18n.t(
            step === 2
              ? "positionFlowAlignForwardText"
              : "positionFlowAlignRightText",
          )}
        </p>
        <Meter
          title={$i18n.t("positionFlowAlignTravel")}
          leftLabel={`${progress.length.toFixed(0)}`}
          rightLabel={`≥${MIN_SLIDE}`}
          value={Math.min(100, (progress.length / MIN_SLIDE) * 50)}
        />
        <div class="buttons">
          {#if recording}
            <button class="btn-primary" onclick={stopRecording}>
              {$i18n.t("positionFlowAlignStop")}
            </button>
          {:else}
            <button
              class="btn-primary"
              disabled={!flowHealthy}
              onclick={startRecording}
            >
              {$i18n.t(
                error ? "positionFlowAlignRepeat" : "positionFlowAlignRecord",
              )}
            </button>
          {/if}
        </div>
      {:else if step === 4}
        <p>{$i18n.t("positionFlowAlignRotateText")}</p>
        <Meter
          title={$i18n.t("positionFlowAlignRate")}
          leftLabel={`${progress.rate.toFixed(0)} °/s`}
          rightLabel={`≥${MIN_ROCK_RATE} °/s`}
          value={Math.min(100, (progress.rate / MIN_ROCK_RATE) * 50)}
        />
        {#if recording}
          <Meter
            title={$i18n.t("positionFlowAlignRecording")}
            leftLabel={`${Math.max(0, (ROTATE_MS - progress.elapsed) / 1000).toFixed(0)} s`}
            rightLabel=""
            value={(progress.elapsed / ROTATE_MS) * 100}
            compact
          />
        {/if}
        <div class="buttons">
          <button class="btn" disabled={recording} onclick={skipRotate}>
            {$i18n.t("positionFlowAlignSkip")}
          </button>
          <button
            class="btn-primary"
            disabled={recording || !flowHealthy}
            onclick={startRecording}
          >
            {$i18n.t(
              error ? "positionFlowAlignRepeat" : "positionFlowAlignRecord",
            )}
          </button>
        </div>
      {:else}
        <Readout
          label="positionFlowAlignDetected"
          value={OPTICAL_FLOW_ALIGN[detection.align]}
          state={alignChanged ? "warn" : "ok"}
        />
        <Readout
          label="positionFlowAlignAxisError"
          value={`${fmtDeg(detection.forwardError)} / ${fmtDeg(detection.rightError)}`}
        />
        {#if gyroFit}
          <Readout
            label="positionFlowAlignGyroComp"
            value={`${recommendedComp} % (${$i18n.t("positionFlowAlignNow")} ${cfg.flow_gyro_comp} %)`}
            state={compSuspicious ? "warn" : compChanged ? "warn" : "ok"}
          />
          <Readout
            label="positionFlowAlignGyroCompAxes"
            value={`${gyroFit.compPitch?.toFixed(0) ?? "-"} / ${gyroFit.compRoll?.toFixed(0) ?? "-"} %`}
          />
          <Readout
            label="positionFlowAlignResidual"
            value={`${(gyroFit.residual * 100).toFixed(0)} %`}
          />
        {/if}

        {#if applied}
          <InfoNote message="positionFlowAlignApplied" />
        {:else if !alignChanged && !compChanged}
          <InfoNote message="positionFlowAlignCorrect" />
        {/if}
        {#if compSuspicious}
          <WarningNote message="positionFlowAlignCompWarning" />
        {/if}

        <div class="buttons">
          <button class="btn" onclick={restart}>
            {$i18n.t("positionFlowAlignRestart")}
          </button>
          {#if alignChanged || compChanged}
            <button class="btn-primary" disabled={applied} onclick={apply}>
              {$i18n.t("positionFlowAlignApply")}
            </button>
          {/if}
        </div>
      {/if}

      {#if error}
        <ErrorNote message={error} />
      {/if}
      {#if lowQuality !== null}
        <WarningNote>
          {$i18n.t("positionFlowAlignLowQuality", { quality: lowQuality })}
        </WarningNote>
      {/if}
      {#if recording && dropouts > 0}
        <WarningNote message="positionFlowAlignNoFlow" />
      {/if}
    </div>
  </SubSection>
</Section>

<style lang="scss">
  .direction {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 12px;
    align-items: start;
    padding: 0 8px;
  }

  svg {
    width: 140px;
    height: 140px;
  }

  .frame {
    fill: var(--color-surface-sunken);
    stroke: var(--color-border-soft);
  }

  .grid {
    stroke: var(--color-border-soft);
    stroke-width: 0.5;
  }

  .label {
    font-size: 6px;
    fill: var(--color-text-muted);
  }

  .arrow {
    stroke: var(--color-accent-500);
    stroke-width: 2;
  }

  .tip {
    fill: var(--color-accent-500);
  }

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
    .direction {
      grid-template-columns: 1fr;
      justify-items: center;
    }
  }
</style>
