<script>
  import Field from "@/components/Field.svelte";
  import Section from "@/components/Section.svelte";
  import SubSection from "@/components/SubSection.svelte";
  import Switch from "@/components/Switch.svelte";
  import Tooltip from "@/components/Tooltip.svelte";

  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";

  import ScaledField from "./ScaledField.svelte";

  let hp = $derived(FC.HOLD_PROFILE);
  let profile = $derived((FC.CONFIG.profile ?? 0) + 1);
</script>

{#snippet profileNote()}
  <p class="profile">{$i18n.t("positionPidProfile", { profile })}</p>
{/snippet}

<Section label="positionAltHold">
  {@render profileNote()}
  <SubSection label="positionGains">
    <ScaledField
      id="althold-p"
      obj={hp}
      key="althold_alt_p_gain"
      min={0}
      max={1000}
      def={20}
      label="positionAltholdP"
      help="positionAltholdPHelp"
    />
    <ScaledField
      id="althold-i"
      obj={hp}
      key="althold_alt_i_gain"
      min={0}
      max={1000}
      def={5}
      label="positionAltholdI"
      help="positionAltholdIHelp"
    />
    <ScaledField
      id="althold-d"
      obj={hp}
      key="althold_alt_d_gain"
      min={0}
      max={1000}
      def={15}
      label="positionAltholdD"
      help="positionAltholdDHelp"
    />
  </SubSection>
  <SubSection label="positionLimits">
    <ScaledField
      id="althold-climb"
      obj={hp}
      key="althold_max_climb_rate"
      scale={100}
      min={0.1}
      max={10}
      step={0.1}
      def={2}
      unit="m/s"
      label="positionAltholdMaxClimb"
      help="positionAltholdMaxClimbHelp"
    />
    <ScaledField
      id="althold-hover"
      obj={hp}
      key="althold_hover_collective"
      scale={10}
      min={0}
      max={100}
      step={0.1}
      def={35}
      unit="%"
      label="positionAltholdHover"
      help="positionAltholdHoverHelp"
    />
    <ScaledField
      id="althold-deadband"
      obj={hp}
      key="althold_stick_deadband"
      scale={10}
      min={0}
      max={50}
      step={0.1}
      def={10}
      unit="%"
      label="positionStickDeadband"
      help="positionAltholdDeadbandHelp"
    />
  </SubSection>
</Section>

<Section label="positionPosHold">
  {@render profileNote()}
  <SubSection label="positionGains">
    <ScaledField
      id="poshold-pos-p"
      obj={hp}
      key="poshold_pos_p_gain"
      min={0}
      max={1000}
      def={50}
      label="positionPosholdPosP"
      help="positionPosholdPosPHelp"
    />
    <ScaledField
      id="poshold-vel-p"
      obj={hp}
      key="poshold_vel_p_gain"
      min={0}
      max={1000}
      def={30}
      label="positionPosholdVelP"
      help="positionPosholdVelPHelp"
    />
    <ScaledField
      id="poshold-vel-i"
      obj={hp}
      key="poshold_vel_i_gain"
      min={0}
      max={1000}
      def={10}
      label="positionPosholdVelI"
      help="positionPosholdVelIHelp"
    />
  </SubSection>
  <SubSection label="positionLimits">
    <ScaledField
      id="poshold-speed"
      obj={hp}
      key="poshold_max_horiz_speed"
      scale={100}
      min={0.1}
      max={10}
      step={0.1}
      def={2}
      unit="m/s"
      label="positionPosholdMaxSpeed"
      help="positionPosholdMaxSpeedHelp"
    />
    <ScaledField
      id="poshold-tilt"
      obj={hp}
      key="poshold_max_tilt_angle"
      scale={10}
      min={1}
      max={45}
      step={0.1}
      def={15}
      unit="°"
      label="positionPosholdMaxTilt"
      help="positionPosholdMaxTiltHelp"
    />
    <ScaledField
      id="poshold-deadband"
      obj={hp}
      key="poshold_stick_deadband"
      scale={10}
      min={0}
      max={50}
      step={0.1}
      def={10}
      unit="%"
      label="positionStickDeadband"
      help="positionPosholdDeadbandHelp"
    />
  </SubSection>
</Section>

<Section label="positionHardDeck">
  {@render profileNote()}
  <SubSection label="positionHardDeckAltitudes">
    <ScaledField
      id="harddeck-altitude"
      obj={hp}
      key="harddeck_altitude"
      scale={10}
      min={1}
      max={1000}
      step={0.1}
      def={10}
      unit="m"
      label="positionHardDeckAltitude"
      help="positionHardDeckAltitudeHelp"
    />
    <ScaledField
      id="harddeck-arm-margin"
      obj={hp}
      key="harddeck_arm_margin"
      scale={10}
      min={0}
      max={100}
      step={0.1}
      def={2}
      unit="m"
      label="positionHardDeckArmMargin"
      help="positionHardDeckArmMarginHelp"
    />
    <ScaledField
      id="harddeck-recovery-margin"
      obj={hp}
      key="harddeck_recovery_margin"
      scale={10}
      min={0}
      max={100}
      step={0.1}
      def={3}
      unit="m"
      label="positionHardDeckRecoveryMargin"
      help="positionHardDeckRecoveryMarginHelp"
    />
    <ScaledField
      id="harddeck-release"
      obj={hp}
      key="harddeck_release_altitude"
      scale={10}
      min={0}
      max={1000}
      step={0.1}
      def={0}
      unit="m"
      label="positionHardDeckRelease"
      help="positionHardDeckReleaseHelp"
    />
  </SubSection>
  <SubSection label="positionHardDeckPrediction">
    <ScaledField
      id="harddeck-accel"
      obj={hp}
      key="harddeck_recovery_accel"
      scale={10}
      min={0.5}
      max={50}
      step={0.1}
      def={5}
      unit="m/s²"
      label="positionHardDeckAccel"
      help="positionHardDeckAccelHelp"
    />
    <ScaledField
      id="harddeck-reaction"
      obj={hp}
      key="harddeck_reaction_time"
      min={0}
      max={2000}
      step={10}
      def={300}
      unit="ms"
      label="positionHardDeckReaction"
      help="positionHardDeckReactionHelp"
    />
    <ScaledField
      id="harddeck-sigma"
      obj={hp}
      key="harddeck_sigma_factor"
      scale={10}
      min={0}
      max={5}
      step={0.1}
      def={2}
      unit="σ"
      label="positionHardDeckSigma"
      help="positionHardDeckSigmaHelp"
    />
    <Field id="harddeck-agl" label="positionHardDeckUseAgl">
      {#snippet tooltip()}
        <Tooltip help="positionHardDeckUseAglHelp" />
      {/snippet}
      <Switch
        id="harddeck-agl"
        bind:checked={
          () => hp.harddeck_use_agl !== 0,
          (v) => (hp.harddeck_use_agl = v ? 1 : 0)
        }
      />
    </Field>
  </SubSection>
</Section>

<style lang="scss">
  .profile {
    margin: 0 0 4px;
    font-size: 0.75rem;
    color: var(--color-text-soft);
  }
</style>
