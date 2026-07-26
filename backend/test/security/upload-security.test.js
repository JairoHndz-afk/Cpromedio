import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { env } from "../../src/config/env.js";
import { uploadArticleImage } from "../../src/controllers/upload.controller.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(currentDir, "..", "..");
const validPngDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+lmWQAAAAASUVORK5CYII=";
const gifPayloadDisguisedAsPng =
  "data:image/png;base64,R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function createMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

function createMockRequest(dataUrl) {
  return {
    body: {
      dataUrl,
      filename: "seguridad-portada.png",
      alt: "Portada"
    },
    protocol: "http",
    get(headerName) {
      if (String(headerName).toLowerCase() === "host") {
        return "poisoned.local";
      }

      return "";
    }
  };
}

test("usa la URL publica configurada y no el header Host para uploads", async () => {
  const request = createMockRequest(validPngDataUrl);
  const response = createMockResponse();

  await uploadArticleImage(request, response, (error) => {
    throw error;
  });

  assert.equal(response.statusCode, 201);
  assert.ok(response.payload?.url);
  assert.equal(new URL(response.payload.url).origin, env.publicServerUrl);
  assert.doesNotMatch(response.payload.url, /poisoned\.local/i);

  const uploadedPath = path.resolve(backendRoot, new URL(response.payload.url).pathname.replace(/^\//, ""));
  await fs.rm(uploadedPath, { force: true });
});

test("rechaza archivos cuya firma no coincide con el MIME declarado", async () => {
  const request = createMockRequest(gifPayloadDisguisedAsPng);
  const response = createMockResponse();
  let capturedError = null;

  await uploadArticleImage(request, response, (error) => {
    capturedError = error;
  });

  assert.ok(capturedError);
  assert.equal(capturedError.status, 400);
  assert.match(capturedError.message, /formato declarado|formato seguro permitido/i);
  assert.equal(response.payload, null);
});
