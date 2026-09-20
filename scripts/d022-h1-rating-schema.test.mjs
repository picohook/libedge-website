#!/usr/bin/env node
import assert from "node:assert/strict";
const schema=JSON.parse(await (await import("node:fs/promises")).readFile(new URL("../docs/experiments/d022-h1/rating/d022-h1-rating-output.schema.json",import.meta.url),"utf8"));
assert.equal(schema.additionalProperties,false);
assert.equal(schema.properties.ratings.minItems,720);
assert.equal(schema.properties.ratings.maxItems,720);
assert.deepEqual(schema.properties.rater_id.enum,["R1","R2"]);
assert.deepEqual(schema.properties.ratings.items.properties.label.enum,["SUPPORTED","PARTIALLY_SUPPORTED","UNSUPPORTED"]);
assert.equal(schema.properties.status.const,"FINAL / LOCKED");
assert.equal(schema.properties.ratings.items.additionalProperties,false);
console.log("6/6 schema lock assertions PASS");
