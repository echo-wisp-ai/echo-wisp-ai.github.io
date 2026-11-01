# pb_web.py — thin bridge between the browser page and puzzle_box_gen2.py.
# It is loaded by app.js after puzzle_box_gen2.py is written to the
# Pyodide filesystem as /puzzle_box_gen2.py. It does not change the game.
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
