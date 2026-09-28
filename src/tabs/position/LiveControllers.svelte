<script>
  import Section from "@/components/Section.svelte";
  import SubSection from "@/components/SubSection.svelte";

  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";

  import Readout from "./Readout.svelte";
  import { AH, HARDDECK_STATE_KEYS, has, meters } from "./status.js";

  let st = $derived(FC.POSITION_STATUS);
  let ah = $derived(st.altholdFlags);

  let altholdState = $derived.by(() => {
    if (has(ah, AH.ENGAGED)) {
      return { key: "positionEngaged", state: "ok" };
    }
    if (has(ah, AH.YIELDED)) {
      return { key: "positionYieldedToRescue", state: "warn" };
    }
    return { key: "positionOff", state: undefined };
  });

  // Hard deck: WATCH is armed and waiting, PULLUP..EXIT is in control
  let hdState = $derived(
    st.harddeckState >= 3 ? "bad" : st.harddeckState === 2 ? "ok" : undefined,
  );

  function yesNo(v) {
    return v ? $i18n.t("positionYes") : $i18n.t("positionNo");
  }

  function angle(cdeg) {
    return `${(cdeg / 100).toFixed(1)}°`;
  }
</script>

<Section label="positionLiveControllers" summary="positionLiveControllersHelp">
  <SubSection label="positionAltHold">
    <Readout
      label="positionState"
      value={$i18n.t(altholdState.key)}
      state={altholdState.state}
    />
    <Readout
      label="positionAltSourceUsed"
      value={has(ah, AH.USING_AGL)
        ? $i18n.t("positionSourceLidar")
        : $i18n.t("positionSourceFused")}
    />
    <Readout
      label="positionSourceValid"
      value={yesNo(has(ah, AH.SOURCE_VALID))}
      state={has(ah, AH.SOURCE_VALID) ? undefined : "bad"}
    />
    <Readout
      label="positionStickMovesTarget"
      value={yesNo(has(ah, AH.STICK))}
    />
    <Readout label="positionTarget" value={meters(st.altholdTarget)} />
    <Readout label="positionCurrent" value={meters(st.altholdAlt)} />
    <Readout
      label="positionError"
      value={meters(st.altholdTarget - st.altholdAlt)}
    />
    <Readout
      label="positionCollectiveOutput"
      value={`${(st.altholdOutput / 10).toFixed(1)}%`}
    />
  </SubSection>

  <SubSection label="positionPosHold">
    <Readout
      label="positionState"
      value={st.posholdActive
        ? $i18n.t("positionEngaged")
        : $i18n.t("positionOff")}
      state={st.posholdActive ? "ok" : undefined}
    />
    <Readout
      label="positionTarget"
      value={`E ${meters(st.posholdTargetEast)}  N ${meters(st.posholdTargetNorth)}`}
    />
    <Readout
      label="positionError"
      value={st.posholdActive
        ? meters(
            Math.hypot(
              st.posholdTargetEast - st.posEast,
              st.posholdTargetNorth - st.posNorth,
            ),
          )
        : "—"}
    />
    <Readout label="positionRollCommand" value={angle(st.posholdRoll)} />
    <Readout label="positionPitchCommand" value={angle(st.posholdPitch)} />
  </SubSection>

  <SubSection label="positionHardDeck">
    <Readout
      label="positionState"
      value={$i18n.t(
        HARDDECK_STATE_KEYS[st.harddeckState] ?? "positionUnknown",
      )}
      state={hdState}
    />
    <Readout
      label="positionDeck"
      value={`${(FC.HOLD_PROFILE.harddeck_altitude / 10).toFixed(1)} m`}
    />
    <Readout
      label="positionPredictedMin"
      value={meters(st.harddeckPredicted)}
      state={st.harddeckState >= 2 &&
      st.harddeckPredicted < FC.HOLD_PROFILE.harddeck_altitude * 10
        ? "bad"
        : undefined}
    />
    <Readout label="positionTarget" value={meters(st.harddeckTarget)} />
  </SubSection>
</Section>
