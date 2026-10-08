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
</Section>
