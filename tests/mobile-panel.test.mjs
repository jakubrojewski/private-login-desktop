import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MAX_PASTE,
  parseAddress,
  pasteToRemote,
  openAddress,
  makeIdleController,
} from "../mobile-panel.js";

const calls = [];
const timers = [];
const rfb = {
  clipboardPasteFrom: (text) => calls.push(["clipboard", text]),
  sendKey: (...args) => calls.push(["key", ...args]),
  disconnect: () => calls.push(["disconnect"]),
};
const schedule = (fn, ms) => (timers.push([fn, ms]), timers.length);

assert.equal(MAX_PASTE, 8192);
assert.throws(() => pasteToRemote(null, { value: "x" }, schedule));
assert.throws(() => openAddress(null, "https://example.com/", schedule));
assert.deepEqual(parseAddress("https://example.com/path"), {
  href: "https://example.com/path",
  host: "example.com",
});
for (const bad of ["javascript:alert(1)", "ftp://example.com", "https://u:p@example.com", "x".repeat(2049)]) {
  assert.throws(() => parseAddress(bad));
}

const pasteField = { value: "Zażółć gęślą jaźń 123 !?" };
pasteToRemote(rfb, pasteField, schedule);
assert.equal(pasteField.value, "");
assert.deepEqual(calls, [
  ["clipboard", "Zażółć gęślą jaźń 123 !?"],
  ["key", 0xffe3, "ControlLeft", true],
  ["key", 0x76, "KeyV"],
  ["key", 0xffe3, "ControlLeft", false],
]);
assert.equal(timers[0][1], 250);
timers.shift()[0]();
assert.deepEqual(calls.at(-1), ["clipboard", ""]);
assert.throws(() => pasteToRemote(rfb, { value: "x".repeat(MAX_PASTE + 1) }, schedule));

calls.length = 0;
const address = parseAddress("https://example.com/");
openAddress(rfb, address.href, schedule);
assert.deepEqual(calls, [
  ["clipboard", "https://example.com/"],
  ["key", 0xffe3, "ControlLeft", true],
  ["key", 0x6c, "KeyL"],
  ["key", 0xffe3, "ControlLeft", false],
  ["key", 0xffe3, "ControlLeft", true],
  ["key", 0x76, "KeyV"],
  ["key", 0xffe3, "ControlLeft", false],
  ["key", 0xff0d, "Enter"],
]);
assert.equal(timers[0][1], 250);
timers.shift()[0]();
assert.deepEqual(calls.at(-1), ["clipboard", ""]);

let idle = null;
let cleared = 0;
const idleController = makeIdleController({
  timeoutMs: 900000,
  onIdle: () => rfb.disconnect(),
  setTimer: (fn, ms) => (idle = [fn, ms], 7),
  clearTimer: (id) => { assert.equal(id, 7); cleared += 1; },
});
assert.equal(idle[1], 900000);
idleController.activity();
assert.equal(cleared, 1);
idle[0]();
assert.deepEqual(calls.at(-1), ["disconnect"]);

const source = fs.readFileSync(new URL("../mobile-panel.js", import.meta.url), "utf8");
const wrapper = fs.readFileSync(new URL("../ui-wrapper.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../mobile-panel.css", import.meta.url), "utf8");
const dockerfile = fs.readFileSync(new URL("../Dockerfile.mobile", import.meta.url), "utf8");

assert.ok(!source.includes("console."));
assert.ok(!source.includes("innerHTML"));
assert.match(source, /Hasła i OTP wpisuj wyłącznie klawiaturą/);
assert.match(source, /⌨ Klawiatura/);
assert.match(source, /📋 Wklej/);
assert.match(source, /🌐 Adres/);
assert.match(source, /⛶ Dopasuj/);
assert.match(css, /min-height:\s*48px/);
assert.match(dockerfile, /FROM jlesage\/firefox@sha256:3804ffd4a38837340c5103a43825ebaca979eb50fed44c2ff5310676b13ea32d/);
assert.match(dockerfile, /ui-upstream\.js/);
assert.match(wrapper, /UI\.start =/);
assert.match(wrapper, /startMobilePanel\(UI, WebUtil\)/);
console.log("mobile_panel_policy=PASS");
