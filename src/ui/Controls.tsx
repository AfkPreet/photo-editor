import { useRef } from 'react';
import type { Control, Params } from '../presets/types';

interface Props {
  controls: Control[];
  params: Params;
  onChange: (patch: Params) => void;
}

function fmt(v: number, step: number, unit?: string): string {
  const decimals = step >= 1 ? 0 : Math.min(6, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9)));
  return v.toFixed(decimals) + (unit ?? '');
}

function FileField({ label, accept, onText }: { label: string; accept: string; onText: (text: string, name: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="control" style={{ gridTemplateColumns: '1fr' }}>
      <button className="btn small" type="button" onClick={() => ref.current?.click()}>
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onText(await f.text(), f.name);
        }}
      />
    </div>
  );
}

function Field({ c, params, onChange }: { c: Exclude<Control, { kind: 'section' }>; params: Params; onChange: (p: Params) => void }) {
  switch (c.kind) {
    case 'slider': {
      const v = Number(params[c.key] ?? c.min);
      return (
        <div className="control">
          <label htmlFor={'ctl-' + c.key}>{c.label}</label>
          <span className="val">{fmt(v, c.step, c.unit)}</span>
          <input id={'ctl-' + c.key} type="range" min={c.min} max={c.max} step={c.step} value={v} onChange={(e) => onChange({ [c.key]: Number(e.target.value) })} />
        </div>
      );
    }
    case 'select':
      return (
        <div className="control">
          <label htmlFor={'ctl-' + c.key}>{c.label}</label>
          <span />
          <select id={'ctl-' + c.key} value={String(params[c.key])} onChange={(e) => onChange({ [c.key]: e.target.value })}>
            {c.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    case 'toggle':
      return (
        <div className="control toggle">
          <label htmlFor={'ctl-' + c.key}>{c.label}</label>
          <input id={'ctl-' + c.key} className="switch" type="checkbox" checked={Boolean(params[c.key])} onChange={(e) => onChange({ [c.key]: e.target.checked })} />
        </div>
      );
    case 'color':
      return (
        <div className="control">
          <label htmlFor={'ctl-' + c.key}>{c.label}</label>
          <span className="val">{String(params[c.key])}</span>
          <input id={'ctl-' + c.key} type="color" value={String(params[c.key])} onChange={(e) => onChange({ [c.key]: e.target.value })} />
        </div>
      );
    case 'file':
      return (
        <FileField
          label={c.label}
          accept={c.accept}
          onText={(text, name) => {
            const patch = c.parse(text, name);
            if (patch) onChange(patch);
            else alert('That file could not be used. Use an SVG with a single <path>.');
          }}
        />
      );
    case 'button':
      return (
        <div className="control" style={{ gridTemplateColumns: '1fr' }}>
          <button className="btn small" type="button" onClick={() => onChange(c.action(params))}>
            {c.label}
          </button>
        </div>
      );
  }
}

/** Renders a control schema. Sections become collapsible groups; controls before the first section render plainly. */
export function Controls({ controls, params, onChange }: Props) {
  const groups: { label?: string; collapsed?: boolean; items: Exclude<Control, { kind: 'section' }>[] }[] = [{ items: [] }];
  for (const c of controls) {
    if (c.kind === 'section') groups.push({ label: c.label, collapsed: c.collapsed, items: [] });
    else groups[groups.length - 1].items.push(c);
  }
  return (
    <div>
      {groups.map((g, i) =>
        g.label ? (
          <details className="group" key={g.label} open={!g.collapsed}>
            <summary>{g.label}</summary>
            {g.items.map((c) => (
              <Field key={c.key} c={c} params={params} onChange={onChange} />
            ))}
          </details>
        ) : (
          <div key={'top' + i}>
            {g.items.map((c) => (
              <Field key={c.key} c={c} params={params} onChange={onChange} />
            ))}
          </div>
        ),
      )}
    </div>
  );
}
