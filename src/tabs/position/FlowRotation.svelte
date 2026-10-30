<script>
  import Section from "@/components/Section.svelte";
  import SubSection from "@/components/SubSection.svelte";
  import InfoNote from "@/components/notes/InfoNote.svelte";

  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";

  import Chart from "./Chart.svelte";
  import Readout from "./Readout.svelte";

  // history: { x, compX, y, compY } flow in "cm/s at 1 m" (null = no data)
  // and rate (deg/s), one entry per status poll
  let { history } = $props();

  // Samples below this body rate say nothing about the compensation
  const MIN_RATE = 20;
  // Share of the rotation flow the compensation should remove at least
  const GOOD_REMOVED = 0.6;

  let cfg = $derived(FC.POSITION_CONFIG);
  let st = $derived(FC.POSITION_STATUS);

  let forward = $derived([
    {
      label: $i18n.t("positionFlowRotationRaw"),
      color: "#a855f7",
      values: history.x,
    },
    {
      label: $i18n.t("positionFlowRotationCompensated"),
      color: "#3b82f6",
      values: history.compX,
    },
  ]);

  let left = $derived([
    {
      label: $i18n.t("positionFlowRotationRaw"),
      color: "#a855f7",
      values: history.y,
    },
    {
      label: $i18n.t("positionFlowRotationCompensated"),
      color: "#3b82f6",
      values: history.compY,
    },
  ]);

  // RMS of the raw and compensated flow over the samples with rotation
  let stats = $derived.by(() => {
    let raw = 0;
    let comp = 0;
    let n = 0;
    for (let i = 0; i < history.rate.length; i++) {
      if (history.rate[i] < MIN_RATE || history.x[i] === null) continue;
      raw += history.x[i] ** 2 + history.y[i] ** 2;
      comp += history.compX[i] ** 2 + history.compY[i] ** 2;
      n++;
    }
    return {
      n,
      total: history.rate.length,
      valid: n >= 10 && raw > 0,
      raw: n ? Math.sqrt(raw / n) : 0,
      comp: n ? Math.sqrt(comp / n) : 0,
      removed: raw > 0 ? 1 - Math.sqrt(comp / raw) : 0,
    };
  });
</script>

<Section label="positionFlowRotation" summary="positionFlowRotationHelp">
  <InfoNote message="positionFlowRotationSetup" />
  <SubSection label="positionFlowRotationForward">
    <Chart series={forward} unit="" scale={1} />
  </SubSection>
  <SubSection label="positionFlowRotationLeft">
    <Chart series={left} unit="" scale={1} />
  </SubSection>
  <SubSection label="positionFlowRotationResult">
    <Readout
      label="positionFlowRotationSettings"
      value={`${cfg.flow_gyro_comp} % / ${cfg.flow_gyro_delay} ms`}
    />
    <Readout
      label="positionFlowRotationRateNow"
      value={`${Math.hypot(st.gyroRoll, st.gyroPitch).toFixed(0)} °/s`}
    />
    <Readout
      label="positionFlowRotationSamples"
      value={`${stats.n} / ${stats.total}`}
      state={stats.n >= 10 ? "ok" : "warn"}
    />
    {#if stats.valid}
      <Readout
        label="positionFlowRotationRms"
        value={`${stats.raw.toFixed(0)} → ${stats.comp.toFixed(0)}`}
      />
      <Readout
        label="positionFlowRotationRemoved"
        value={`${Math.round(stats.removed * 100)} %`}
        state={stats.removed >= GOOD_REMOVED ? "ok" : "warn"}
      />
    {:else}
      <Readout
        label="positionFlowRotationRemoved"
        value={$i18n.t("positionFlowRotationNoRotation", { rate: MIN_RATE })}
      />
    {/if}
  </SubSection>
</Section>
