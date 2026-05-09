import { tool } from 'ai';
import { z } from 'zod';

/**
 * 纯函数工具 — 不调 LLM
 * - calculator   白名单表达式求值（拒 eval；只允许数字、+-*\/、括号、空格）
 * - unit_convert 长度/质量/容积/时间/温度互换（小学常用单位）
 */

// ─── calculator ─────────────────────────────────────────────────

// 仅放行数字、运算符、括号、点、空格；任何字母都拒
const SAFE_EXPR = /^[\d+\-*/().\s]+$/;

function safeEvaluate(expr: string): number {
  if (!SAFE_EXPR.test(expr)) {
    throw new Error('表达式只允许数字 + - * / 与括号；不允许字母、变量或函数');
  }
  // Function 构造比 eval 安全（独立作用域，不接 closure），且配合 SAFE_EXPR 白名单
  // 不直接用 eval 是项目惯例
  // eslint-disable-next-line no-new-func
  const result = new Function(`return (${expr})`)();
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error('计算结果不是有限数字（可能除零或语法错）');
  }
  return result;
}

export const calculator = tool({
  description:
    '安全表达式计算。只支持 + - * / 与括号、整数与小数；用于习题出题里需要校对的算式。',
  inputSchema: z.object({
    expression: z.string().describe('算式，如"(3 + 5) * 7"'),
  }),
  execute: async ({ expression }) => {
    const result = safeEvaluate(expression);
    return { result, expression };
  },
});

// ─── unit_convert ───────────────────────────────────────────────

interface ConversionTable {
  // 每个单位到"基准单位"的换算因子（仅线性单位）
  base: string;
  factors: Record<string, number>;
}

// 仿射换算（温度）单独处理；其他都是 value * factor[from] / factor[to]
const LINEAR: Record<string, ConversionTable> = {
  length: {
    base: 'm',
    factors: { mm: 0.001, cm: 0.01, dm: 0.1, m: 1, km: 1000 },
  },
  mass: {
    base: 'g',
    factors: { mg: 0.001, g: 1, kg: 1000, t: 1_000_000 },
  },
  volume: {
    base: 'mL',
    factors: { mL: 1, L: 1000 },
  },
  time: {
    base: 's',
    factors: { s: 1, min: 60, h: 3600, d: 86400 },
  },
};

function detectKind(unit: string): keyof typeof LINEAR | 'temperature' | null {
  for (const k of Object.keys(LINEAR) as (keyof typeof LINEAR)[]) {
    if (unit in LINEAR[k].factors) return k;
  }
  if (['C', '°C', 'F', '°F', 'K'].includes(unit)) return 'temperature';
  return null;
}

function convertTemperature(value: number, from: string, to: string): number {
  // 统一到摄氏度作为基准
  let c: number;
  switch (from) {
    case 'C':
    case '°C':
      c = value;
      break;
    case 'F':
    case '°F':
      c = ((value - 32) * 5) / 9;
      break;
    case 'K':
      c = value - 273.15;
      break;
    default:
      throw new Error(`未知温度单位: ${from}`);
  }
  switch (to) {
    case 'C':
    case '°C':
      return c;
    case 'F':
    case '°F':
      return (c * 9) / 5 + 32;
    case 'K':
      return c + 273.15;
    default:
      throw new Error(`未知温度单位: ${to}`);
  }
}

export const unitConvert = tool({
  description:
    '小学常用单位换算：长度 (mm/cm/dm/m/km)、质量 (mg/g/kg/t)、容积 (mL/L)、时间 (s/min/h/d)、温度 (C/°C/F/°F/K)。from/to 必须同类。',
  inputSchema: z.object({
    value: z.number().describe('数值'),
    from: z.string().describe('源单位'),
    to: z.string().describe('目标单位'),
  }),
  execute: async ({ value, from, to }) => {
    const fromKind = detectKind(from);
    const toKind = detectKind(to);
    if (!fromKind || !toKind) {
      throw new Error(`不支持的单位：${from} → ${to}`);
    }
    if (fromKind !== toKind) {
      throw new Error(`不能跨类换算：${from}(${fromKind}) ↛ ${to}(${toKind})`);
    }

    if (fromKind === 'temperature') {
      const out = convertTemperature(value, from, to);
      return { value: Math.round(out * 1000) / 1000, unit: to };
    }

    const table = LINEAR[fromKind];
    const inBase = value * table.factors[from];
    const out = inBase / table.factors[to];
    return { value: Math.round(out * 1000) / 1000, unit: to };
  },
});
