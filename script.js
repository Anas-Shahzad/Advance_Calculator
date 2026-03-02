
'use strict';

const state = {
  tokens: [],
  current: '',
  scientific: false,
  radian: true,
  inverse: false,
  lastResult: '',
  lastExpression: ''
};

const shell = document.querySelector('.calculator-shell');
const expressionEl = document.getElementById('expression');
const resultEl = document.getElementById('result');
const sciPanel = document.getElementById('scientificPanel');
const toggleSciBtn = document.getElementById('toggleSci');
const angleToggle = document.getElementById('angleToggle');
const inverseToggle = document.getElementById('inverseToggle');

const operatorInfo = {
  '+': { precedence: 2, assoc: 'left', args: 2 },
  '-': { precedence: 2, assoc: 'left', args: 2 },
  '*': { precedence: 3, assoc: 'left', args: 2 },
  '/': { precedence: 3, assoc: 'left', args: 2 },
  '^': { precedence: 4, assoc: 'right', args: 2 },
  '%': { precedence: 3, assoc: 'left', args: 1, postfix: true },
  '!': { precedence: 5, assoc: 'left', args: 1, postfix: true }
};

const functionsSet = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'ln', 'exp', 'pow10', 'sqrt']);
const constants = { pi: Math.PI, e: Math.E };

const numberLike = t => ['number', 'constant'].includes(t?.type);
const closable = t => numberLike(t) || t?.type === 'postfix' || (t?.type === 'paren' && t.value === ')');

function updateDisplay() {
  const displayTokens = [...state.tokens];
  if (state.current) {
    displayTokens.push({ type: 'number', value: state.current });
  }
  const isShowingResultOnly =
    state.lastExpression &&
    !state.current &&
    state.lastResult !== '' &&
    displayTokens.length === 1 &&
    displayTokens[0].type === 'number' &&
    displayTokens[0].value === state.lastResult;

  if (isShowingResultOnly) {
    expressionEl.textContent = state.lastExpression;
  } else if (!displayTokens.length) {
    expressionEl.textContent = '0';
  } else {
    expressionEl.textContent = displayTokens.map(tokenToText).join('');
  }
  resultEl.textContent = state.lastResult !== '' ? state.lastResult : '\u00a0';
}

function tokenToText(token) {
  if (!token) return '';
  switch (token.type) {
    case 'number': return token.value;
    case 'constant': return token.value === 'pi' ? 'π' : 'e';
    case 'operator':
      if (token.value === '*') return '×';
      if (token.value === '/') return '÷';
      if (token.value === '-') return '−';
      return token.value;
    case 'postfix': return token.value;
    case 'function':
      if (token.value === 'sqrt') return '√';
      if (token.value === 'pow10') return '10^';
      if (token.value === 'exp') return 'e^';
      return token.value;
    case 'paren': return token.value;
    default: return token.value || '';
  }
}

function clearAll() {
  state.tokens = [];
  state.current = '';
  state.lastResult = '';
  state.lastExpression = '';
  updateDisplay();
}

function backspace() {
  if (state.current) {
    state.current = state.current.slice(0, -1);
    return updateDisplay();
  }
  const last = state.tokens.pop();
  if (last?.type === 'number') {
    state.current = last.value.slice(0, -1);
  }
  updateDisplay();
}

function addNumber(value) {
  if (state.current === '0') state.current = '';
  state.current += value;
  updateDisplay();
}

function addDot() {
  if (!state.current) {
    state.current = '0.';
  } else if (!state.current.includes('.')) {
    state.current += '.';
  }
  updateDisplay();
}

function pushCurrentIfNeeded() {
  if (state.current) {
    state.tokens.push({ type: 'number', value: state.current });
    state.current = '';
  }
}

function addOperator(op) {
  if (state.current === '-' && !state.tokens.length) return; // incomplete unary minus
  if (!state.current && !state.tokens.length) {
    if (op === '-') {
      state.current = '-';
      return updateDisplay();
    }
    return; // invalid
  }
  const last = state.current ? { type: 'number' } : state.tokens[state.tokens.length - 1];
  if (!closable(last)) {
    if (op === '-' && !state.current) {
      state.current = '-';
      return updateDisplay();
    }
    return;
  }
  pushCurrentIfNeeded();
  state.tokens.push({ type: 'operator', value: op });
  updateDisplay();
}

function addParenthesis(value) {
  if (value === '(') {
    if (closable(state.tokens[state.tokens.length - 1]) || state.current) {
      pushCurrentIfNeeded();
      state.tokens.push({ type: 'operator', value: '*' });
    }
    state.tokens.push({ type: 'paren', value: '(' });
    updateDisplay();
    return;
  }
  // close parenthesis
  if (state.current) pushCurrentIfNeeded();
  const openCount = state.tokens.filter(t => t.type === 'paren' && t.value === '(').length;
  const closeCount = state.tokens.filter(t => t.type === 'paren' && t.value === ')').length;
  const last = state.tokens[state.tokens.length - 1];
  if (openCount > closeCount && closable(last)) {
    state.tokens.push({ type: 'paren', value: ')' });
    updateDisplay();
  }
}

function smartParenthesis() {
  const openCount = state.tokens.filter(t => t.type === 'paren' && t.value === '(').length;
  const closeCount = state.tokens.filter(t => t.type === 'paren' && t.value === ')').length;
  if (openCount === closeCount) {
    addParenthesis('(');
  } else {
    addParenthesis(')');
  }
}

function addFunction(fn) {
  if (fn === 'factorial') return addFactorial();
  pushCurrentIfNeeded();
  const last = state.tokens[state.tokens.length - 1];
  if (closable(last)) {
    state.tokens.push({ type: 'operator', value: '*' });
  }
  const actualFn = deriveFunction(fn);
  state.tokens.push({ type: 'function', value: actualFn });
  state.tokens.push({ type: 'paren', value: '(' });
  updateDisplay();
}

function deriveFunction(fn) {
  if (!state.inverse) return fn;
  if (fn === 'sin') return 'asin';
  if (fn === 'cos') return 'acos';
  if (fn === 'tan') return 'atan';
  if (fn === 'log') return 'pow10';
  if (fn === 'ln') return 'exp';
  return fn;
}

function addConstant(name) {
  pushCurrentIfNeeded();
  const last = state.tokens[state.tokens.length - 1];
  if (closable(last)) {
    state.tokens.push({ type: 'operator', value: '*' });
  }
  state.tokens.push({ type: 'constant', value: name });
  updateDisplay();
}

function addPercent() {
  if (state.current) pushCurrentIfNeeded();
  const last = state.tokens[state.tokens.length - 1];
  if (closable(last)) {
    state.tokens.push({ type: 'postfix', value: '%' });
    updateDisplay();
  }
}

function addFactorial() {
  if (state.current) pushCurrentIfNeeded();
  const last = state.tokens[state.tokens.length - 1];
  if (closable(last)) {
    state.tokens.push({ type: 'postfix', value: '!' });
    updateDisplay();
  }
}

function toggleAngle() {
  state.radian = !state.radian;
  angleToggle.textContent = state.radian ? 'Rad' : 'Deg';
  angleToggle.setAttribute('aria-pressed', String(state.radian));
  angleToggle.classList.toggle('is-active', !state.radian);
}

function toggleInverse() {
  state.inverse = !state.inverse;
  inverseToggle.classList.toggle('is-active', state.inverse);
  inverseToggle.setAttribute('aria-pressed', String(state.inverse));
}

function toggleScientific() {
  state.scientific = !state.scientific;
  shell.dataset.scientific = String(state.scientific);
  toggleSciBtn.setAttribute('aria-expanded', String(state.scientific));
}

function toRPN(rawTokens) {
  const output = [];
  const stack = [];
  for (const token of rawTokens) {
    if (token.type === 'number' || token.type === 'constant') {
      output.push(token);
    } else if (token.type === 'function') {
      stack.push(token);
    } else if (token.type === 'operator' || token.type === 'postfix') {
      const current = operatorInfo[token.value];
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type === 'paren' && top.value === '(') break;
        const topInfo = top.type === 'function' ? { precedence: 6, assoc: 'left' } : operatorInfo[top.value];
        if (!topInfo) break;
        const stronger = topInfo.precedence > current.precedence || (topInfo.precedence === current.precedence && current.assoc === 'left');
        if (stronger) {
          output.push(stack.pop());
        } else {
          break;
        }
      }
      stack.push(token);
    } else if (token.type === 'paren' && token.value === '(') {
      stack.push(token);
    } else if (token.type === 'paren' && token.value === ')') {
      let found = false;
      while (stack.length) {
        const top = stack.pop();
        if (top.type === 'paren' && top.value === '(') { found = true; break; }
        output.push(top);
      }
      if (!found) throw new Error('Mismatched parentheses');
      if (stack.length && stack[stack.length - 1].type === 'function') {
        output.push(stack.pop());
      }
    }
  }
  while (stack.length) {
    const top = stack.pop();
    if (top.type === 'paren') throw new Error('Mismatched parentheses');
    output.push(top);
  }
  return output;
}

function evaluateRPN(queue) {
  const stack = [];
  for (const token of queue) {
    if (token.type === 'number') {
      stack.push(parseFloat(token.value));
    } else if (token.type === 'constant') {
      stack.push(constants[token.value]);
    } else if (token.type === 'operator' || token.type === 'postfix') {
      const meta = operatorInfo[token.value];
      if (meta.args === 2) {
        const b = stack.pop();
        const a = stack.pop();
        if (a === undefined || b === undefined) throw new Error('Invalid expression');
        stack.push(applyOperator(token.value, a, b));
      } else if (meta.args === 1) {
        const a = stack.pop();
        if (a === undefined) throw new Error('Invalid expression');
        stack.push(applyUnary(token.value, a));
      }
    } else if (token.type === 'function') {
      const a = stack.pop();
      if (a === undefined) throw new Error('Invalid expression');
      stack.push(applyFunction(token.value, a));
    }
  }
  if (stack.length !== 1 || Number.isNaN(stack[0]) || !Number.isFinite(stack[0])) throw new Error('Math error');
  return stack[0];
}

function applyOperator(op, a, b) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b === 0 ? NaN : a / b;
    case '^': return Math.pow(a, b);
    default: return NaN;
  }
}

function applyUnary(op, a) {
  if (op === '%') return a / 100;
  if (op === '!') return factorial(a);
  return NaN;
}

function applyFunction(fn, a) {
  const val = needsRadians(fn) ? toRadians(a) : a;
  switch (fn) {
    case 'sin': return Math.sin(val);
    case 'cos': return Math.cos(val);
    case 'tan': return Math.tan(val);
    case 'asin': return fromRadians(Math.asin(a));
    case 'acos': return fromRadians(Math.acos(a));
    case 'atan': return fromRadians(Math.atan(a));
    case 'log': return Math.log10(a);
    case 'ln': return Math.log(a);
    case 'exp': return Math.exp(a);
    case 'pow10': return Math.pow(10, a);
    case 'sqrt': return a < 0 ? NaN : Math.sqrt(a);
    default: return NaN;
  }
}

function needsRadians(fn) {
  return ['sin', 'cos', 'tan'].includes(fn);
}

function toRadians(value) {
  return state.radian ? value : value * (Math.PI / 180);
}

function fromRadians(value) {
  return state.radian ? value : value * (180 / Math.PI);
}

function factorial(n) {
  if (!Number.isInteger(n) || n < 0) return NaN;
  if (n > 170) return NaN; // beyond JS safe range for factorial
  let res = 1;
  for (let i = 2; i <= n; i += 1) res *= i;
  return res;
}

function evaluateExpression() {
  pushCurrentIfNeeded();
  if (!state.tokens.length) return;
  try {
    const exprText = state.tokens.map(tokenToText).join('');
    const rpn = toRPN(state.tokens);
    const result = evaluateRPN(rpn);
    const rounded = Number.isInteger(result) ? result.toString() : parseFloat(result.toFixed(10)).toString();
    state.lastExpression = exprText;
    state.lastResult = rounded;
    state.tokens = [{ type: 'number', value: rounded }];
    state.current = '';
  } catch (err) {
    state.lastResult = 'Error';
  }
  updateDisplay();
}

function handleCommand(value) {
  switch (value) {
    case 'clear': return clearAll();
    case 'backspace': return backspace();
    case 'dot': return addDot();
    case 'equals': return evaluateExpression();
    case 'percent': return addPercent();
    default: return;
  }
}

function handleClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  const { type, value } = btn.dataset;
  flash(btn);
  if (type === 'toggle-angle') return toggleAngle();
  if (type === 'toggle-inverse') return toggleInverse();
  if (btn.id === 'toggleSci') return toggleScientific();

  if (type === 'number') return addNumber(value);
  if (type === 'command') return handleCommand(value);
  if (type === 'operator') return addOperator(value);
  if (type === 'paren') return smartParenthesis();
  if (type === 'function') return addFunction(value);
  if (type === 'constant') return addConstant(value);
}

function handleKeyboard(e) {
  const key = e.key;
  if (/^[0-9]$/.test(key)) { flashKey(key); addNumber(key); e.preventDefault(); return; }
  if (key === '.') { flashKey('.'); addDot(); e.preventDefault(); return; }
  if (key === '+') { flashKey('+'); addOperator('+'); e.preventDefault(); return; }
  if (key === '-') { flashKey('-'); addOperator('-'); e.preventDefault(); return; }
  if (key === '*' || key === 'x') { flashKey('*'); addOperator('*'); e.preventDefault(); return; }
  if (key === '/') { flashKey('/'); addOperator('/'); e.preventDefault(); return; }
  if (key === '%') { flashKey('%'); addPercent(); e.preventDefault(); return; }
  if (key === '^') { flashKey('^'); addOperator('^'); e.preventDefault(); return; }
  if (key === '(' || key === ')') { flashKey('()'); addParenthesis(key); e.preventDefault(); return; }
  if (key === 'Enter' || key === '=') { flashKey('='); evaluateExpression(); e.preventDefault(); return; }
  if (key === 'Backspace') { flashKey('backspace'); backspace(); e.preventDefault(); return; }
  if (key === 'Escape') { flashKey('clear'); clearAll(); e.preventDefault(); return; }
}

function flash(btn) {
  if (!btn) return;
  btn.classList.add('flash');
  setTimeout(() => btn.classList.remove('flash'), 140);
}

function flashKey(key) {
  let selector = '';
  if (/^[0-9]$/.test(key)) selector = `.btn[data-type="number"][data-value="${key}"]`;
  else if (key === '.') selector = `.btn[data-type="command"][data-value="dot"]`;
  else if (key === '+' || key === '-' || key === '*' || key === '/' || key === '^') selector = `.btn[data-type="operator"][data-value="${key === '*' ? '*' : key}"]`;
  else if (key === '%') selector = `.btn[data-type="command"][data-value="percent"]`;
  else if (key === '()') selector = `.btn[data-type="paren"]`;
  else if (key === '=') selector = `.btn[data-type="command"][data-value="equals"]`;
  else if (key === 'backspace') selector = `.btn[data-type="command"][data-value="backspace"]`;
  else if (key === 'clear') selector = `.btn[data-type="command"][data-value="clear"]`;
  const btn = selector ? document.querySelector(selector) : null;
  flash(btn);
}

document.addEventListener('click', handleClick);
document.addEventListener('keydown', handleKeyboard);

updateDisplay();
