// A reader of the small part of JSON Schema the contracts use: type, const, enum, required, properties,
// additionalProperties false, minLength, maxLength, pattern, format (date, email, uri), minimum, maximum, items,
// minItems, maxItems. It answers each reason a value fails, in plain words, with the path of the field. The Python
// package holds the same reader (`tommos_module/schema.py`); the CRM checks both answer alike.

const A_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const AN_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isADate(s) {
  const m = A_DATE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

function isALink(s) {
  try {
    const u = new URL(s);
    return (u.protocol === "https:" || u.protocol === "http:") && Boolean(u.hostname) && !/\s/.test(s);
  } catch {
    return false;
  }
}

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

function hasType(v, t) {
  const got = typeOf(v);
  if (t === "number") return got === "number" || got === "integer";
  return got === t;
}

const where = (path) => (path ? path : "the record");

/** Each reason `value` fails `schema`, as words; an empty list when it holds. */
export function theReasonsItFails(schema, value, path = "") {
  const out = [];
  if ("const" in schema && JSON.stringify(value) !== JSON.stringify(schema.const)) out.push(`${where(path)} must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) out.push(`${where(path)} must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(", ")}`);
  if (schema.type && !hasType(value, schema.type)) {
    out.push(`${where(path)} must be ${schema.type === "integer" ? "a whole number" : schema.type === "array" ? "a list" : schema.type === "object" ? "an object" : `a ${schema.type}`}`);
    return out;
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.trim().length < schema.minLength) out.push(`${where(path)} is empty`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) out.push(`${where(path)} is longer than ${schema.maxLength} characters`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) out.push(`${where(path)} has a wrong form («${value.slice(0, 80)}»)`);
    if (schema.format === "date" && !isADate(value)) out.push(`${where(path)} is not a date (YYYY-MM-DD)`);
    if (schema.format === "email" && !AN_EMAIL.test(value)) out.push(`${where(path)} is not an email address`);
    if (schema.format === "uri" && !isALink(value)) out.push(`${where(path)} is not a link (http or https)`);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) out.push(`${where(path)} is not a number`);
    if (schema.minimum !== undefined && value < schema.minimum) out.push(`${where(path)} is less than ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) out.push(`${where(path)} is more than ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) out.push(`${where(path)} must hold at least ${schema.minItems}`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) out.push(`${where(path)} holds more than ${schema.maxItems}`);
    if (schema.items) value.forEach((v, i) => out.push(...theReasonsItFails(schema.items, v, `${path}[${i}]`)));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const k of schema.required ?? []) if (value[k] === undefined || value[k] === null) out.push(`${path ? `${path}.` : ""}${k} is missing`);
    const props = schema.properties ?? {};
    for (const [k, v] of Object.entries(value)) {
      const p = path ? `${path}.${k}` : k;
      if (props[k]) {
        if (v !== null && v !== undefined) out.push(...theReasonsItFails(props[k], v, p));
      } else if (schema.additionalProperties === false) out.push(`${p} is not a field of this contract`);
    }
  }
  return out;
}
