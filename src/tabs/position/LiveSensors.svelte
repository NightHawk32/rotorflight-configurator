<script>
  import Meter from "@/components/Meter.svelte";
  import Section from "@/components/Section.svelte";
  import SubSection from "@/components/SubSection.svelte";

  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";

  import Readout from "./Readout.svelte";
  import { FLOW_STATUS_KEYS, POS, has, meters } from "./status.js";

  let st = $derived(FC.POSITION_STATUS);

  let hasRangefinder = $derived(has(st.flags, POS.RANGEFINDER));
  let aglValid = $derived(has(st.flags, POS.AGL_VALID));
  let hasFlow = $derived(has(st.flags, POS.FLOW));
  let flowHealthy = $derived(has(st.flags, POS.FLOW_HEALTHY));

  // Bench direction check. Works disarmed: raw flow ("cm/s at 1 m") times
  // the AGL height, in the body frame the firmware assumes (x forward,
  // y left). Sliding the model forward must move the arrow up, sliding it
  // right must move the arrow right.
  let heightM = $derived(aglValid ? st.aglAlt / 100 : 1);
  let benchFwd = $derived(st.flowX * heightM);
  let benchRight = $derived(-st.flowY * heightM);

  const ARROW_RANGE = 100; // cm/s at the edge of the box
  let arrow = $derived.by(() => {
    const k = 45 / ARROW_RANGE;
    return {
      x: 50 + Math.max(-45, Math.min(45, benchRight * k)),
      y: 50 - Math.max(-45, Math.min(45, benchFwd * k)),
    };
  });
</script>

<Section label="positionLiveSensors" summary="positionLiveSensorsHelp">
  <SubSection label="positionRangefinder">
    <Readout
      label="positionDetected"
      value={hasRangefinder ? $i18n.t("positionYes") : $i18n.t("positionNo")}
      state={hasRangefinder ? "ok" : "bad"}
    />
    <Readout
      label="positionRangefinderRaw"
      value={st.rangefinderRaw >= 0
        ? meters(st.rangefinderRaw)
        : $i18n.t("positionOutOfRange")}
    />
    <Readout label="positionAglAltitude" value={meters(st.aglAlt)} />
    <Readout
      label="positionAglVario"
      value={`${(st.aglVario / 100).toFixed(2)} m/s`}
    />
    <Readout
      label="positionAglValid"
      value={aglValid ? $i18n.t("positionYes") : $i18n.t("positionNo")}
      state={aglValid ? "ok" : "warn"}
    />
    <Meter
      title={$i18n.t("positionAglReliability")}
      leftLabel={`${Math.round(st.aglReliability * 100)}%`}
      rightLabel="≥33%"
      value={st.aglReliability * 100}
    />
  </SubSection>

  <SubSection label="positionOpticalFlow">
    <Readout
      label="positionDetected"
      value={hasFlow
        ? flowHealthy
          ? $i18n.t("positionHealthy")
          : $i18n.t("positionNoData")
        : $i18n.t("positionNo")}
      state={hasFlow ? (flowHealthy ? "ok" : "bad") : "bad"}
    />
    <Meter
      title={$i18n.t("positionFlowQuality")}
      leftLabel={`${st.flowQuality}`}
      rightLabel=">50"
      value={(st.flowQuality / 255) * 100}
    />
    <Readout label="positionFlowRawX" value={st.flowX} />
    <Readout label="positionFlowRawY" value={st.flowY} />
    <Readout
      label="positionFlowStatus"
      value={$i18n.t(FLOW_STATUS_KEYS[st.flowStatus] ?? "positionUnknown")}
      state={st.flowStatus === 0 ? "ok" : "warn"}
    />
  </SubSection>

  <SubSection label="positionFlowDirection">
    <div class="direction">
      <svg viewBox="0 0 100 100">
        <rect x="1" y="1" width="98" height="98" class="frame" />
        <line x1="50" y1="5" x2="50" y2="95" class="grid" />
        <line x1="5" y1="50" x2="95" y2="50" class="grid" />
        <text x="52" y="11" class="label">{$i18n.t("positionForward")}</text>
        <text x="72" y="47" class="label">{$i18n.t("positionRight")}</text>
        <line x1="50" y1="50" x2={arrow.x} y2={arrow.y} class="arrow" />
        <circle cx={arrow.x} cy={arrow.y} r="3" class="tip" />
      </svg>
      <div class="direction-text">
        <p>{$i18n.t("positionFlowDirectionHelp")}</p>
        <Readout
          label="positionForward"
          value={`${benchFwd.toFixed(0)} cm/s`}
        />
        <Readout
          label="positionRight"
          value={`${benchRight.toFixed(0)} cm/s`}
        />
      </div>
    </div>
  </SubSection>
</Section>

<style lang="scss">
  .direction {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 12px;
    align-items: start;
  }

  svg {
    width: 140px;
    height: 140px;
  }

  .frame {
    fill: var(--color-input-bg);
    stroke: var(--color-border-soft);
  }

  .grid {
    stroke: var(--color-border-soft);
    stroke-width: 0.5;
  }

  .label {
    font-size: 6px;
    fill: var(--color-text-soft);
  }

  .arrow {
    stroke: #3b82f6;
    stroke-width: 2;
  }

  .tip {
    fill: #3b82f6;
  }

  .direction-text p {
    font-size: 12px;
    margin: 0 0 6px;
    color: var(--color-text-soft);
  }
</style>
