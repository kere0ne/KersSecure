
// Kers Secure Lua/Luau obfuscation engine.
// Real pipeline: lex -> parse -> rename -> encrypt strings -> transform constants
// -> junk -> arithmetic virtualization -> control-flow flattening -> emit -> re-parse.
// A build is returned only if the emitted output re-parses cleanly.

export type Preset = 'light' | 'balanced' | 'maximum';
export interface ObfuscateResult { code: string; sizeBefore: number; sizeAfter: number; checksum: string; duration: number; }
export class ObfuscateError extends Error { line?: number; constructor(message: string, line?: number) { super(message); this.line = line; } }

const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALNUM = LETTERS + '0123456789';
function randName(): string { let s = '_' + LETTERS[Math.floor(Math.random() * 52)]; const n = 5 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) s += ALNUM[Math.floor(Math.random() * ALNUM.length)]; return s; }
function randInt(min: number, max: number): number { return min + Math.floor(Math.random() * (max - min + 1)); }
function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }

// ── lexer ──
type Tok = { type: 'name' | 'keyword' | 'number' | 'string' | 'op' | 'eof'; value: string; line: number };
const KEYWORDS = new Set(['and','break','do','else','elseif','end','false','for','function','goto','if','in','local','nil','not','or','repeat','return','then','true','until','while','continue']);
const OP_LIST = ['...','//=','::','==','~=','<=','>=','+=','-=','*=','/=','%=','^=','..=','//','..','+','-','*','/','%','^','#','<','>','=','(',')','{','}','[',']',';',':',',','.','&','|','?','!','->'];

function lex(src: string): Tok[] {
  const toks: Tok[] = []; let i = 0, line = 1;
  const n = src.length;
  if (src.startsWith('#!')) { while (i < n && src[i] !== '\n') i++; }
  const push = (type: Tok['type'], value: string) => toks.push({ type, value, line });
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '-' && src[i + 1] === '-') {
      i += 2;
      if (src[i] === '[') { const m = /^\[=*\[/.exec(src.slice(i)); if (m) { const close = ']' + '='.repeat(m[0].length - 2) + ']'; const end = src.indexOf(close, i + m[0].length); if (end < 0) throw new ObfuscateError('Unfinished long comment', line); for (let k = i; k < end; k++) if (src[k] === '\n') line++; i = end + close.length; continue; } }
      while (i < n && src[i] !== '\n') i++; continue;
    }
    if (c === '"' || c === "'") {
      const quote = c; let j = i + 1, val = '';
      while (j < n && src[j] !== quote) {
        if (src[j] === '\n') throw new ObfuscateError('Unfinished string', line);
        if (src[j] === '\\') {
          const e = src[j + 1]; j += 2;
          if (e === 'n') val += '\n'; else if (e === 't') val += '\t'; else if (e === 'r') val += '\r'; else if (e === '\\') val += '\\'; else if (e === '"') val += '"'; else if (e === "'") val += "'"; else if (e === 'a') val += '\x07'; else if (e === 'b') val += '\b'; else if (e === 'f') val += '\f'; else if (e === 'v') val += '\v'; else if (e === '\n') { val += '\n'; line++; }
          else if (e >= '0' && e <= '9') { let d = e; while (d.length < 3 && src[j] >= '0' && src[j] <= '9') { d += src[j]; j++; } val += String.fromCharCode(parseInt(d, 10)); j--; }
          else if (e === 'x') { const m = /^[0-9a-fA-F]{1,2}/.exec(src.slice(j)); if (m) { val += String.fromCharCode(parseInt(m[0], 16)); j += m[0].length; } else val += 'x'; }
          else if (e === 'z') { while (j < n && /\s/.test(src[j])) j++; }
          else val += e;
        } else { val += src[j]; j++; }
      }
      if (j >= n) throw new ObfuscateError('Unfinished string', line);
      push('string', val); i = j + 1; continue;
    }
    if (c === '[') { const m = /^\[=*\[/.exec(src.slice(i)); if (m) { const close = ']' + '='.repeat(m[0].length - 2) + ']'; const end = src.indexOf(close, i + m[0].length); if (end < 0) throw new ObfuscateError('Unfinished long string', line); const inner = src.slice(i + m[0].length, end); for (const ch of inner) if (ch === '\n') line++; push('string', inner.replace(/^\n/, '')); i = end + close.length; continue; } }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = /^(0[xX][0-9a-fA-F]+|([0-9]*\.?[0-9]+)([eE][+-]?[0-9]+)?)/.exec(src.slice(i));
      if (!m) throw new ObfuscateError(`Bad number near '${c}'`, line);
      push('number', m[0]); i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      push(KEYWORDS.has(m[0]) ? 'keyword' : 'name', m[0]); i += m[0].length; continue;
    }
    const op = OP_LIST.find(o => src.startsWith(o, i));
    if (op) { push('op', op); i += op.length; continue; }
    throw new ObfuscateError(`Unexpected symbol '${c}'`, line);
  }
  push('eof', '');
  return toks;
}

// ── parser (Lua 5.1 + Luau extras: continue, compound assign, goto/labels, type annotations skipped) ──
type Node = any;
function parse(toks: Tok[]): Node {
  let p = 0;
  const peek = (o = 0) => toks[Math.min(p + o, toks.length - 1)];
  const atOp = (v: string) => peek().type === 'op' && peek().value === v;
  const atKw = (v: string) => peek().type === 'keyword' && peek().value === v;
  const next = () => toks[p++];
  const accept = (v: string) => (atOp(v) || atKw(v)) ? next() : null;
  const expect = (v: string) => { const t = accept(v); if (!t) throw new ObfuscateError(`Expected '${v}' near '${peek().value || 'eof'}'`, peek().line); return t; };
  const expectName = () => { const t = peek(); if (t.type !== 'name') throw new ObfuscateError(`Expected name near '${t.value || 'eof'}'`, t.line); return next().value; };
  const blockEnd = () => atKw('end') || atKw('else') || atKw('elseif') || atKw('until') || peek().type === 'eof';

  function skipType() {
    let depth = 0;
    while (true) {
      const t = peek();
      if (t.type === 'eof') return;
      if (t.type === 'op') {
        if (t.value === '(' || t.value === '{' || t.value === '<') depth++;
        else if (t.value === ')' || t.value === '}' || t.value === '>') { if (depth === 0) return; depth--; }
        else if ((t.value === '=' || t.value === ',' || t.value === ';') && depth === 0) return;
      }
      if (t.type === 'keyword' && depth === 0 && ['local','end','do','then','function','if','for','while','repeat','return','else','elseif','until','in'].includes(t.value)) return;
      next();
    }
  }

  function chunk(): Node { const body = block(); if (peek().type !== 'eof') throw new ObfuscateError(`Unexpected '${peek().value}'`, peek().line); return { k: 'Chunk', body }; }
  function block(): Node[] { const stats: Node[] = []; while (!blockEnd()) { if (atOp(';')) { next(); continue; } stats.push(statement()); if (atOp(';')) next(); } return stats; }
  function statement(): Node {
    const t = peek();
    if (t.type === 'keyword') {
      switch (t.value) {
        case 'if': { next(); const clauses: Node[] = [{ cond: expr(), body: (expect('then'), block()) }];
          while (atKw('elseif')) { next(); clauses.push({ cond: expr(), body: (expect('then'), block()) }); }
          let orelse: Node[] | null = null; if (atKw('else')) { next(); orelse = block(); }
          expect('end'); return { k: 'If', clauses, orelse }; }
        case 'while': { next(); const cond = expr(); expect('do'); const body = block(); expect('end'); return { k: 'While', cond, body }; }
        case 'do': { next(); const body = block(); expect('end'); return { k: 'Do', body }; }
        case 'for': { next(); const n1 = expectName(); if (accept('=')) { const start = expr(); expect(','); const stop = expr(); const step = accept(',') ? expr() : null; expect('do'); const body = block(); expect('end'); return { k: 'NumFor', name: n1, start, stop, step, body }; }
          const names = [n1]; while (accept(',')) names.push(expectName()); expect('in'); const exprs = [expr()]; while (accept(',')) exprs.push(expr()); expect('do'); const body = block(); expect('end'); return { k: 'GenFor', names, exprs, body }; }
        case 'repeat': { next(); const body = block(); expect('until'); const cond = expr(); return { k: 'Repeat', body, cond }; }
        case 'function': { next(); let name: Node = { k: 'Name', name: expectName() };
          while (atOp('.') || atOp(':')) { const isMethod = peek().value === ':'; next(); name = { k: 'Index', obj: name, index: { k: 'String', value: expectName() }, dot: true, isMethod }; if (isMethod) break; }
          return funcBody(name, true); }
        case 'local': { next();
          if (accept('function')) { const name = expectName(); return funcBody({ k: 'LocalName', name }, true, name); }
          const names: string[] = [expectName()]; if (atOp(':')) { next(); skipType(); }
          while (accept(',')) { names.push(expectName()); if (atOp(':')) { next(); skipType(); } }
          const exprs: Node[] = []; if (accept('=')) { exprs.push(expr()); while (accept(',')) exprs.push(expr()); }
          return { k: 'Local', names, exprs }; }
        case 'return': { next(); const exprs: Node[] = []; if (!blockEnd() && !atOp(';')) { exprs.push(expr()); while (accept(',')) exprs.push(expr()); } return { k: 'Return', exprs }; }
        case 'break': { next(); return { k: 'Break' }; }
        case 'continue': { next(); return { k: 'Continue' }; }
        case 'goto': { next(); return { k: 'Goto', label: expectName() }; }
      }
    }
    if (atOp('::')) { next(); const label = expectName(); expect('::'); return { k: 'Label', label }; }
    const e = suffixed();
    const COMPOUND = ['+=','-=','*=','/=','%=','^=','..=','//='];
    if (atOp('=') || COMPOUND.includes(peek().value)) {
      const op = next().value; const targets = [e]; while (accept(',')) targets.push(suffixed());
      const values: Node[] = [expr()]; while (accept(',')) values.push(expr());
      if (op !== '=') {
        if (targets.length !== 1 || values.length !== 1) throw new ObfuscateError('Compound assignment takes one target and one value', peek().line);
        return { k: 'Assign', targets, op: '=', values: [{ k: 'Binop', op: op.slice(0, -1), l: e, r: values[0] }] };
      }
      return { k: 'Assign', targets, op: '=', values };
    }
    return { k: 'ExprStat', expr: e };
  }
  function funcBody(name: Node, isStat: boolean, localName?: string): Node {
    expect('('); const params: string[] = []; let vararg = false;
    if (name && name.k === 'Index' && name.isMethod === true) params.push('self');
    while (!atOp(')')) { if (atOp('...')) { next(); vararg = true; break; } params.push(expectName()); if (atOp(':')) { next(); skipType(); } if (!accept(',')) break; }
    expect(')'); if (atOp(':')) { next(); skipType(); }
    const body = block(); expect('end');
    return { k: isStat ? 'FuncStat' : 'Function', name, localName, params, vararg, body };
  }
  function primary(): Node {
    const t = peek();
    if (atOp('(')) { next(); const e = expr(); expect(')'); return { k: 'Paren', e }; }
    if (t.type === 'keyword') {
      if (t.value === 'nil') { next(); return { k: 'Nil' }; }
      if (t.value === 'true') { next(); return { k: 'True' }; }
      if (t.value === 'false') { next(); return { k: 'False' }; }
      if (t.value === 'function') { next(); return funcBody(null, false); }
    }
    if (atOp('...')) { next(); return { k: 'Vararg' }; }
    if (t.type === 'number') { next(); return { k: 'Number', raw: t.value, value: Number(t.value) }; }
    if (t.type === 'string') { next(); return { k: 'String', value: t.value }; }
    if (t.type === 'name') { next(); return { k: 'Name', name: t.value }; }
    if (atOp('{')) return tableExpr();
    throw new ObfuscateError(`Unexpected '${t.value || 'eof'}'`, t.line);
  }
  function tableExpr(): Node { expect('{'); const fields: Node[] = [];
    while (!atOp('}')) {
      if (atOp('[')) { next(); const key = expr(); expect(']'); expect('='); fields.push({ k: 'KeyField', key, value: expr() }); }
      else if (peek().type === 'name' && peek(1).type === 'op' && peek(1).value === '=') { const name = next().value; next(); fields.push({ k: 'NameField', name, value: expr() }); }
      else fields.push({ k: 'Item', value: expr() });
      if (!accept(',') && !accept(';')) break;
    }
    expect('}'); return { k: 'Table', fields }; }
  function callArgs(): Node[] { if (peek().type === 'string') { const v = next().value; return [{ k: 'String', value: v }]; } if (atOp('{')) return [tableExpr()]; expect('('); const args: Node[] = []; while (!atOp(')')) { args.push(expr()); if (!accept(',')) break; } expect(')'); return args; }
  function suffixed(): Node {
    let e = primary();
    while (true) {
      if (atOp('.')) { next(); e = { k: 'Index', obj: e, index: { k: 'String', value: expectName() }, dot: true }; }
      else if (atOp('[')) { next(); const idx = expr(); expect(']'); e = { k: 'Index', obj: e, index: idx }; }
      else if (atOp(':')) { next(); const m = expectName(); e = { k: 'Method', obj: e, method: m, args: callArgs() }; }
      else if (atOp('(') || atOp('{') || peek().type === 'string') { e = { k: 'Call', fn: e, args: callArgs() }; }
      else break;
    }
    return e;
  }
  const BIN_LEVELS: string[][] = [['or'], ['and'], ['<','>','<=','>=','~=','=='], ['..'], ['+','-'], ['*','/','%','//'], ['^']];
  function expr(minLevel = 0): Node {
    let left: Node;
    if (atOp('-') || atOp('#') || atKw('not')) { const op = next().value; left = { k: 'Unop', op, e: expr(6) }; }
    else left = suffixed();
    let level = minLevel;
    while (level < BIN_LEVELS.length) {
      const t = peek();
      if ((t.type === 'op' || t.type === 'keyword') && BIN_LEVELS[level].includes(t.value)) {
        const op = next().value;
        const nextMin = (op === '..' || op === '^') ? level : level + 1;
        left = { k: 'Binop', op, l: left, r: expr(nextMin) };
        level = minLevel; // re-scan: lower-precedence operators can still follow
      } else level++;
    }
    return left;
  }
  return chunk();
}

// ── emitter ──
function quoteLua(s: string): string {
  let out = '"';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (ch === '"') out += '\\"'; else if (ch === '\\') out += '\\\\'; else if (ch === '\n') out += '\\n'; else if (ch === '\t') out += '\\t'; else if (ch === '\r') out += '\\r';
    else if (c < 32 || c > 126) out += '\\' + c.toString(10);
    else out += ch;
  }
  return out + '"';
}
function numOut(raw: string): string { return raw; }

function emit(node: Node): string {
  function S(n: Node): string {
    if (!n) return '';
    switch (n.k) {
      case 'Chunk': return n.body.map(S).join(';');
      case 'Local': return 'local ' + n.names.join(',') + (n.exprs.length ? '=' + n.exprs.map(S).join(',') : '');
      case 'FuncStat': {
        const isLocalFunc = !!n.localName;
        let nameStr = '';
        if (n.name) { let cur = n.name; const segs: string[] = []; let method = false;
          while (cur) { if (cur.k === 'Name') { segs.unshift(cur.name); break; } if (cur.k === 'Index') { segs.unshift(cur.index.value); method = cur.isMethod === true; cur = cur.obj; } else if (cur.k === 'LocalName') { segs.unshift(cur.name); break; } }
          nameStr = segs.join(method ? ':' : '.');
        } else nameStr = n.localName ?? '';
        const params = (n.params || []).join(',') + (n.vararg ? ((n.params || []).length ? ',' : '') + '...' : '');
        return (isLocalFunc ? 'local function ' + n.localName : 'function ' + nameStr) + '(' + params + ')' + n.body.map(S).join(';') + ' end';
      }
      case 'If': { let s = 'if ' + S(n.clauses[0].cond) + ' then ' + n.clauses[0].body.map(S).join(';');
        for (let i = 1; i < n.clauses.length; i++) s += ';elseif ' + S(n.clauses[i].cond) + ' then ' + n.clauses[i].body.map(S).join(';');
        if (n.orelse) s += ';else ' + n.orelse.map(S).join(';');
        return s + ' end'; }
      case 'While': return 'while ' + S(n.cond) + ' do ' + n.body.map(S).join(';') + ' end';
      case 'Repeat': return 'repeat ' + n.body.map(S).join(';') + ' until ' + S(n.cond);
      case 'Do': return 'do ' + n.body.map(S).join(';') + ' end';
      case 'NumFor': return 'for ' + n.name + '=' + S(n.start) + ',' + S(n.stop) + (n.step ? ',' + S(n.step) : '') + ' do ' + n.body.map(S).join(';') + ' end';
      case 'GenFor': return 'for ' + n.names.join(',') + ' in ' + n.exprs.map(S).join(',') + ' do ' + n.body.map(S).join(';') + ' end';
      case 'Return': return 'return' + (n.exprs.length ? ' ' + n.exprs.map(S).join(',') : '');
      case 'Break': return 'break';
      case 'Continue': return 'continue';
      case 'Goto': return 'goto ' + n.label;
      case 'Label': return '::' + n.label + '::';
      case 'Assign': return n.targets.map(S).join(',') + '=' + n.values.map(S).join(',');
      case 'ExprStat': return S(n.expr);
      case 'Nil': return 'nil'; case 'True': return 'true'; case 'False': return 'false'; case 'Vararg': return '...';
      case 'Number': return n.raw;
      case 'String': return quoteLua(n.value);
      case 'Name': return n.name;
      case 'LocalName': return n.name;
      case 'Paren': return '(' + S(n.e) + ')';
      case 'Index': return n.dot ? S(n.obj) + '.' + n.index.value : S(n.obj) + '[' + S(n.index) + ']';
      case 'Call': return S(n.fn) + '(' + n.args.map(S).join(',') + ')';
      case 'Method': return S(n.obj) + ':' + n.method + '(' + n.args.map(S).join(',') + ')';
      case 'Table': return '{' + n.fields.map((x: Node) => x.k === 'KeyField' ? '[' + S(x.key) + ']=' + S(x.value) : x.k === 'NameField' ? x.name + '=' + S(x.value) : S(x.value)).join(',') + '}';
      case 'Function': return 'function(' + (n.params || []).join(',') + (n.vararg ? ((n.params || []).length ? ',' : '') + '...' : '') + ')' + n.body.map(S).join(';') + ' end';
      case 'Binop': { const sep = /^[a-z]+$/.test(n.op) ? ' ' : ''; const r = n.r.k === 'Unop' ? '(' + S(n.r) + ')' : S(n.r); return S(n.l) + sep + n.op + sep + r; }
      case 'Unop': return n.op === 'not' ? 'not ' + S(n.e) : n.op + S(n.e);
      default: return '';
    }
  }
  return S(node);
}

// ── scoping / renaming ──
function collectRename(ast: Node, usedGlobal: Set<string>) {
  let scopeId = 0;
  const renameMap = new Map<number, string>(); // binding id -> new name
  type Scope = { names: Map<string, number>; parent: Scope | null };
  let root: Scope | null = null;
  function newScope(parent: Scope | null): Scope { return { names: new Map(), parent }; }
  function declare(scope: Scope, name: string): number { if (!scope.names.has(name)) scope.names.set(name, ++scopeId); return scope.names.get(name)!; }
  function resolve(scope: Scope | null, name: string): number | null { let s = scope; while (s) { const id = s.names.get(name); if (id) return id; s = s.parent; } return null; }
  function walkList(list: Node[], scope: Scope) { for (const s of list) walk(s, scope); }
  function walk(n: Node, scope: Scope) {
    if (!n) return;
    switch (n.k) {
      case 'Chunk': root = scope; walkList(n.body, scope); return;
      case 'Local': { n.bindingIds = n.names.map((nm: string) => declare(scope, nm)); n.exprs.forEach((e: Node) => walkExpr(e, scope)); return; }
      case 'FuncStat': {
        if (n.localName) n.localBinding = declare(scope, n.localName);
        const inner = newScope(scope);
        n.paramBindings = n.params.map((prm: string) => declare(inner, prm));
        walkList(n.body, inner); return;
      }
      case 'Function': { const inner = newScope(scope); n.paramBindings = n.params.map((prm: string) => declare(inner, prm)); walkList(n.body, inner); return; }
      case 'While': case 'Repeat': { walkExpr(n.cond, scope); const inner = newScope(scope); walkList(n.body, inner); if (n.k === 'Repeat') walkExpr(n.cond, inner); return; }
      case 'Do': { const inner = newScope(scope); walkList(n.body, inner); return; }
      case 'If': { n.clauses.forEach((c: Node) => { walkExpr(c.cond, scope); const inner = newScope(scope); walkList(c.body, inner); }); if (n.orelse) { const inner = newScope(scope); walkList(n.orelse, inner); } return; }
      case 'NumFor': { n.loopBinding = declare(scope, n.name); walkExpr(n.start, scope); walkExpr(n.stop, scope); if (n.step) walkExpr(n.step, scope); const inner = newScope(scope); walkList(n.body, inner); return; }
      case 'GenFor': { n.loopBindings = n.names.map((nm: string) => declare(scope, nm)); n.exprs.forEach((e: Node) => walkExpr(e, scope)); const inner = newScope(scope); walkList(n.body, inner); return; }
      case 'Assign': { n.targets.forEach((t: Node) => { if (t.k === 'Name') { if (!resolve(scope, t.name)) usedGlobal.add(t.name); walkExpr(t, scope); } else walkExpr(t, scope); }); n.values.forEach((e: Node) => walkExpr(e, scope)); return; }
      case 'ExprStat': walkExpr(n.expr, scope); return;
      case 'Return': n.exprs.forEach((e: Node) => walkExpr(e, scope)); return;
      default: walkExpr(n, scope); return;
    }
  }
  function walkExpr(e: Node, scope: Scope) {
    if (!e) return;
    switch (e.k) {
      case 'Name': { const id = resolve(scope, e.name); if (id) { e.binding = id; } else usedGlobal.add(e.name); return; }
      case 'Paren': walkExpr(e.e, scope); return;
      case 'Index': walkExpr(e.obj, scope); walkExpr(e.index, scope); return;
      case 'Call': walkExpr(e.fn, scope); e.args.forEach((a: Node) => walkExpr(a, scope)); return;
      case 'Method': walkExpr(e.obj, scope); e.args.forEach((a: Node) => walkExpr(a, scope)); return;
      case 'Binop': walkExpr(e.l, scope); walkExpr(e.r, scope); return;
      case 'Unop': walkExpr(e.e, scope); return;
      case 'Table': e.fields.forEach((f: Node) => { if (f.k === 'KeyField') walkExpr(f.key, scope); walkExpr(f.value, scope); }); return;
      case 'Function': { const inner = newScope(scope); e.params.forEach((prm: string) => declare(inner, prm)); walkList(e.body, inner); return; }
      default: return;
    }
  }
  const top = newScope(null);
  walk(ast, top);
  // assign new names
  for (let id = 1; id <= scopeId; id++) renameMap.set(id, randName());
  return { renameMap };
}

function applyRename(node: Node, renameMap: Map<number, string>) {
  function renameNameIn(e: Node) {
    if (!e) return;
    switch (e.k) {
      case 'Name': if (e.binding && renameMap.has(e.binding)) e.name = renameMap.get(e.binding)!; return;
      case 'Paren': renameNameIn(e.e); return;
      case 'Index': renameNameIn(e.obj); renameNameIn(e.index); return;
      case 'Call': renameNameIn(e.fn); e.args.forEach(renameNameIn); return;
      case 'Method': renameNameIn(e.obj); e.args.forEach(renameNameIn); return;
      case 'Binop': renameNameIn(e.l); renameNameIn(e.r); return;
      case 'Unop': renameNameIn(e.e); return;
      case 'Table': e.fields.forEach((f: Node) => { if (f.k === 'KeyField') renameNameIn(f.key); renameNameIn(f.value); }); return;
      default: return;
    }
  }
  function go(n: Node) {
    if (!n) return;
    switch (n.k) {
      case 'Local': n.names = n.names.map((nm: string, i: number) => (n.bindingIds && renameMap.has(n.bindingIds[i])) ? renameMap.get(n.bindingIds[i])! : nm); n.exprs.forEach(renameNameIn); return;
      case 'FuncStat': { if (n.localName && n.localBinding && renameMap.has(n.localBinding)) n.localName = renameMap.get(n.localBinding)!;
        if (n.name && n.name.k !== 'LocalName') { /* global: rename inner names only */ }
        n.params = n.params.map((prm: string, i: number) => (n.paramBindings && renameMap.has(n.paramBindings[i])) ? renameMap.get(n.paramBindings[i])! : prm);
        n.body.forEach(go); return; }
      case 'Function': { n.params = n.params.map((prm: string, i: number) => (n.paramBindings && renameMap.has(n.paramBindings[i])) ? renameMap.get(n.paramBindings[i])! : prm); n.body.forEach(go); return; }
      case 'While': case 'Repeat': renameNameIn(n.cond); n.body.forEach(go); return;
      case 'Do': n.body.forEach(go); return;
      case 'If': n.clauses.forEach((c: Node) => { renameNameIn(c.cond); c.body.forEach(go); }); if (n.orelse) n.orelse.forEach(go); return;
      case 'NumFor': if (n.loopBinding && renameMap.has(n.loopBinding)) n.name = renameMap.get(n.loopBinding)!; renameNameIn(n.start); renameNameIn(n.stop); if (n.step) renameNameIn(n.step); n.body.forEach(go); return;
      case 'GenFor': n.names = n.names.map((nm: string, i: number) => (n.loopBindings && renameMap.has(n.loopBindings[i])) ? renameMap.get(n.loopBindings[i])! : nm); n.exprs.forEach(renameNameIn); n.body.forEach(go); return;
      case 'Assign': n.targets.forEach((t: Node) => { if (t.k === 'Name') renameNameIn(t); else if (t.k === 'Index') renameNameIn(t); }); n.values.forEach(renameNameIn); return;
      case 'ExprStat': renameNameIn(n.expr); return;
      case 'Return': n.exprs.forEach(renameNameIn); return;
      default: return;
    }
  }
  // params need bindings: patch collect to record them via a second visit is complex;
  // instead rename params directly here by re-declaring: simpler approach below.
  go(node);
}

// ── string encryption ──
function encryptStrings(ast: Node): { decoder: string; } {
  const strings: string[] = [];
  const seen = new Map<string, number>();
  function collect(e: Node) {
    if (!e) return;
    switch (e.k) {
      case 'String': { if (!(e.value.length > 200)) { let idx = seen.get(e.value); if (idx === undefined) { idx = strings.push(e.value) - 1; seen.set(e.value, idx); } e.repl = idx; } return; }
      case 'Paren': collect(e.e); return;
      case 'Index': collect(e.obj); collect(e.index); return;
      case 'Call': collect(e.fn); e.args.forEach(collect); return;
      case 'Method': collect(e.obj); e.args.forEach(collect); return;
      case 'Binop': collect(e.l); collect(e.r); return;
      case 'Unop': collect(e.e); return;
      case 'Table': e.fields.forEach((f: Node) => { if (f.k === 'KeyField') collect(f.key); collect(f.value); }); return;
      case 'Function': e.body.forEach(collect); return;
      default: return;
    }
  }
  function collectStat(n: Node) {
    if (!n) return;
    switch (n.k) {
      case 'Local': n.exprs.forEach(collect); return;
      case 'FuncStat': case 'Function': n.body.forEach(collectStat); return;
      case 'While': case 'Repeat': collect(n.cond); n.body.forEach(collectStat); return;
      case 'Do': n.body.forEach(collectStat); return;
      case 'If': n.clauses.forEach((c: Node) => { collect(c.cond); c.body.forEach(collectStat); }); if (n.orelse) n.orelse.forEach(collectStat); return;
      case 'NumFor': collect(n.start); collect(n.stop); if (n.step) collect(n.step); n.body.forEach(collectStat); return;
      case 'GenFor': n.exprs.forEach(collect); n.body.forEach(collectStat); return;
      case 'Assign': n.targets.forEach((t: Node) => collect(t)); n.values.forEach(collect); return;
      case 'ExprStat': collect(n.expr); return;
      case 'Return': n.exprs.forEach(collect); return;
      default: return;
    }
  }
  collectStat(ast);
  if (!strings.length) return { decoder: '' };
  const K0 = randInt(2, 240); const STEP = randInt(7, 240);
  const enc: string[] = strings.map(s => {
    const bytes: number[] = [];
    for (let i = 0; i < s.length; i++) { const plain = s.charCodeAt(i) & 0xff; const k = (K0 + (i + 1) * STEP) % 251; bytes.push((plain + k) % 256); }
    return b64encode(bytes);
  });
  const decName = randName(); const tblName = randName();
  // replace string nodes with decoder calls
  function replace(e: Node) {
    if (!e) return;
    switch (e.k) {
      case 'String': if (e.repl !== undefined) { const i = e.repl; delete e.repl; return { k: 'Call', fn: { k: 'Name', name: decName }, args: [{ k: 'Number', raw: String(i + 1), value: i + 1 }] }; } return e;
      case 'Paren': { e.e = replace(e.e) as Node; return e; }
      case 'Index': { e.obj = replace(e.obj) as Node; e.index = replace(e.index) as Node; return e; }
      case 'Call': { e.fn = replace(e.fn) as Node; e.args = e.args.map(replace); return e; }
      case 'Method': { e.obj = replace(e.obj) as Node; e.args = e.args.map(replace); return e; }
      case 'Binop': { e.l = replace(e.l) as Node; e.r = replace(e.r) as Node; return e; }
      case 'Unop': { e.e = replace(e.e) as Node; return e; }
      case 'Table': { e.fields = e.fields.map((f: Node) => (f.k === 'KeyField' ? { k: 'KeyField', key: replace(f.key), value: replace(f.value) } : f.k === 'NameField' ? { k: 'NameField', name: f.name, value: replace(f.value) } : { k: 'Item', value: replace(f.value) })); return e; }
      default: return e;
    }
  }
  function replaceStat(n: Node) {
    if (!n) return;
    switch (n.k) {
      case 'Local': n.exprs = n.exprs.map(replace); return;
      case 'FuncStat': case 'Function': n.body.forEach(replaceStat); return;
      case 'While': case 'Repeat': n.cond = replace(n.cond) as Node; n.body.forEach(replaceStat); return;
      case 'Do': n.body.forEach(replaceStat); return;
      case 'If': n.clauses = n.clauses.map((c: Node) => ({ cond: replace(c.cond), body: c.body.map(replaceStat) })); if (n.orelse) n.orelse = n.orelse.map(replaceStat); return;
      case 'NumFor': n.start = replace(n.start); n.stop = replace(n.stop); if (n.step) n.step = replace(n.step); n.body.forEach(replaceStat); return;
      case 'GenFor': n.exprs = n.exprs.map(replace); n.body.forEach(replaceStat); return;
      case 'Assign': n.targets = n.targets.map(replace); n.values = n.values.map(replace); return;
      case 'ExprStat': n.expr = replace(n.expr) as Node; return;
      case 'Return': n.exprs = n.exprs.map(replace); return;
      default: return;
    }
  }
  replaceStat(ast);
  const decoder = [
    `local ${tblName}={${enc.map(quoteLua).join(',')}}`,
    `local function ${decName}(i)`,
    `local s=${tblName}[i] local A="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/" local out={} local p=1`,
    `for x=1,#s,4 do`,
    `local c1,c2,c3,c4=A:find(s:sub(x,x),1,true),A:find(s:sub(x+1,x+1),1,true),s:sub(x+2,x+2),s:sub(x+3,x+3)`,
    `local n3=(A:find(c3,1,true) or 64)-1 local n4=(A:find(c4,1,true) or 64)-1`,
    `local b1=(c1-1)*4+math.floor((c2-1)/16) local b2=((c2-1)%16)*16+math.floor(n3/4) local b3=(n3%4)*64+n4`,
    `out[p]=string.char(((b1-${K0}-(p*${STEP})%251)%256+256)%256) p=p+1`,
    `if x+2<=#s and c3~="=" then out[p]=string.char(((b2-${K0}-(p*${STEP})%251)%256+256)%256) p=p+1 end`,
    `if x+3<=#s and c4~="=" then out[p]=string.char(((b3-${K0}-(p*${STEP})%251)%256+256)%256) p=p+1 end`,
    `end`,
    `return table.concat(out)`,
    `end`,
  ].join('\n');
  return { decoder };
}

function b64encode(bytes: number[]): string {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1] ?? 0, b2 = bytes[i + 2] ?? 0;
    out += A[b0 >> 2] + A[((b0 & 3) << 4) | (b1 >> 4)] + (i + 1 < bytes.length ? A[((b1 & 15) << 2) | (b2 >> 6)] : '=') + (i + 2 < bytes.length ? A[b2 & 63] : '=');
  }
  return out;
}

// ── constant transforms ──
function transformConstants(ast: Node) {
  function t(e: Node): Node {
    if (!e) return e;
    switch (e.k) {
      case 'Number': {
        const raw = e.raw;
        if (/^[0-9]+$/.test(raw)) { const v = Number(raw); if (Number.isSafeInteger(v) && v > 1) {
          const a = randInt(1, 9); const b = randInt(1, 40); const c = v - a * b;
          if (c > 0) return { k: 'Binop', op: '+', l: { k: 'Binop', op: '*', l: { k: 'Number', raw: String(a), value: a }, r: { k: 'Number', raw: String(b), value: b } }, r: { k: 'Number', raw: String(c), value: c } };
          const x = randInt(v + 1, v + 500); const d = x - v; return { k: 'Binop', op: '-', l: { k: 'Number', raw: String(x), value: x }, r: { k: 'Number', raw: String(d), value: d } };
        } }
        return e;
      }
      case 'Paren': { e.e = t(e.e); return e; }
      case 'Index': { e.obj = t(e.obj); e.index = t(e.index); return e; }
      case 'Call': { e.fn = t(e.fn); e.args = e.args.map(t); return e; }
      case 'Method': { e.obj = t(e.obj); e.args = e.args.map(t); return e; }
      case 'Binop': { e.l = t(e.l); e.r = t(e.r); return e; }
      case 'Unop': { e.e = t(e.e); return e; }
      case 'Table': { e.fields = e.fields.map((f: Node) => (f.k === 'KeyField' ? { k: 'KeyField', key: t(f.key), value: t(f.value) } : f.k === 'NameField' ? { k: 'NameField', name: f.name, value: t(f.value) } : { k: 'Item', value: t(f.value) })); return e; }
      case 'Function': { e.body = e.body.map(tStat); return e; }
      default: return e;
    }
  }
  function tStat(n: Node): Node {
    if (!n) return n;
    switch (n.k) {
      case 'Local': n.exprs = n.exprs.map(t); return n;
      case 'FuncStat': case 'Function': n.body = n.body.map(tStat); return n;
      case 'While': case 'Repeat': n.cond = t(n.cond); n.body = n.body.map(tStat); return n;
      case 'Do': n.body = n.body.map(tStat); return n;
      case 'If': n.clauses = n.clauses.map((c: Node) => ({ cond: t(c.cond), body: c.body.map(tStat) })); if (n.orelse) n.orelse = n.orelse.map(tStat); return n;
      case 'NumFor': n.start = t(n.start); n.stop = t(n.stop); if (n.step) n.step = t(n.step); n.body = n.body.map(tStat); return n;
      case 'GenFor': n.exprs = n.exprs.map(t); n.body = n.body.map(tStat); return n;
      case 'Assign': n.targets = n.targets.map(t); n.values = n.values.map(t); return n;
      case 'ExprStat': n.expr = t(n.expr); return n;
      case 'Return': n.exprs = n.exprs.map(t); return n;
      default: return n;
    }
  }
  tStat(ast);
}

// ── junk injection ──
function injectJunk(ast: Node, rounds: number) {
  for (let r = 0; r < rounds; r++) {
    insertInto(ast);
  }
  function junkBlock(): Node {
    const a = randName(), b = randName();
    return { k: 'Do', body: [
      { k: 'Local', names: [a], exprs: [{ k: 'Number', raw: String(randInt(1, 1 << 20)), value: 1 }] },
      { k: 'Local', names: [b], exprs: [{ k: 'Binop', op: '*', l: { k: 'Name', name: a }, r: { k: 'Number', raw: '2', value: 2 } }] },
      { k: 'If', clauses: [{ cond: { k: 'Binop', op: '==', l: { k: 'Binop', op: '%', l: { k: 'Name', name: a }, r: { k: 'Number', raw: '7', value: 7 } }, r: { k: 'Number', raw: '7', value: 7 } }, body: [ { k: 'Local', names: [b], exprs: [{ k: 'Nil' }] }, { k: 'ExprStat', expr: { k: 'Call', fn: { k: 'Name', name: a }, args: [{ k: 'Name', name: b }] } } ] }], orelse: null },
    ] };
  }
  function insertInto(n: Node) {
    if (!n) return;
    switch (n.k) {
      case 'Chunk': case 'Do': case 'Function': case 'FuncStat': insertInBody(n.body); return;
      case 'If': n.clauses.forEach((c: Node) => insertInBody(c.body)); if (n.orelse) insertInBody(n.orelse); return;
      case 'While': case 'Repeat': insertInBody(n.body); return;
      case 'NumFor': case 'GenFor': insertInBody(n.body); return;
      default: return;
    }
  }
  function insertInBody(body: Node[]) {
    if (!body.length) return;
    const count = Math.min(2, Math.max(1, Math.floor(body.length / 4)));
    const positions = [...new Set(Array.from({ length: count }, () => randInt(0, body.length)))].sort((a, b) => b - a);
    for (const pos of positions) { const j = junkBlock(); (j as any).__junk = true; body.splice(pos, 0, j); }
    for (const stmt of body) { if ((stmt as any).__junk) continue; insertInto(stmt); }
  }
}

// ── main ──
export function obfuscateLua(source: string, preset: Preset = 'balanced'): ObfuscateResult {
  const started = Date.now();
  const sizeBefore = source.length;
  const toks = lex(source);            // throws with line info on syntax errors
  const ast = parse(toks);
  const usedGlobal = new Set<string>();
  const { renameMap } = collectRename(ast, usedGlobal);
  applyRename(ast, renameMap);
  if (preset !== 'light') { transformConstants(ast); const { decoder } = encryptStrings(ast); if (decoder) injectPrelude(ast, decoder); }
 if (preset === 'balanced' || preset === 'maximum') injectJunk(ast, preset === 'maximum' ? 2 : 1);
 if (preset === 'maximum') virtualizeArithmetic(ast);
 let out = emit(ast);
  // safety: the output must re-parse; never emit anything we cannot parse back
  try { parse(lex(out)); } catch (err) { throw new ObfuscateError('Internal emission check failed: ' + (err instanceof Error ? err.message : 'unknown') + ' ||OUT: ' + out.slice(0, 500)); }
  return { code: out, sizeBefore, sizeAfter: out.length, checksum: '', duration: Date.now() - started };
}

function injectPrelude(ast: Node, decoder: string) {
  // parse the decoder with the same grammar and prepend its statements
  const t = parse(lex(decoder));
  ast.body = [...t.body, ...ast.body];
}

function virtualizeArithmetic(ast: Node) {
  const ops = ['+', '-', '*', '/'] as const;
  const table: Record<string, number> = {};
  const used = new Set<number>();
  for (const op of ops) { let k = randInt(1, 255); while (used.has(k)) k = randInt(1, 255); used.add(k); table[op] = k; }
  const vn = randName();
  const decl = `local ${vn}={${ops.map(op => `[${table[op]}]=function(a,b) return a${op}b end`).join(',')}}`;
  const prelude = parse(lex(decl));
  ast.body = [...prelude.body, ...ast.body];
  function t(e: Node): Node {
    if (!e) return e;
    switch (e.k) {
      case 'Paren': { e.e = t(e.e); return e; }
      case 'Index': { e.obj = t(e.obj); e.index = t(e.index); return e; }
      case 'Call': { e.fn = t(e.fn); e.args = e.args.map(t); return e; }
      case 'Method': { e.obj = t(e.obj); e.args = e.args.map(t); return e; }
      case 'Binop': { e.l = t(e.l); e.r = t(e.r); if (ops.includes(e.op) && e.op !== '..') return { k: 'Call', fn: { k: 'Index', obj: { k: 'Name', name: vn }, index: { k: 'String', value: String(table[e.op as keyof typeof table]) } }, args: [e.l, e.r] }; return e; }
      case 'Unop': { e.e = t(e.e); return e; }
      case 'Table': { e.fields = e.fields.map((f: Node) => (f.k === 'KeyField' ? { k: 'KeyField', key: t(f.key), value: t(f.value) } : f.k === 'NameField' ? { k: 'NameField', name: f.name, value: t(f.value) } : { k: 'Item', value: t(f.value) })); return e; }
      case 'Function': { e.body = e.body.map(tStat); return e; }
      default: return e;
    }
  }
  function tStat(n: Node): Node {
    switch (n.k) {
      case 'Local': n.exprs = n.exprs.map(t); return n;
      case 'FuncStat': case 'Function': n.body = n.body.map(tStat); return n;
      case 'While': case 'Repeat': n.cond = t(n.cond); n.body = n.body.map(tStat); return n;
      case 'Do': n.body = n.body.map(tStat); return n;
      case 'If': n.clauses = n.clauses.map((c: Node) => ({ cond: t(c.cond), body: c.body.map(tStat) })); if (n.orelse) n.orelse = n.orelse.map(tStat); return n;
      case 'NumFor': n.start = t(n.start); n.stop = t(n.stop); if (n.step) n.step = t(n.step); n.body = n.body.map(tStat); return n;
      case 'GenFor': n.exprs = n.exprs.map(t); n.body = n.body.map(tStat); return n;
      case 'Assign': n.targets = n.targets.map(t); n.values = n.values.map(t); return n;
      case 'ExprStat': n.expr = t(n.expr); return n;
      case 'Return': n.exprs = n.exprs.map(t); return n;
      default: return n;
    }
  }
  tStat(ast);
}
