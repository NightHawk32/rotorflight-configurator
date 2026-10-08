<script>
  // Minimal strip chart: one SVG polyline per series, shared auto-scaled
  // Y axis. Values are plotted oldest to newest, left to right.
  let { series = [], height = 160, unit = "", scale = 1 } = $props();

  const WIDTH = 400;
  const PAD = 4;

  let bounds = $derived.by(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of series) {
      for (const v of s.values) {
        if (v === null || !isFinite(v)) continue;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
    if (!isFinite(lo)) {
      return { lo: -1, hi: 1 };
    }
    // Never zoom in closer than +-0.5 display units
    const span = Math.max(hi - lo, scale);
    const mid = (hi + lo) / 2;
    return {
      lo: mid - span / 2 - span * 0.05,
      hi: mid + span / 2 + span * 0.05,
    };
  });

  function points(values) {
    const n = values.length;
    if (n < 2) return "";
    const { lo, hi } = bounds;
    const out = [];
    for (let i = 0; i < n; i++) {
      const v = values[i];
      if (v === null || !isFinite(v)) continue;
      const x = (i / (n - 1)) * WIDTH;
      const y = PAD + (1 - (v - lo) / (hi - lo)) * (height - 2 * PAD);
      out.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return out.join(" ");
  }

  function fmt(v) {
    return (v / scale).toFixed(2);
  }
</script>

<div class="chart">
  <svg viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none">
    {#each series as s (s.label)}
      <polyline
        points={points(s.values)}
        fill="none"
        stroke={s.color}
        stroke-width="1.5"
        vector-effect="non-scaling-stroke"
      />
    {/each}
  </svg>
  <div class="axis">
    <span>{fmt(bounds.hi)} {unit}</span>
    <span>{fmt(bounds.lo)} {unit}</span>
  </div>
  <div class="legend">
    {#each series as s (s.label)}
      <span><i style:background={s.color}></i>{s.label}</span>
    {/each}
  </div>
</div>

<style lang="scss">
  .chart {
    position: relative;
    width: 100%;
  }

  svg {
    width: 100%;
    height: 160px;
    border: 1px solid var(--color-border-soft);
    border-radius: var(--radius-xs);
    background-color: var(--color-input-bg);
  }

  .axis {
    position: absolute;
    top: 2px;
    left: 4px;
    height: 150px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-size: 0.7rem;
    color: var(--color-text-soft);
    pointer-events: none;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 0.75rem;
    margin-top: 4px;

    i {
      display: inline-block;
      width: 12px;
      height: 3px;
      margin-right: 4px;
      vertical-align: middle;
    }
  }
</style>
