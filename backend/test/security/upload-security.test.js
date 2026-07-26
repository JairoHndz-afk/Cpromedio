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

test("usa Cloudinary cuando la integracion esta configurada", async (t) => {
  const originalCloudinaryConfigured = env.cloudinaryConfigured;
  const originalCloudinaryCloudName = env.cloudinaryCloudName;
  const originalCloudinaryApiKey = env.cloudinaryApiKey;
  const originalCloudinaryApiSecret = env.cloudinaryApiSecret;
  const originalCloudinaryFolder = env.cloudinaryFolder;
  const originalFetch = globalThis.fetch;
  const request = createMockRequest(validPngDataUrl);
  const response = createMockResponse();

  env.cloudinaryConfigured = true;
  env.cloudinaryCloudName = "wbvvnw52";
  env.cloudinaryApiKey = "fake-key";
  env.cloudinaryApiSecret = "fake-secret";
  env.cloudinaryFolder = "colombiano-promedio";
  globalThis.fetch = async (url) => {
    assert.match(String(url), /api\.cloudinary\.com\/v1_1\/wbvvnw52\/image\/upload/i);

    return {
      ok: true,
      async json() {
        return {
          secure_url:
            "https://res.cloudinary.com/wbvvnw52/image/upload/v1785003138/colombiano-promedio/news/2026/07/portada-segura.webp",
          public_id: "colombiano-promedio/news/2026/07/portada-segura"
        };
      }
    };
  };

  t.after(() => {
    env.cloudinaryConfigured = originalCloudinaryConfigured;
    env.cloudinaryCloudName = originalCloudinaryCloudName;
    env.cloudinaryApiKey = originalCloudinaryApiKey;
    env.cloudinaryApiSecret = originalCloudinaryApiSecret;
    env.cloudinaryFolder = originalCloudinaryFolder;
    globalThis.fetch = originalFetch;
  });

  await uploadArticleImage(request, response, (error) => {
    throw error;
  });

  assert.equal(response.statusCode, 201);
  assert.equal(
    response.payload?.url,
    "https://res.cloudinary.com/wbvvnw52/image/upload/v1785003138/colombiano-promedio/news/2026/07/portada-segura.webp"
  );
});
