<script>
  import Field from "@/components/Field.svelte";
  import NumberInput from "@/components/NumberInput.svelte";
  import Tooltip from "@/components/Tooltip.svelte";

  // Number field for obj[key], shown as obj[key] / scale (e.g. dm as m).
  // def: firmware default in display units.
  let {
    id,
    obj,
    key,
    scale = 1,
    min,
    max,
    step = 1,
    label,
    unit,
    help,
    def,
  } = $props();

  let attrs = $derived([
    ...(def !== undefined
      ? [{ name: "genericDefault", value: `${def}${unit ? " " + unit : ""}` }]
      : []),
    {
      name: "genericRange",
      value: `${min} - ${max}${unit ? " " + unit : ""}`,
    },
  ]);
</script>

<Field {id} {label} {unit}>
  {#snippet tooltip()}
    <Tooltip {help} {attrs} />
  {/snippet}
  <NumberInput
    {id}
    {min}
    {max}
    {step}
    bind:value={
      () => obj[key] / scale, (v) => (obj[key] = Math.round(v * scale))
    }
  />
</Field>
