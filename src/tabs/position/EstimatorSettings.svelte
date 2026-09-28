<script>
  import Expert from "@/components/Expert.svelte";
  import Field from "@/components/Field.svelte";
  import Section from "@/components/Section.svelte";
  import Select from "@/components/Select.svelte";
  import SubSection from "@/components/SubSection.svelte";
  import Tooltip from "@/components/Tooltip.svelte";
  import WarningNote from "@/components/notes/WarningNote.svelte";

  import { FC } from "@/js/fc.svelte.js";

  import ScaledField from "./ScaledField.svelte";
  import {
    ALT_SOURCES,
    OPTICAL_FLOW_HARDWARE,
    RANGEFINDER_HARDWARE,
    XY_SOURCES,
    toOptions,
  } from "./status.js";

  let cfg = $derived(FC.POSITION_CONFIG);

  let microlinkMismatch = $derived(
    cfg.rangefinder_hardware === 4 && cfg.optical_flow_hardware !== 1,
  );

  // Kalman filter noise terms, raw firmware units (see the tuning doc)
  const noiseFields = [
    ["est_q_accel_z", "positionQAccelZ", 100, 20000, "(cm/s²)²"],
    ["est_q_accel_xy", "positionQAccelXY", 100, 50000, "(cm/s²)²"],
    ["est_q_baro_bias", "positionQBaroBias", 0, 400, "cm²/s"],
    ["est_q_terrain", "positionQTerrain", 0, 200, "cm²/m"],
    ["est_r_baro_alt", "positionRBaro", 1, 600, "cm²"],
    ["est_r_lidar_alt", "positionRLidar", 1, 100, "cm²"],
    ["est_r_gps_pos", "positionRGpsPos", 1, 500, "cm²"],
    ["est_r_gps_vel", "positionRGpsVel", 1, 100, "(cm/s)²"],
    ["est_r_gps_vvel", "positionRGpsVvel", 1, 400, "(cm/s)²"],
    ["est_r_flow_vel", "positionRFlowVel", 1, 400, "(cm/s)²"],
  ];

  const lpfFields = [
    ["baro_alt_lpf", "positionBaroAltLpf", 1, 250],
    ["baro_offset_lpf", "positionBaroOffsetLpf", 1, 250],
    ["gps_alt_lpf", "positionGpsAltLpf", 1, 250],
    ["gps_offset_lpf", "positionGpsOffsetLpf", 1, 250],
  ];
</script>

<Section
  label="positionSensorsEstimator"
  summary="positionSensorsEstimatorHelp"
>
  <WarningNote message="positionRebootNote" />
  <SubSection label="positionHardware">
    <Field id="rangefinder-hw" label="positionRangefinderHardware">
      {#snippet tooltip()}
        <Tooltip help="positionRangefinderHardwareHelp" />
      {/snippet}
      <Select
        id="rangefinder-hw"
        bind:value={cfg.rangefinder_hardware}
        options={toOptions(RANGEFINDER_HARDWARE)}
      />
    </Field>
    <Field id="flow-hw" label="positionFlowHardware">
      {#snippet tooltip()}
        <Tooltip help="positionFlowHardwareHelp" />
      {/snippet}
      <Select
        id="flow-hw"
        bind:value={cfg.optical_flow_hardware}
        options={toOptions(OPTICAL_FLOW_HARDWARE)}
      />
    </Field>
    {#if microlinkMismatch}
      <WarningNote message="positionMicrolinkMismatch" />
    {/if}
  </SubSection>
  <SubSection label="positionSources">
    <Field id="alt-source" label="positionAltSource">
      {#snippet tooltip()}
        <Tooltip help="positionAltSourceHelp" />
      {/snippet}
      <Select
        id="alt-source"
        bind:value={cfg.alt_source}
        options={toOptions(ALT_SOURCES)}
      />
    </Field>
    <Field id="xy-source" label="positionXySource">
      {#snippet tooltip()}
        <Tooltip help="positionXySourceHelp" />
      {/snippet}
      <Select
        id="xy-source"
        bind:value={cfg.xy_source}
        options={toOptions(XY_SOURCES)}
      />
    </Field>
    <ScaledField
      id="downwash"
      obj={cfg}
      key="baro_downwash_comp"
      scale={10}
      min={0}
      max={20}
      step={0.1}
      def={3}
      label="positionDownwashComp"
      help="positionDownwashCompHelp"
    />
    <ScaledField
      id="gps-min-sats"
      obj={cfg}
      key="gps_min_sats"
      min={0}
      max={50}
      def={12}
      label="positionGpsMinSats"
      help="positionGpsMinSatsHelp"
    />
    <ScaledField
      id="flow-gyro-comp"
      obj={cfg}
      key="flow_gyro_comp"
      min={-200}
      max={200}
      def={100}
      unit="%"
      label="positionFlowGyroComp"
      help="positionFlowGyroCompHelp"
    />
  </SubSection>
  <Expert>
    <SubSection label="positionFilterNoise">
      {#each noiseFields as [key, label, min, def, unit] (key)}
        <ScaledField
          id={`est-${key}`}
          obj={cfg}
          {key}
          {min}
          max={65535}
          {def}
          {unit}
          {label}
          help={`${label}Help`}
        />
      {/each}
    </SubSection>
    <SubSection label="positionPrefilters">
      {#each lpfFields as [key, label, min, max] (key)}
        <ScaledField
          id={`lpf-${key}`}
          obj={cfg}
          {key}
          {min}
          {max}
          {label}
          help="positionPrefilterHelp"
        />
      {/each}
    </SubSection>
  </Expert>
</Section>
