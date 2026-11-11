/* Petits graphiques SVG (sans librairie) : courbes, barres, barres empilées, avec survol.
   Couleurs : variables CSS --s1..--s3 (séries), validées daltonisme pour clair et sombre. */
window.Charts = (function () {
  const NS = 'http://www.w3.org/2000/svg';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nice = max => { if (max <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(max))); const n = max / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };
  const short = v => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1).replace('.0', '') + ' M' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1).replace('.0', '') + ' k' : String(Math.round(v));

  function frame(el, h) {
    el.innerHTML = '';
    el.style.position = 'relative';
    const w = Math.max(240, el.clientWidth);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', w); svg.setAttribute('height', h); svg.setAttribute('class', 'chart-svg');
    el.appendChild(svg);
    const tip = document.createElement('div'); tip.className = 'chart-tip'; tip.hidden = true; el.appendChild(tip);
    return { svg, tip, w, h };
  }
  const add = (svg, tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; svg.appendChild(e); return e; };

  function yAxis(svg, { x0, x1, y0, y1, max, min = 0, fmt }) {
    for (let i = 0; i <= 4; i++) {
      const v = min + (max - min) * i / 4, y = y0 - (y0 - y1) * i / 4;
      add(svg, 'line', { x1: x0, x2: x1, y1: y, y2: y, class: i ? 'grid' : 'axis' });
      add(svg, 'text', { x: x0 - 8, y: y + 4, 'text-anchor': 'end', class: 'tick' }, fmt(v));
    }
  }
  function showTip(tip, el, x, y, html) {
    tip.innerHTML = html; tip.hidden = false;
    const r = el.getBoundingClientRect(), tw = tip.offsetWidth;
    tip.style.left = Math.min(x + 12, r.width - tw - 4) + 'px'; tip.style.top = Math.max(0, y - 10) + 'px';
  }

  /** Courbes. series: [{name, color, values:[number]}], labels: [string] (axe x). */
  /* fit: true → l'axe Y suit la plage des valeurs (utile pour un prix qui varie de quelques %) au lieu de partir de 0. */
  function line(el, { series, labels, fmt = short, height = 230, fit = false }) {
    const { svg, tip, w, h } = frame(el, height);
    const pad = { l: 58, r: 16, t: 12, b: 26 };
    const x0 = pad.l, x1 = w - pad.r, y0 = h - pad.b, y1 = pad.t;
    const all = series.flatMap(s => s.values);
    let min = 0, max = nice(Math.max(1, ...all));
    if (fit) { const lo = Math.min(...all), hi = Math.max(...all), m = (hi - lo) * .15 || hi * .02; min = lo - m; max = hi + m; }
    yAxis(svg, { x0, x1, y0, y1, max, min, fmt });
    const n = labels.length, X = i => x0 + (x1 - x0) * (n > 1 ? i / (n - 1) : .5), Y = v => y0 - (y0 - y1) * (v - min) / (max - min);
    const step = Math.ceil(n / Math.max(2, Math.floor((x1 - x0) / 80)));
    labels.forEach((l, i) => { if (i % step === 0 || i === n - 1) add(svg, 'text', { x: X(i), y: h - 8, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle', class: 'tick' }, l); });
    series.forEach(s => {
      add(svg, 'path', { d: s.values.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(''), fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
      if (series.length <= 4) { const i = n - 1; add(svg, 'circle', { cx: X(i), cy: Y(s.values[i]), r: 4, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }); }
    });
    const cross = add(svg, 'line', { y1, y2: y0, class: 'cross', visibility: 'hidden' });
    const dots = series.map(s => add(svg, 'circle', { r: 5, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' }));
    const hit = add(svg, 'rect', { x: x0, y: y1, width: x1 - x0, height: y0 - y1, fill: 'transparent' });
    hit.onmousemove = e => {
      const r = svg.getBoundingClientRect(); const i = Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left - x0) / (x1 - x0) * (n - 1))));
      cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('visibility', 'visible');
      dots.forEach((d, k) => { d.setAttribute('cx', X(i)); d.setAttribute('cy', Y(series[k].values[i])); d.setAttribute('visibility', 'visible'); });
      showTip(tip, el, X(i), Y(Math.max(...series.map(s => s.values[i]))), `<b>${esc(labels[i])}</b>` + series.map(s => `<div><i style="background:${s.color}"></i>${esc(s.name)} <b>${fmt(s.values[i])}</b></div>`).join(''));
    };
    hit.onmouseleave = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); dots.forEach(d => d.setAttribute('visibility', 'hidden')); };
  }

  /** Barres verticales (une ou plusieurs séries empilées). stacks: [{name,color,values}] */
  function bars(el, { stacks, labels, fmt = short, height = 230 }) {
    const { svg, tip, w, h } = frame(el, height);
    const pad = { l: 52, r: 12, t: 12, b: 26 };
    const x0 = pad.l, x1 = w - pad.r, y0 = h - pad.b, y1 = pad.t;
    const n = labels.length, totals = labels.map((_, i) => stacks.reduce((a, s) => a + s.values[i], 0));
    const max = nice(Math.max(1, ...totals));
    yAxis(svg, { x0, x1, y0, y1, max, fmt });
    const slot = (x1 - x0) / n, bw = Math.max(3, Math.min(28, slot - 2)), Y = v => (y0 - y1) * v / max;
    const step = Math.ceil(n / Math.max(2, Math.floor((x1 - x0) / 60)));
    labels.forEach((l, i) => {
      const cx = x0 + slot * i + slot / 2; let acc = 0;
      stacks.forEach((s, k) => {
        const v = s.values[i]; if (!v) return; const hgt = Y(v); const top = y0 - Y(acc) - hgt;
        const last = k === stacks.length - 1 || stacks.slice(k + 1).every(t => !t.values[i]);
        const r = last ? Math.min(4, bw / 2, hgt) : 0;
        // data-end arrondi en haut uniquement ; 2px d'écart entre segments empilés
        const gap = acc ? 2 : 0;
        add(svg, 'path', { d: `M${cx - bw / 2},${y0 - Y(acc) - gap} V${top + r} Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top} H${cx + bw / 2 - r} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r} V${y0 - Y(acc) - gap} Z`, fill: s.color });
        acc += v;
      });
      if (i % step === 0) add(svg, 'text', { x: cx, y: h - 8, 'text-anchor': 'middle', class: 'tick' }, l);
      const hit = add(svg, 'rect', { x: cx - slot / 2, y: y1, width: slot, height: y0 - y1, fill: 'transparent' });
      hit.onmousemove = () => showTip(tip, el, cx, y0 - Y(totals[i]), `<b>${esc(l)}</b>` + stacks.map(s => `<div><i style="background:${s.color}"></i>${esc(s.name)} <b>${fmt(s.values[i])}</b></div>`).join(''));
      hit.onmouseenter = () => hit.setAttribute('fill', 'var(--hover-col)');
      hit.onmouseleave = () => { tip.hidden = true; hit.setAttribute('fill', 'transparent'); };
    });
  }

  /** Barres horizontales classées (une série). rows: [{label, value, sub}] */
  function hbars(el, { rows, color = 'var(--s1)', fmt = short }) {
    const max = Math.max(1, ...rows.map(r => r.value));
    el.innerHTML = rows.map(r => `<div class="hbar" title="${esc(r.label)} : ${fmt(r.value)}">
      <span class="hb-l">${esc(r.label)}</span><span class="hb-t"><span style="width:${r.value / max * 100}%;background:${color}"></span></span><span class="hb-v">${fmt(r.value)}</span></div>`).join('');
  }

  const legend = series => series.length < 2 ? '' : `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;

  return { line, bars, hbars, legend, short };
})();
