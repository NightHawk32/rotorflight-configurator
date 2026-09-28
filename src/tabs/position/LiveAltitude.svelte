<script>
  import Section from "@/components/Section.svelte";
  import SubSection from "@/components/SubSection.svelte";

  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";

  import Chart from "./Chart.svelte";
  import Readout from "./Readout.svelte";
  import { POS, has, meters } from "./status.js";

  // history: { kf, baro, gps, rf, target } arrays of cm (null = no data)
  let { history } = $props();

  let st = $derived(FC.POSITION_STATUS);
  let kfValid = $derived(has(st.flags, POS.KF_VALID));

  function yesNo(v) {
    return v ? $i18n.t("positionYes") : $i18n.t("positionNo");
  }

  let series = $derived([
    {
      label: $i18n.t("positionSeriesFused"),
      color: "#3b82f6",
      values: history.kf,
    },
    {
      label: $i18n.t("positionSeriesBaro"),
      color: "#a855f7",
      values: history.baro,
    },
    {
      label: $i18n.t("positionSeriesGps"),
      color: "#16a34a",
      values: history.gps,
    },
    {
      label: $i18n.t("positionSeriesLidar"),
      color: "#d97706",
      values: history.rf,
    },
    {
      label: $i18n.t("positionSeriesTarget"),
      color: "#ef4444",
      values: history.target,
    },
  ]);
</script>

<Section label="positionLiveAltitude" summary="positionLiveAltitudeHelp">
  <SubSection>
    <Chart {series} unit="m" scale={100} />
  </SubSection>
  <SubSection label="positionEstimate">
    <Readout
      label="positionEstimateValid"
      value={yesNo(kfValid)}
      state={kfValid ? "ok" : "bad"}
    />
    <Readout label="positionFusedAltitude" value={meters(st.kfAlt)} />
    <Readout
      label="positionFusedVario"
      value={`${(st.kfVario / 100).toFixed(2)} m/s`}
    />
    <Readout
      label="positionAltitudeSigma"
      value={meters(st.kfSigma)}
      state={st.kfSigma < 100 ? "ok" : st.kfSigma < 300 ? "warn" : "bad"}
    />
    <Readout label="positionDisplayedAltitude" value={meters(st.altitude)} />
  </SubSection>
  <SubSection label="positionBaroModel">
    <Readout label="positionBaroBias" value={meters(st.baroBias)} />
    <Readout
      label="positionDisturbance"
      value={st.disturbance.toFixed(2)}
      state={st.disturbance < 1 ? undefined : "warn"}
    />
    <Readout
      label="positionAnchorFresh"
      value={yesNo(has(st.flags, POS.ANCHOR_FRESH))}
    />
    <Readout
      label="positionInvertedBias"
      value={yesNo(has(st.flags, POS.INVERTED))}
    />
    <Readout
      label="positionBaroGated"
      value={yesNo(has(st.flags, POS.BARO_GATED))}
      state={has(st.flags, POS.BARO_GATED) ? "warn" : undefined}
    />
  </SubSection>
  <SubSection label="positionMeasurements">
    <Readout
      label="positionBaroMeasurement"
      value={has(st.flags, POS.HAVE_BARO)
        ? meters(st.baroMeas - st.baroBias)
        : "—"}
    />
    <Readout
      label="positionGpsMeasurement"
      value={has(st.flags, POS.HAVE_GPS_ALT) ? meters(st.gpsMeas) : "—"}
    />
    <Readout
      label="positionLidarMeasurement"
      value={has(st.flags, POS.AGL_VALID) ? meters(st.rfMeas) : "—"}
    />
  </SubSection>
</Section>
