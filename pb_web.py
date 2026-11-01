# pb_web.py — thin bridge between the browser page and puzzle_box_gen2.py.
# v2 (data-first): the v1 play helpers are unchanged, and the new helpers
# below serve structured state, queries, replay, and a multi-seed survey.
# They surface only state the player could already reach one cell at a
# time; they change no rules, and they reveal no rule values.
import json
import re

_src = open('/puzzle_box_gen2.py').read()
_ns = {'__file__': '/puzzle_box_gen2.py', '__name__': 'pb_gen2'}
exec(compile(_src, '/puzzle_box_gen2.py', 'exec'), _ns)
PuzzleBoxGen2 = _ns['PuzzleBoxGen2']
box = None

def start(seed):
    global box
    box = PuzzleBoxGen2(size=12, seed=int(seed))
    return box.look()

def look():
    return box.look()

def tide():
    return box.tide_status()

def echoes():
    return box.echoes()

def forecast():
    return box.tide_forecast()

def marks():
    return box.show_marks()

def observer():
    return box.observer()

def history():
    return box.history()

def timeline():
    return box.timeline(5)

def probe(x, y):
    return box.probe(int(x), int(y))

def poke(x, y):
    return box.poke(int(x), int(y))

def wait(n):
    return box.wait(int(n))

def mark(label):
    return box.add_mark(str(label))

def observer_path():
    return box.observer_path if box is not None else ''

# ---- v2: structured state ----

def _cell_dict(x, y, cell):
    d = {
        'x': x, 'y': y, 'type': cell.type,
        'energy': round(cell.energy, 2), 'age': cell.age,
        'stability': round(cell.stability, 2),
        'lineage': list(cell.lineage),
        'transformations': cell.transformations,
        'poke_count': cell.poke_count, 'born_tick': cell.born_tick,
    }
    echo = box.echo_grid[y][x]
    if echo is not None:
        d['echo'] = {'original_type': echo.original_type,
                     'energy': round(echo.energy, 2), 'age': echo.age,
                     'vacant': cell.type == 'empty'}
    return d

def state_json():
    counts = {}
    cells = []
    for y in range(box.size):
        for x in range(box.size):
            cell = box.grid[y][x]
            counts[cell.type] = counts.get(cell.type, 0) + 1
            cells.append(_cell_dict(x, y, cell))
    data = {
        'seed': box.seed, 'size': box.size, 'tick': box.tick,
        'tide': {'phase': box._tide_phase(), 'value': round(box._tide_value(), 2)},
        'counts': counts, 'cells': cells,
        'marks': [[t, l] for t, l in box.marks],
        'observer': {'sessions': box.observer_sessions,
                     'total_probes': box.observer_total_probes,
                     'total_pokes': box.observer_total_pokes},
    }
    return json.dumps(data, indent=2)

def _fmt_cell(x, y, cell):
    echo = box.echo_grid[y][x]
    s = f"  {x:x},{y:x}  {cell.type}  e={cell.energy:.2f}  age={cell.age}  stability={cell.stability:.2f}  lineage={'->'.join(cell.lineage) if cell.lineage else '-'}"
    if echo is not None:
        s += f"  echo {echo.original_type} e={echo.energy:.2f} age={echo.age}"
    return s

def query(q):
    q = (q or '').strip().lower()
    if not q:
        return ('  Query the world. Try one of:\n'
                '    type:silt   lineage:tide   echo   vacant   strong\n'
                '    energy>3   energy<1   age>100   stability<0.3\n'
                '    restless   transformed   count')
    if q == 'count':
        from collections import Counter
        c = Counter(box.grid[y][x].type for y in range(box.size) for x in range(box.size))
        return '  Counts at t%d: %s' % (box.tick, ', '.join(f'{k} x{v}' for k, v in sorted(c.items())))
    hits = []
    if q.startswith('type:') or q.startswith('type '):
        want = q.split(':', 1)[-1].split(' ', 1)[-1].strip()
        hits = [(x, y) for y in range(box.size) for x in range(box.size)
                if box.grid[y][x].type == want]
    elif q.startswith('lineage:') or q.startswith('lineage '):
        want = q.split(':', 1)[-1].split(' ', 1)[-1].strip()
        hits = [(x, y) for y in range(box.size) for x in range(box.size)
                if want in box.grid[y][x].lineage]
    elif q in ('echo', 'echoes'):
        hits = [(x, y) for y in range(box.size) for x in range(box.size)
                if box.echo_grid[y][x] is not None]
    elif q == 'vacant':
        hits = [(x, y) for y in range(box.size) for x in range(box.size)
                if box.echo_grid[y][x] is not None and box.grid[y][x].type == 'empty']
    elif q == 'strong':
        hits = [(x, y) for y in range(box.size) for x in range(box.size)
                if box.echo_grid[y][x] is not None and box.echo_grid[y][x].energy > 0.4
                and box.grid[y][x].type == 'empty']
    elif q == 'restless':
        hits = [(x, y) for y in range(box.size) for x in range(box.size)
                if box.grid[y][x].type != 'empty'
                and (box.grid[y][x].energy >= 3.0 or box.grid[y][x].stability <= 0.3)]
    elif q == 'transformed':
        hits = [(x, y) for y in range(box.size) for x in range(box.size)
                if box.grid[y][x].transformations >= 1]
    else:
        m = re.match(r'(energy|age|stability)\s*([<>]=?)\s*([0-9.]+)$', q)
        if m:
            field, op, val = m.group(1), m.group(2), float(m.group(3))
            for y in range(box.size):
                for x in range(box.size):
                    v = getattr(box.grid[y][x], field)
                    ok = {'<': v < val, '<=': v <= val, '>': v > val, '>=': v >= val}[op]
                    if ok:
                        hits.append((x, y))
        else:
            return ('  Unknown query. Try:\n'
                    '    type:silt   lineage:tide   echo   vacant   strong\n'
                    '    energy>3   age>100   stability<0.3   restless   transformed')
    if not hits:
        return f"  Query '{q}' at t{box.tick}: no cells match."
    lines = [f"  Query '{q}' at t{box.tick} ({len(hits)} cell(s)):"]
    for x, y in hits:
        lines.append(_fmt_cell(x, y, box.grid[y][x]))
    return '\n'.join(lines)

def replay(tick):
    target = int(tick)
    if target < 0 or target > 500:
        return '  Replay tick must be 0 to 500.'
    global box
    seed = box.seed
    old_sessions = box.observer_sessions
    new_box = PuzzleBoxGen2(size=12, seed=seed)
    # A replay is not a new session: restore the session count, keep
    # the observer's marks and probe history, which the new box loaded.
    new_box.observer_sessions = old_sessions
    new_box._save_observer()
    for _ in range(target):
        new_box._step()
    box = new_box
    return (f"  Replayed seed {seed} from t0 to t{target} (clean replay:\n"
            f"  pokes are not re-armed, so a replay past a poke differs\n"
            f"  from the poked timeline).\n" + box.look())

def survey():
    seeds = [9999, 1313, 31415, 4287, 1, 2, 3, 42, 12345, 2026]
    rows = []
    for seed in seeds:
        b = PuzzleBoxGen2(size=12, seed=seed)
        last_types = tuple(c.type for row in b.grid for c in row)
        last_change = 0
        for _ in range(250):
            b._step()
            types = tuple(c.type for row in b.grid for c in row)
            if types != last_types:
                last_change = b.tick
                last_types = types
        counts = {}
        for row in b.grid:
            for c in row:
                counts[c.type] = counts.get(c.type, 0) + 1
        rows.append(f"  seed {seed}: last change t{last_change}, end {', '.join(f'{k} x{v}' for k, v in sorted(counts.items()) if k != 'empty')}")
    return '  Survey to t250 (10 seeds, fresh boxes, no pokes):\n' + '\n'.join(rows)
