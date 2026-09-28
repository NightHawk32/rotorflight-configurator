<script>
  // Top-down view of the horizontal estimate: North up, East right.
  // trail: [{ e, n }] in cm. target: { e, n } or null. sigma in cm.
  let {
    trail = [],
    current,
    target = null,
    sigma = 0,
    headingDeg = 0,
  } = $props();

  const SIZE = 300;
  const HALF = SIZE / 2;

  // Radius shown, in cm: fits everything, at least 1 m, rounded up to 0.5 m
  let range = $derived.by(() => {
    let r = 100;
    const all = [...trail, current, ...(target ? [target] : [])];
    for (const p of all) {
      if (!p) continue;
      r = Math.max(r, Math.abs(p.e), Math.abs(p.n));
    }
    return Math.ceil((r * 1.1) / 50) * 50;
  });

  function x(e) {
    return HALF + (e / range) * HALF;
  }

  function y(n) {
    return HALF - (n / range) * HALF;
  }

  let trailPoints = $derived(
    trail.map((p) => `${x(p.e).toFixed(1)},${y(p.n).toFixed(1)}`).join(" "),
  );

  let heading = $derived.by(() => {
    const rad = (headingDeg * Math.PI) / 180;
    const len = 18;
    return {
      x2: x(current.e) + Math.sin(rad) * len,
      y2: y(current.n) - Math.cos(rad) * len,
    };
  });
</script>

<div class="plot">
  <svg viewBox={`0 0 ${SIZE} ${SIZE}`}>
    <circle cx={HALF} cy={HALF} r={HALF / 2} class="grid" />
    <circle cx={HALF} cy={HALF} r={HALF - 1} class="grid" />
    <line x1={HALF} y1="0" x2={HALF} y2={SIZE} class="grid" />
    <line x1="0" y1={HALF} x2={SIZE} y2={HALF} class="grid" />
    <text x={HALF + 4} y="12" class="label">N</text>

    <polyline points={trailPoints} class="trail" />

    {#if sigma > 0}
      <circle
        cx={x(current.e)}
        cy={y(current.n)}
        r={(sigma / range) * HALF}
        class="sigma"
      />
    {/if}

    {#if target}
      <g class="target">
        <line
          x1={x(target.e) - 7}
          y1={y(target.n)}
          x2={x(target.e) + 7}
          y2={y(target.n)}
        />
        <line
          x1={x(target.e)}
          y1={y(target.n) - 7}
          x2={x(target.e)}
          y2={y(target.n) + 7}
        />
      </g>
    {/if}

    <line
      x1={x(current.e)}
      y1={y(current.n)}
      x2={heading.x2}
      y2={heading.y2}
      class="heading"
    />
    <circle cx={x(current.e)} cy={y(current.n)} r="4" class="current" />
  </svg>
  <div class="scale">
    ○ {(range / 200).toFixed(2)} m &nbsp; ◯ {(range / 100).toFixed(2)} m
  </div>
</div>

<style lang="scss">
  .plot {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  svg {
    width: 100%;
    max-width: 300px;
    aspect-ratio: 1;
    border: 1px solid var(--color-border-soft);
    border-radius: 4px;
    background-color: var(--color-input-bg);
  }

  .grid {
    fill: none;
    stroke: var(--color-border-soft);
    stroke-width: 1;
  }

  .label {
    font-size: 11px;
    fill: var(--color-text-soft);
  }

  .trail {
    fill: none;
    stroke: #3b82f6;
    stroke-width: 1.5;
  }

  .sigma {
    fill: rgba(59, 130, 246, 0.12);
    stroke: rgba(59, 130, 246, 0.5);
    stroke-width: 1;
  }

  .target line {
    stroke: #ef4444;
    stroke-width: 2;
  }

  .heading {
    stroke: var(--color-text);
    stroke-width: 2;
  }

  .current {
    fill: #3b82f6;
    stroke: var(--color-text);
    stroke-width: 1;
  }

  .scale {
    font-size: 12px;
    color: var(--color-text-soft);
    margin-top: 4px;
  }
</style>
