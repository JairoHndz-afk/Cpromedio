import assert from "node:assert/strict";
import test from "node:test";

import { readBoundedPositiveInt } from "../../src/utils/request.js";

test("usa un fallback seguro cuando page o limit no son numericos", () => {
  assert.equal(readBoundedPositiveInt("abc", 1), 1);
  assert.equal(readBoundedPositiveInt("xyz", 12, { max: 50 }), 12);
  assert.equal(readBoundedPositiveInt(undefined, 30, { max: 100 }), 30);
});

test("acota la paginacion dentro de los limites esperados", () => {
  assert.equal(readBoundedPositiveInt("-5", 1), 1);
  assert.equal(readBoundedPositiveInt("0", 1), 1);
  assert.equal(readBoundedPositiveInt("999", 12, { max: 24 }), 24);
  assert.equal(readBoundedPositiveInt("7.8", 1), 7);
});
