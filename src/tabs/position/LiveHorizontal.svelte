<script>
  import Section from "@/components/Section.svelte";
  import SubSection from "@/components/SubSection.svelte";

  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";

  import Readout from "./Readout.svelte";
  import TrackPlot from "./TrackPlot.svelte";
  import { POS, has, meters } from "./status.js";

  let { trail, onclear } = $props();

  let st = $derived(FC.POSITION_STATUS);
  let valid = $derived(has(st.flags, POS.XY_VALID));
  let target = $derived(
    st.posholdActive
      ? { e: st.posholdTargetEast, n: st.posholdTargetNorth }
      : null,
  );
  let heading = $derived(FC.SENSOR_DATA.kinematics[2] ?? 0);

  function yesNo(v) {
    return v ? $i18n.t("positionYes") : $i18n.t("positionNo");
  }

  function speed(e, n) {
    return `${(Math.hypot(e, n) / 100).toFixed(2)} m/s`;
  }
</script>

<Section label="positionLiveHorizontal" summary="positionLiveHorizontalHelp">
  <SubSection>
    <TrackPlot
      {trail}
      current={{ e: st.posEast, n: st.posNorth }}
      {target}
      sigma={st.posSigma}
      headingDeg={heading}
    />
    <button class="btn clear" onclick={onclear}>
      {$i18n.t("positionClearTrail")}
    </button>
  </SubSection>
  <SubSection label="positionEstimate">
    <Readout
      label="positionEstimateValid"
      value={yesNo(valid)}
      state={valid ? "ok" : "warn"}
    />
    <Readout
      label="positionPosition"
      value={`E ${meters(st.posEast)}  N ${meters(st.posNorth)}`}
    />
    <Readout
      label="positionVelocity"
      value={`E ${(st.velEast / 100).toFixed(2)}  N ${(st.velNorth / 100).toFixed(2)} m/s`}
    />
    <Readout label="positionSpeed" value={speed(st.velEast, st.velNorth)} />
    <Readout label="positionPositionSigma" value={meters(st.posSigma)} />
    <Readout
      label="positionGpsFused"
      value={yesNo(has(st.flags, POS.XY_GPS_FRESH))}
    />
    <Readout
      label="positionFlowFused"
      value={yesNo(has(st.flags, POS.XY_FLOW_FRESH))}
    />
    <Readout
      label="positionGpsOrigin"
      value={yesNo(has(st.flags, POS.XY_GPS_ORIGIN))}
    />
    <Readout
      label="positionClamped"
      value={yesNo(has(st.flags, POS.XY_CLAMPED))}
      state={has(st.flags, POS.XY_CLAMPED) ? "warn" : undefined}
    />
    <Readout
      label="positionFlowVelocity"
      value={`E ${(st.flowVelEast / 100).toFixed(2)}  N ${(st.flowVelNorth / 100).toFixed(2)} m/s`}
    />
  </SubSection>
</Section>

<style lang="scss">
  .clear {
    @extend %button;
    margin-top: 6px;
    padding: 4px 8px;
  }
</style>
