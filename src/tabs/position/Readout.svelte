<script>
  import { i18n } from "@/js/i18n.js";

  // One read-only line: translated label, value, optional traffic light
  // (state: "ok" | "warn" | "bad").
  let { label, value, state } = $props();
</script>

<div class="row">
  <span class="label">{$i18n.t(label)}</span>
  <span class={["value", state]}>{value}</span>
</div>

<style lang="scss">
  .row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 3px 0;
    border-bottom: 1px solid var(--color-border-soft);
    font-size: 0.82rem;
  }

  .label {
    color: var(--color-text-soft);
  }

  .value {
    font-variant-numeric: tabular-nums;
    text-align: right;

    &.ok {
      color: var(--color-status-good);
      font-weight: 600;
    }

    &.warn {
      color: var(--color-warning);
      font-weight: 600;
    }

    &.bad {
      color: var(--color-status-bad);
      font-weight: 600;
    }
  }
</style>
